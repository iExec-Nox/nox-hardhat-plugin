// Side-effect import: registers the `viem` field augmentation on
// `NetworkConnection` so `connection.viem.getWalletClients()` below is typed.
import "@nomicfoundation/hardhat-toolbox-viem";
import { createViemHandleClient } from "@iexec-nox/handle";
import { NOX_LOCAL_NETWORK } from "./config.js";
import { HANDLE_GATEWAY_URL, NOX_COMPUTE_ADDRESS } from "./nox-config.js";
import type { NoxConnection } from "./types.js";

/**
 * Public entry point for connecting to the plugin's local Nox stack. Returns
 * everything tests need:
 *   - the underlying network connection (`viem`, `provider`, etc.)
 *   - `handleClient`: a `@iexec-nox/handle` viem client pre-wired with the
 *     local stack's gateway URL and the canonical NoxCompute address, so
 *     tests can `publicDecrypt`/`encryptInput` without re-declaring config.
 */
export const nox = {
  async connect(): Promise<NoxConnection> {
    const { network } = await import("hardhat");
    const connection = await network.create<"op">(NOX_LOCAL_NETWORK);
    const [walletClient] = await connection.viem.getWalletClients();
    const handleClient = await createViemHandleClient(walletClient, {
      smartContractAddress: NOX_COMPUTE_ADDRESS,
      gatewayUrl: HANDLE_GATEWAY_URL,
      // The Handle SDK requires a subgraph URL for config validation even
      // when the calling code never queries the subgraph (publicDecrypt
      // only hits the gateway + the chain). We pass a placeholder.
      subgraphUrl: "https://example.com/subgraphs/id/none",
    });
    return Object.assign(connection, { handleClient });
  },
};
