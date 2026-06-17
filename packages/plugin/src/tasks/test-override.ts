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
 * subprocess per file.
 *
 * Why this matters: the plugin opens the RPC node (and the Docker stack opens
 * keep-alive connections to it) in the *main* Hardhat process. With the old
 * per-file subprocess isolation, the test run finished when those child
 * processes exited, a signal completely independent of the main process's own
 * open handles, so port 8545 never kept the run from completing. With
 * `isolation: "none"` there are no child processes: the tests and the RPC
 * server now share a single event loop, and `run()` only settles once that
 * loop has no pending ref'd handles. The RPC node on port 8545 (plus the
 * keep-alive connections held against it) are exactly such handles, but the
 * plugin only closes them in the `finally` that runs *after* `runSuper()`
 * resolves, a circular wait that hangs `hardhat test` forever.
 *
 * The fix: right after `listen()`, `unref()` the server handle and every
 * incoming socket so they no longer keep the event loop alive. The server
 * stays fully functional during the run (pending RPC calls and timers keep the
 * loop alive), `run()` can settle once the tests are done, and the `finally`
 * still closes everything cleanly. On older runners this is a harmless no-op.
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
