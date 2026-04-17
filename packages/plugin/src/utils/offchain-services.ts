import { downAll, logs as composeLogs, upAll } from "docker-compose";
import { COMPOSE_OPTS, ALL_SERVICES } from "../nox-config.js";

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

/** Dump logs of every offchain service — intended for failure diagnostics. */
export async function dumpOffchainServicesLogs(): Promise<void> {
  await composeLogs(ALL_SERVICES, COMPOSE_OPTS);
}
