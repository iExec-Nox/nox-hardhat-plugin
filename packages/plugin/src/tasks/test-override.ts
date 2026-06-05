import type { JsonRpcServer } from "hardhat/types/network";
import type { TaskOverrideActionFunction } from "hardhat/types/tasks";
import { NOX_HOST_NETWORK } from "../config.js";
import { NOX_COMPUTE_CONTRACT } from "../nox-config.js";
import type { NoxChain } from "../types.js";
import { deployNoxCompute } from "../utils/nox-compute.js";
import {
  dumpOffchainServicesLogs,
  startOffchainServices,
  stopOffchainServices,
} from "../utils/offchain-services.js";
import { portFromUrl } from "../utils/url.js";

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
    // Resolve which chain the user picked via `--network <name>` (or fall back
    // to the conventional `default` network when omitted, matching Hardhat 3's
    // own resolution). That network must be `http`-typed and point at the
    // address/port we'll bind the JSON-RPC server to below.
    const activeNetworkName =
      hre.globalOptions.network !== undefined &&
      hre.globalOptions.network !== ""
        ? hre.globalOptions.network
        : "default";
    const activeNetwork = hre.config.networks[activeNetworkName];
    if (activeNetwork === undefined)
      throw new Error(
        `[nox] Network '${activeNetworkName}' is not defined in hardhat.config.`,
      );
    if (activeNetwork.type !== "http")
      throw new Error(
        `[nox] Active network '${activeNetworkName}' must be of type 'http'. ` +
          `The plugin spins up its own EDR and exposes it over HTTP; your tests ` +
          `then connect to that HTTP endpoint via this named network.`,
      );
    const chainId = activeNetwork.chainId;
    if (chainId === undefined)
      throw new Error(
        `[nox] Network '${activeNetworkName}' must declare a chainId.`,
      );
    const noxComputeProxyAddress = NOX_COMPUTE_CONTRACT[chainId];
    if (noxComputeProxyAddress === undefined)
      throw new Error(
        `[nox] Chain id ${chainId} is not supported by this plugin. ` +
          `Supported chain ids: ${Object.keys(NOX_COMPUTE_CONTRACT).join(", ")}.`,
      );
    chain = { chainId, noxComputeProxyAddress };

    const port = portFromUrl(await activeNetwork.url.get());

    server = await hre.network.createServer(
      { network: NOX_HOST_NETWORK, override: { chainId } },
      "0.0.0.0",
      port,
    );
    const { address, port: listeningPort } = await server.listen();
    console.log(
      `[nox] Hardhat node listening on ${address}:${listeningPort} (chainId=${chainId}, network='${activeNetworkName}')`,
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
