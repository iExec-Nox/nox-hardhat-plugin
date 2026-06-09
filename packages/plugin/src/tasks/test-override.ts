import type { JsonRpcServer } from "hardhat/types/network";
import type { TaskOverrideActionFunction } from "hardhat/types/tasks";
import {
  NOX_HOST_NETWORK,
  NOX_LOCAL_NETWORK,
  NOX_LOCAL_PORT,
} from "../config.js";
import {
  NOX_COMPUTE_ADDRESS,
  NOX_SUPPORTED_CHAIN_ID,
} from "../nox-config.js";
import type { NoxChain } from "../types.js";
import { deployNoxCompute } from "../utils/nox-compute.js";
import {
  dumpOffchainServicesLogs,
  startOffchainServices,
  stopOffchainServices,
} from "../utils/offchain-services.js";

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

  let server: JsonRpcServer | undefined;
  let chain: NoxChain | undefined;
  try {
    // The user picks which chain to emulate locally via `--network <name>`,
    // falling back to the conventional `default` network. We only read its
    // `chainId`, the network's `url` is irrelevant here (tests reach the
    // local stack via the injected `noxLocal` network).
    const targetNetworkName =
      hre.globalOptions.network !== undefined &&
      hre.globalOptions.network !== ""
        ? hre.globalOptions.network
        : "default";
    const targetNetwork = hre.config.networks[targetNetworkName];
    if (targetNetwork === undefined)
      throw new Error(
        `[nox] Network '${targetNetworkName}' is not defined in hardhat.config.`,
      );
    const chainId = targetNetwork.chainId;
    if (chainId === undefined)
      throw new Error(
        `[nox] Network '${targetNetworkName}' must declare a chainId.`,
      );
    if (chainId !== NOX_SUPPORTED_CHAIN_ID) {
      console.warn(
        `[nox] Chain id ${chainId} (network='${targetNetworkName}') is not ` +
          `supported by the plugin's local stack (only ${NOX_SUPPORTED_CHAIN_ID} is). ` +
          `Skipping stack setup, your tests will run against the network's real endpoint ` +
          `and may fail if it lacks a Nox deployment.`,
      );
      await runSuper(args);
      return;
    }
    chain = { chainId, noxComputeProxyAddress: NOX_COMPUTE_ADDRESS };

    // Mutate the injected `noxLocal` network's chainId so test code that
    // calls `nox.connect()` (which internally creates a connection to
    // `noxLocal`) gets a viem walletClient whose `chain.id` matches the
    // chain the local stack is emulating. The network manager holds a live
    // reference to `hre.config.networks`, so this is visible to subsequent
    // `network.create` calls.
    const noxLocal = hre.config.networks[NOX_LOCAL_NETWORK];
    if (noxLocal !== undefined && noxLocal.type === "http") {
      (noxLocal as { chainId?: number }).chainId = chainId;
    }

    server = await hre.network.createServer(
      { network: NOX_HOST_NETWORK, override: { chainId } },
      "0.0.0.0",
      NOX_LOCAL_PORT,
    );
    const { address, port: listeningPort } = await server.listen();
    console.log(
      `[nox] Hardhat node listening on ${address}:${listeningPort} (chainId=${chainId}, network='${targetNetworkName}')`,
    );

    const rpcUrl = `http://127.0.0.1:${listeningPort}`;
    await deployNoxCompute(rpcUrl, chain);
    await startOffchainServices(chain);

    // node:test resolves without throwing when tests fail, it sets
    // process.exitCode instead. Capture it before/after to detect
    // failures and dump logs for diagnostics.
    const exitCodeBefore = process.exitCode;
    await runSuper(args);
    if (process.exitCode !== 0 && process.exitCode !== exitCodeBefore) {
      await dumpOffchainServicesLogs(chain).catch(() => {});
    }
  } catch (err) {
    if (chain) await dumpOffchainServicesLogs(chain).catch(() => {});
    throw err;
  } finally {
    if (chain) await stopOffchainServices(chain).catch(() => {});
    await server?.close().catch(() => {});
  }
};

export default testWrapperAction;
