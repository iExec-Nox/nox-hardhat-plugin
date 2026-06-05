import { writeFile } from "node:fs/promises";
import path from "node:path";
import { downAll, logs as composeLogs, upAll } from "docker-compose";
import { ALL_SERVICES, COMPOSE_OPTS } from "../nox-config.js";
import type { NoxChain } from "../types.js";

/** Bring the offchain stack up and wait for every service to be healthy. */
export async function startOffchainServices(chain: NoxChain): Promise<void> {
  console.log(`[nox] Starting offchain services (chainId=${chain.chainId})...`);
  await upAll({
    ...COMPOSE_OPTS,
    env: {
      ...process.env,
      NOX_CHAIN_ID: String(chain.chainId),
      NOX_COMPUTE_CONTRACT: chain.noxComputeProxyAddress,
    },
    commandOptions: ["--wait", "--remove-orphans"],
  });
}

/** Tear the offchain stack down. */
export async function stopOffchainServices(chain: NoxChain): Promise<void> {
  await downAll({
    ...COMPOSE_OPTS,
    env: {
      ...process.env,
      NOX_CHAIN_ID: String(chain.chainId),
      NOX_COMPUTE_CONTRACT: chain.noxComputeProxyAddress,
    },
    commandOptions: ["--volumes", "--remove-orphans"],
  });
}

/**
 * Dump logs of every offchain service to `offchain-services.log` (cwd of the
 * Hardhat process), intended for failure diagnostics. Stdout stays mostly
 * clean so the Hardhat test report remains readable, while the full trace is
 * available on disk.
 */
export async function dumpOffchainServicesLogs(chain: NoxChain): Promise<void> {
  const result = await composeLogs(ALL_SERVICES, {
    ...COMPOSE_OPTS,
    env: {
      ...process.env,
      NOX_CHAIN_ID: String(chain.chainId),
      NOX_COMPUTE_CONTRACT: chain.noxComputeProxyAddress,
    },
    log: false,
    commandOptions: ["--no-color", "--timestamps"],
  });
  const logPath = path.resolve(process.cwd(), "offchain-services.log");
  await writeFile(logPath, result.out + result.err, "utf-8");
  console.log(`[nox] Offchain services logs written to ${logPath}`);
}
