import type { Server } from "node:net";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { ChainType, NetworkConnection } from "hardhat/types/network";
import type { Address } from "viem";
import { NOX_LOCAL_PORT } from "../config.js";
import { NOX_SUPPORTED_CHAIN_ID } from "../nox-config.js";
import { createJsonRpcRelay } from "./json-rpc-relay.js";
import { isPortAvailable } from "./net.js";
import { resolveNoxComputeAddressViaResolver } from "./nox-compute-address-resolver.js";
import { deployNoxCompute } from "./nox-compute.js";
import {
  startOffchainServices,
  stopOffchainServices,
} from "./offchain-services.js";

interface LocalNoxStackResult {
  noxComputeAddress: Address;
  handleGatewayUrl: string;
}

const started = new WeakMap<
  NetworkConnection<ChainType | string>,
  Promise<LocalNoxStackResult>
>();

/**
 * Ensures the local Nox stack (JSON-RPC relay + NoxCompute deployment +
 * offchain Docker services) is running for the given connection, starting
 * it if needed. Concurrent callers on the same connection object share the
 * same in-flight promise, so setup runs exactly once per connection.
 */
export function ensureLocalNoxStack(
  hre: HardhatRuntimeEnvironment,
  connection: NetworkConnection<ChainType | string>,
): Promise<LocalNoxStackResult> {
  let promise = started.get(connection);
  if (promise === undefined) {
    promise = setupLocalNoxStack(hre, connection);
    started.set(connection, promise);
  }
  return promise;
}

async function setupLocalNoxStack(
  hre: HardhatRuntimeEnvironment,
  connection: NetworkConnection<ChainType | string>,
): Promise<LocalNoxStackResult> {
  if (connection.networkConfig.chainId !== NOX_SUPPORTED_CHAIN_ID) {
    throw new Error(
      `[nox] The local Nox stack only supports chain id ${NOX_SUPPORTED_CHAIN_ID}, ` +
        `got ${connection.networkConfig.chainId} on network '${connection.networkName}'.`,
    );
  }
  if (!(await isPortAvailable(NOX_LOCAL_PORT))) {
    throw new Error(
      `[nox] Port ${NOX_LOCAL_PORT} is already in use. A Hardhat node ` +
        `(or another process) is already bound to it. Stop it and re-run.`,
    );
  }

  const server = createJsonRpcRelay(
    connection.provider,
    "0.0.0.0",
    NOX_LOCAL_PORT,
  );
  const { address, port } = await server.listen();
  console.log(`[nox] 🔌 Hardhat RPC relay listening on ${address}:${port}`);
  unrefRpcServerHandles(port);

  // Wrap close() immediately after the relay is up — before the
  // resolver/deploy/compose steps — so a failure partway through still gets
  // cleaned up whenever the caller eventually calls connection.close()
  // (standalone-script usage), instead of leaking a listening relay or a
  // half-started compose stack.
  const originalClose = connection.close.bind(connection);
  connection.close = async () => {
    await stopOffchainServices().catch(() => {});
    await server.close().catch(() => {});
    await originalClose();
  };

  const rpcUrl = `http://127.0.0.1:${port}`;
  const noxComputeAddress = await resolveNoxComputeAddressViaResolver(
    hre,
    rpcUrl,
  );
  await deployNoxCompute(hre, connection, noxComputeAddress);
  const handleGatewayUrl = await startOffchainServices(noxComputeAddress);
  return { noxComputeAddress, handleGatewayUrl };
}

/**
 * Stop the local JSON-RPC relay (and its accepted connections) from keeping
 * the Node.js event loop alive, without closing it.
 *
 * Background: since `@nomicfoundation/hardhat-node-test-runner@3.0.14`
 * (https://github.com/NomicFoundation/hardhat/pull/8142) the runner executes
 * `node:test` with `isolation: "none"`, i.e. in-process instead of one
 * subprocess per file.
 *
 * Why this matters: the plugin opens the RPC relay (and the Docker stack opens
 * keep-alive connections to it) in the *main* Hardhat process. With the old
 * per-file subprocess isolation, the test run finished when those child
 * processes exited, a signal completely independent of the main process's own
 * open handles, so port 8545 never kept the run from completing. With
 * `isolation: "none"` there are no child processes: the tests and the RPC
 * relay now share a single event loop, and `run()` only settles once that
 * loop has no pending ref'd handles. The RPC relay on port 8545 (plus the
 * keep-alive connections held against it) are exactly such handles, but the
 * plugin only closes them when `connection.close()` is called — a circular
 * wait that would hang `hardhat test` forever without this fix.
 *
 * The fix: right after `listen()`, `unref()` the server handle and every
 * incoming socket so they no longer keep the event loop alive. The server
 * stays fully functional during the run (pending RPC calls and timers keep the
 * loop alive), `run()` can settle once the tests are done, and teardown via
 * `connection.close()` still closes everything cleanly. On older runners this
 * is a harmless no-op.
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
