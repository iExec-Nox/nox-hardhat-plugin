import type { Server } from "node:net";
import type { JsonRpcServer } from "hardhat/types/network";
import type { TaskOverrideActionFunction } from "hardhat/types/tasks";
import { NOX_HOST_NETWORK, NOX_LOCAL_PORT } from "../config.js";
import { NOX_SUPPORTED_CHAIN_ID } from "../nox-config.js";
import { deployNoxCompute } from "../utils/nox-compute.js";
import {
  dumpOffchainServicesLogs,
  startOffchainServices,
  stopOffchainServices,
} from "../utils/offchain-services.js";

/**
 * Stop the local JSON-RPC server (and its accepted connections) from keeping
 * the Node.js event loop alive, without closing it.
 *
 * Background: since `@nomicfoundation/hardhat-node-test-runner@3.0.14`
 * (https://github.com/NomicFoundation/hardhat/pull/8142) the runner executes
 * `node:test` with `isolation: "none"`, i.e. in-process instead of one
 * subprocess per file. With in-process execution `run()` only settles once the
 * event loop has no pending ref'd handles. The RPC node we open on port 8545
 * (plus the keep-alive connections the Docker stack holds against it) are such
 * handles, but the plugin only closes them in the `finally` that runs *after*
 * `runSuper()` resolves, a circular wait that hangs `hardhat test` forever.
 *
 */
function unrefRpcServerHandles(port: number): void {
  const getActiveHandles = (
    process as unknown as { _getActiveHandles?: () => unknown[] }
  )._getActiveHandles;
  if (typeof getActiveHandles !== "function") {
    return;
  }

  for (const handle of getActiveHandles.call(process)) {
    const server = handle as Partial<Server>;
    const address = server.address?.();
    if (
      typeof address === "object" &&
      address !== null &&
      "port" in address &&
      address.port === port
    ) {
      server.unref?.();
      server.on?.("connection", (socket) => socket.unref());
    }
  }
}

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

  // The plugin's local stack only supports chainId 31337. For any other
  // network, log a warning and skip the setup — the user's tests then run
  // against the real endpoint and may fail if it lacks a Nox deployment.
  const targetNetworkName =
    hre.globalOptions.network !== undefined && hre.globalOptions.network !== ""
      ? hre.globalOptions.network
      : "default";
  const targetChainId = hre.config.networks[targetNetworkName]?.chainId;
  if (targetChainId !== NOX_SUPPORTED_CHAIN_ID) {
    console.warn(
      `[nox] Chain id ${targetChainId} (network='${targetNetworkName}') is not ` +
        `supported by the plugin's local stack (only ${NOX_SUPPORTED_CHAIN_ID} is). ` +
        `Skipping local stack setup.`,
    );
    await runSuper(args);
    return;
  }

  let server: JsonRpcServer | undefined;
  try {
    server = await hre.network.createServer(
      { network: NOX_HOST_NETWORK },
      "0.0.0.0",
      NOX_LOCAL_PORT,
    );
    const { address, port } = await server.listen();
    console.log(`[nox] Hardhat node listening on ${address}:${port}`);

    unrefRpcServerHandles(port);

    await deployNoxCompute(`http://127.0.0.1:${port}`);
    await startOffchainServices();

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
