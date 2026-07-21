import type { JsonRpcServer } from "hardhat/types/network";
import type { TaskOverrideActionFunction } from "hardhat/types/tasks";
import { resolveTargetNetworkName } from "../config.js";
import { NOX_SUPPORTED_CHAIN_ID } from "../nox-config.js";
import { startChain } from "../utils/chain.js";
import {
  dumpOffchainServicesLogs,
  startOffchainServices,
  stopOffchainServices,
} from "../utils/offchain-services.js";
import { resolveNoxComputeAddressViaResolver } from "../utils/nox-compute-address-resolver.js";
import { deployNoxCompute } from "../utils/nox-compute.js";

const testWrapperAction: TaskOverrideActionFunction = async (
  args,
  hre,
  runSuper,
) => {
  if (hre.config.nox.skipTestOverride) {
    console.log(
      "[nox] nox.skipTestOverride=true — running `hardhat test` without the Nox stack.",
    );
    await runSuper(args);
    return;
  }

  const targetNetworkName = resolveTargetNetworkName(hre.globalOptions.network);
  const targetNetworkConfig = hre.config.networks[targetNetworkName];
  const targetNetworkType = targetNetworkConfig?.type;

  // A network carrying a `nox` config points at an already-running stack:
  // use it as-is, independent of chain id and without touching the local
  // node or Docker Compose stack at all.
  const existingStackConfig =
    targetNetworkType === "http" ? targetNetworkConfig.nox : undefined;
  if (existingStackConfig !== undefined) {
    console.log(
      `[nox] Using the existing Nox stack configured on network '${targetNetworkName}'.`,
    );
    await runSuper(args);
    return;
  }

  // The plugin's local stack only supports chainId 31337. For any other
  // network, log a warning and skip the setup — the user's tests then run
  // against the real endpoint and may fail if it lacks a Nox deployment.
  const targetNetworkChainId = targetNetworkConfig?.chainId;
  if (
    targetNetworkType !== "edr-simulated" ||
    targetNetworkChainId !== NOX_SUPPORTED_CHAIN_ID
  ) {
    console.warn(
      `[nox] Chain id ${targetNetworkChainId} type ${targetNetworkType} (network='${targetNetworkName}') is not supported by the plugin's local stack (only chain ${NOX_SUPPORTED_CHAIN_ID} "edr-simulated" is). Skipping local stack setup.`,
    );
    await runSuper(args);
    return;
  }

  let server: JsonRpcServer | undefined;
  try {
    const chain = await startChain(hre);
    server = chain.server;
    const noxComputeAddress = await resolveNoxComputeAddressViaResolver(
      hre,
      chain.rpcUrl,
    );
    await deployNoxCompute(
      hre.config.paths.root,
      chain.rpcUrl,
      noxComputeAddress,
    );
    await startOffchainServices(noxComputeAddress);

    // node:test resolves without throwing when tests fail, it sets
    // process.exitCode instead. Capture it before/after to detect
    // failures and dump logs for diagnostics.
    const exitCodeBefore = process.exitCode;
    await runSuper(args);
    if (process.exitCode !== 0 && process.exitCode !== exitCodeBefore) {
      await dumpOffchainServicesLogs().catch(() => {});
    }
  } catch (err) {
    await dumpOffchainServicesLogs().catch(() => {});
    throw err;
  } finally {
    await stopOffchainServices().catch(() => {});
    await server?.close().catch(() => {});
  }
};

export default testWrapperAction;
