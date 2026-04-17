import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  downAll,
  IDockerComposeOptions,
  logs as composeLogs,
  upAll,
} from "docker-compose";

const COMPOSE_OPTS: IDockerComposeOptions = {
  cwd: path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "offchain-services",
  ),
  log: true,
  composeOptions: [["--env-file", "dev.env"]],
};

const ALL_SERVICES = [
  "nats",
  "s3",
  "nox-kms",
  "nox-handle-gateway",
  "nox-ingestor",
  "nox-runner",
];

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
