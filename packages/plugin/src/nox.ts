// Side-effect import: registers the `viem` field augmentation on
// `NetworkConnection` so `connection.viem.getWalletClients()` below is typed.
import "@nomicfoundation/hardhat-toolbox-viem";
import { createViemHandleClient } from "@iexec-nox/handle";
import type {
  EthereumAddress,
  Handle,
  HexString,
  JsValue,
  SolidityType,
} from "@iexec-nox/handle";
import { NOX_LOCAL_NETWORK } from "./config.js";
import { HANDLE_GATEWAY_URL, NOX_COMPUTE_ADDRESS } from "./nox-config.js";
import type { NoxConnection } from "./types.js";

async function connect(): Promise<NoxConnection> {
  if (cachedConnection !== null) return cachedConnection;

  // Dynamic import: a top-level `import { network } from "hardhat"` causes an
  // unsettled top-level await in Hardhat's CLI bootstrap. Deferring the import
  // to call time avoids the deadlock.
  const { network } = await import("hardhat");
  const connection = await network.create<"op">(NOX_LOCAL_NETWORK);
  const [walletClient] = await connection.viem.getWalletClients();
  const handleClient = await createViemHandleClient(walletClient, {
    smartContractAddress: NOX_COMPUTE_ADDRESS,
    gatewayUrl: HANDLE_GATEWAY_URL,
    // The Handle SDK requires a subgraph URL for config validation even when
    // the calling code never queries it (publicDecrypt only hits the gateway
    // + the chain). Placeholder.
    subgraphUrl: "https://example.com/subgraphs/id/none",
  });
  return Object.assign(connection, { handleClient });
}

/**
 * Public entry point for the plugin's local Nox stack. Exposes:
 *   - `connect()` — returns the network connection (`viem`, `provider`, …)
 *     plus a pre-configured `@iexec-nox/handle` client.
 *   - `encryptInput` / `decrypt` / `publicDecrypt` — convenience proxies onto
 *     the handle client so tests don't have to thread it around.
 */
export const nox = {
  connect,

  async encryptInput<T extends SolidityType>(
    value: JsValue<T>,
    solidityType: T,
    applicationContract: EthereumAddress,
  ): Promise<{ handle: Handle<T>; handleProof: HexString }> {
    const { handleClient } = await connect();
    return handleClient.encryptInput(value, solidityType, applicationContract);
  },

  async decrypt<T extends SolidityType>(
    handle: Handle<T>,
  ): Promise<{ value: JsValue<T>; solidityType: T }> {
    const { handleClient } = await connect();
    return handleClient.decrypt(handle);
  },

  async publicDecrypt<T extends SolidityType>(
    handle: Handle<T>,
  ): Promise<{
    value: JsValue<T>;
    solidityType: T;
    decryptionProof: HexString;
  }> {
    const { handleClient } = await connect();
    return handleClient.publicDecrypt(handle);
  },
};
