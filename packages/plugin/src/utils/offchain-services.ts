import { writeFile } from "node:fs/promises";
import path from "node:path";
import { downAll, logs as composeLogs, upAll } from "docker-compose";
import { ALL_SERVICES, COMPOSE_OPTS } from "../nox-config.js";

/** Bring the offchain stack up and wait for every service to be healthy. */
export async function startOffchainServices(): Promise<void> {
  console.log("[nox] Starting offchain services...");
  await upAll({
    ...COMPOSE_OPTS,
    commandOptions: ["--wait", "--remove-orphans"],
  });
}

/** Tear the offchain stack down. */
export async function stopOffchainServices(): Promise<void> {
  await downAll({
    ...COMPOSE_OPTS,
    commandOptions: ["--volumes", "--remove-orphans"],
  });
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
