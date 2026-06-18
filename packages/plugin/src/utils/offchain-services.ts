import { writeFile } from "node:fs/promises";
import path from "node:path";
import { downAll, logs as composeLogs, upAll } from "docker-compose";
import {
  ALL_SERVICES,
  COMPOSE_OPTS,
  HANDLE_GATEWAY_DEFAULT_PORT,
  HANDLE_GATEWAY_HOST_PORT_ENV,
} from "../nox-config.js";
import { resolveAvailablePort } from "./net.js";

export function describeDockerError(error: unknown): string | undefined {
  if (
    error instanceof Error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  ) {
    return "Docker CLI not found. Is Docker installed and on your PATH?";
  }

  const stderr =
    typeof error === "object" && error !== null && "err" in error
      ? String((error as { err: unknown }).err)
      : "";

  if (
    /cannot connect to the docker daemon|is the docker daemon running|docker daemon is not running|dial unix .*docker\.sock/i.test(
      stderr,
    )
  ) {
    return (
      "Cannot connect to the Docker daemon. Is Docker running? " +
      "Start Docker Desktop (or the docker service) and try again."
    );
  }

  return undefined;
}

async function runCompose<T>(action: string, op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (error) {
    const recognized = describeDockerError(error);
    if (recognized !== undefined) {
      throw new Error(`[nox] ${recognized}`);
    }
    const detail =
      typeof error === "object" && error !== null && "err" in error
        ? String((error as { err: unknown }).err).trim()
        : error instanceof Error
          ? error.message
          : String(error);
    throw new Error(`[nox] Failed to ${action} the offchain stack:\n${detail}`);
  }
}

export async function startOffchainServices(): Promise<void> {
  await stopOffchainServices().catch(() => {});

  const gatewayPort = await resolveAvailablePort(HANDLE_GATEWAY_DEFAULT_PORT);
  process.env[HANDLE_GATEWAY_HOST_PORT_ENV] = String(gatewayPort);
  if (gatewayPort !== HANDLE_GATEWAY_DEFAULT_PORT) {
    console.warn(
      `[nox] Host port ${HANDLE_GATEWAY_DEFAULT_PORT} is busy; ` +
        `publishing the handle gateway on ${gatewayPort} instead.`,
    );
  }

  console.log("[nox] Starting offchain services...");
  await runCompose("start", () =>
    upAll({
      ...COMPOSE_OPTS,
      commandOptions: ["--wait", "--remove-orphans"],
    }),
  );
}

/** Tear the offchain stack down. */
export async function stopOffchainServices(): Promise<void> {
  await runCompose("stop", () =>
    downAll({
      ...COMPOSE_OPTS,
      commandOptions: ["--volumes", "--remove-orphans"],
    }),
  );
}

/**
 * Dump logs of every offchain service to `offchain-services.log` (cwd of the
 * Hardhat process), intended for failure diagnostics. Stdout stays mostly
 * clean so the Hardhat test report remains readable, while the full trace is
 * available on disk.
 */
export async function dumpOffchainServicesLogs(): Promise<void> {
  const result = await composeLogs(ALL_SERVICES, {
    ...COMPOSE_OPTS,
    log: false,
    commandOptions: ["--no-color", "--timestamps"],
  });
  const logPath = path.resolve(process.cwd(), "offchain-services.log");
  await writeFile(logPath, result.out + result.err, "utf-8");
  console.log(`[nox] Offchain services logs written to ${logPath}`);
}
