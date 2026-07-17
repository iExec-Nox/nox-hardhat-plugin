import { writeFile } from "node:fs/promises";
import path from "node:path";
import { downAll, logs as composeLogs, port, upAll } from "docker-compose";
import {
  ALL_SERVICES,
  COMPOSE_OPTS,
  HANDLE_GATEWAY_CONTAINER_PORT,
  HANDLE_GATEWAY_SERVICE,
  setHandleGatewayPort,
} from "../nox-config.js";
import { NOX_LOCAL_PORT } from "../config.js";
import { assertDockerDaemonRunning } from "./docker.js";

/** Run a docker-compose operation, rethrowing failures with a clean message. */
async function runComposeWithCleanErrors<T>(
  action: string,
  op: () => Promise<T>,
): Promise<T> {
  try {
    return await op();
  } catch (error) {
    // docker-compose rejects with `{ exitCode, err, out }`, which `String()`
    // renders as "[object Object]" — surface the real stderr/stdout instead.
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? [
              (error as { err?: string }).err,
              (error as { out?: string }).out,
            ]
              .filter(Boolean)
              .join("\n") || JSON.stringify(error)
          : String(error);
    throw new Error(
      `[nox] Failed to ${action} the offchain stack:\n${detail}`,
    );
  }
}

export async function startOffchainServices(
  noxComputeAddress: `0x${string}`,
): Promise<void> {
  // Fail fast with a clear message if the daemon is down, before any compose call.
  await assertDockerDaemonRunning();
  // Make sure there is not old service instance still running.
  await stopOffchainServices().catch(() => {});

  console.log(
    `[nox] 🚀 Starting Nox offchain stack connected to NoxCompute at ${noxComputeAddress}...`,
  );
  await runComposeWithCleanErrors("start", () =>
    upAll({
      ...COMPOSE_OPTS,
      env: {
        // `docker-compose` spawns the CLI with `env` REPLACING the parent
        // environment (not merging). Without PATH/SystemRoot/USERPROFILE/APPDATA
        // the Docker CLI cannot resolve its context or the named pipe on Windows,
        // so the stack fails to start. Inherit the parent env explicitly.
        ...process.env,
        ...COMPOSE_OPTS.env,
        NOX_COMPUTE_CONTRACT: noxComputeAddress,
        HOST_RPC_URL: `http://host.docker.internal:${NOX_LOCAL_PORT}`,
      },
      commandOptions: ["--wait", "--remove-orphans"],
    }),
  );

  const { data } = await runComposeWithCleanErrors("start", () =>
    port(HANDLE_GATEWAY_SERVICE, HANDLE_GATEWAY_CONTAINER_PORT, COMPOSE_OPTS),
  );
  if (!data.port) {
    throw new Error(
      `[nox] Could not determine the host port for ${HANDLE_GATEWAY_SERVICE}.`,
    );
  }
  setHandleGatewayPort(data.port);
}

/** Tear the offchain stack down. */
export async function stopOffchainServices(): Promise<void> {
  await runComposeWithCleanErrors("stop", () =>
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
