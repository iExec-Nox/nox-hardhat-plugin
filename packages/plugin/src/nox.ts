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
import type { WalletClient } from "viem";
import { NOX_LOCAL_NETWORK } from "./config.js";
import {
  HANDLE_GATEWAY_URL,
  NOX_COMPUTE_ADDRESS,
  RESOLVE_DELAY_MS,
  RESOLVE_MAX_RETRIES,
} from "./nox-config.js";
import type { NoxConnection } from "./types.js";

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

async function waitForHandlesResolved(handles: HexString[]): Promise<void> {
  const url = `${HANDLE_GATEWAY_URL}/v0/public/handles/status`;

  for (let attempt = 0; attempt < RESOLVE_MAX_RETRIES; attempt++) {
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

      const resolvedByHandle = new Map(
        data.payload.statuses.map((s) => [s.handle.toLowerCase(), s.resolved]),
      );
      const allResolved = handles.every(
        (h) => resolvedByHandle.get(h.toLowerCase()) === true,
      );
      if (allResolved) return;
    }

    await new Promise((r) => setTimeout(r, RESOLVE_DELAY_MS));
  }

  const seconds = (RESOLVE_MAX_RETRIES * RESOLVE_DELAY_MS) / 1000;
  throw new Error(
    `Handles not resolved after ${RESOLVE_MAX_RETRIES} attempts ` +
      `(${seconds}s): ${handles.join(", ")}`,
  );
}

export const nox = {
  connect,

  async encryptInput<T extends SolidityType>(
    value: JsValue<T>,
    solidityType: T,
    applicationContract: EthereumAddress,
    signer?: WalletClient,
  ): Promise<{ handle: Handle<T>; handleProof: HexString }> {
    if (signer) {
      // The handle SDK calls walletClient.getAddresses()[0] to determine the
      // proof owner. On a Hardhat provider, getAddresses() returns ALL test
      // accounts, so the SDK always uses account[0] regardless of which wallet
      // client was passed. Override getAddresses to expose only the intended
      // signer so the generated proof is bound to the correct address.
      const address = signer.account?.address;
      if (!address)
        throw new Error("[nox] encryptInput: signer has no account");
      const singleAccountClient = Object.create(signer) as WalletClient;
      (singleAccountClient as unknown as Record<string, unknown>).getAddresses =
        async () => [address];
      const handleClient = await createViemHandleClient(
        singleAccountClient as Parameters<typeof createViemHandleClient>[0],
        {
          smartContractAddress: NOX_COMPUTE_ADDRESS,
          gatewayUrl: HANDLE_GATEWAY_URL,
          subgraphUrl: "https://example.com/subgraphs/id/none",
        },
      );
      return handleClient.encryptInput(
        value,
        solidityType,
        applicationContract,
      );
    }
    const { handleClient } = await connect();
    return handleClient.encryptInput(value, solidityType, applicationContract);
  },

  async decrypt<T extends SolidityType>(
    handle: Handle<T>,
  ): Promise<{ value: JsValue<T>; solidityType: T }> {
    const { handleClient } = await connect();
    await waitForHandlesResolved([handle]);
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
    await waitForHandlesResolved([handle]);
    return handleClient.publicDecrypt(handle);
  },
};
