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

/** Options for {@link nox.waitForHandlesResolved}'s polling loop. */
export interface WaitForHandlesResolvedOptions {
  /** Maximum number of status polls before giving up. Defaults to `60`. */
  maxRetries?: number;
  /** Delay between polls, in milliseconds. Defaults to `2000`. */
  delayMs?: number;
}

async function connect(): Promise<NoxConnection> {
  // `hardhat` is imported lazily — a top-level import deadlocks Hardhat's CLI.
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

  /**
   * Polls the Handle Gateway until every handle has been resolved (i.e. the
   * offchain stack has finished ingesting the onchain computation), or throws
   * once `maxRetries` attempts elapse.
   *
   * Provided so application test suites don't have to reimplement the polling
   * loop against the gateway's `/v0/public/handles/status` endpoint.
   */
  async waitForHandlesResolved(
    handles: HexString[],
    { maxRetries = 60, delayMs = 2000 }: WaitForHandlesResolvedOptions = {},
  ): Promise<void> {
    const url = `${HANDLE_GATEWAY_URL}/v0/public/handles/status`;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handles }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          payload: {
            statuses: Array<{ handle: string; resolved: boolean }>;
          };
        };
        if (data.payload.statuses.every((s) => s.resolved)) return;
      }

      if (attempt === maxRetries - 1) {
        throw new Error(
          `Handles not resolved after ${maxRetries} attempts ` +
            `(${(maxRetries * delayMs) / 1000}s): ${handles.join(", ")}`,
        );
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  },
};
