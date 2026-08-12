import type {
  EthereumAddress,
  Handle,
  HandleClient,
  HexString,
  JsValue,
  SolidityType,
} from "@iexec-nox/handle";
import type {
  ChainType,
  DefaultChainType,
  NetworkConnection,
} from "hardhat/types/network";
import type { Address } from "viem";
import { RESOLVE_DELAY_MS, RESOLVE_MAX_RETRIES } from "./nox-config.js";
import type { NoxConnection } from "./types.js";
import { createHandleClient } from "./utils/handle-client.js";
import { ensureLocalNoxStack } from "./utils/local-stack.js";

async function waitForHandlesResolved(
  handleGatewayUrl: string,
  handles: HexString[],
): Promise<void> {
  const url = `${handleGatewayUrl}/v0/public/handles/status`;

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

function bindHandleOperations(
  handleClient: HandleClient,
  handleGatewayUrl: string,
) {
  return {
    async encryptInput<T extends SolidityType>(
      value: JsValue<T>,
      solidityType: T,
      applicationContract: EthereumAddress,
    ): Promise<{ handle: Handle<T>; handleProof: HexString }> {
      return handleClient.encryptInput(
        value,
        solidityType,
        applicationContract,
      );
    },

    async decrypt<T extends SolidityType>(
      handle: Handle<T>,
    ): Promise<{ value: JsValue<T>; solidityType: T }> {
      await waitForHandlesResolved(handleGatewayUrl, [handle]);
      return handleClient.decrypt(handle);
    },

    async publicDecrypt<T extends SolidityType>(
      handle: Handle<T>,
    ): Promise<{
      value: JsValue<T>;
      solidityType: T;
      decryptionProof: HexString;
    }> {
      await waitForHandlesResolved(handleGatewayUrl, [handle]);
      return handleClient.publicDecrypt(handle);
    },
  };
}

async function connect<
  ChainTypeT extends ChainType | string = DefaultChainType,
>(
  connection: NetworkConnection<ChainTypeT>,
  account?: EthereumAddress,
): Promise<NoxConnection> {
  const { networkConfig } = connection;
  const networkType: string = networkConfig.type;
  let noxComputeAddress: Address;
  let handleGatewayUrl: string;

  if (networkConfig.type === "http") {
    const existingStackConfig = networkConfig.nox;
    if (existingStackConfig === undefined) {
      throw new Error(
        `[nox] Network '${connection.networkName}' has no 'nox' config — ` +
          `nox.connect() needs one to know which existing stack to use.`,
      );
    }
    ({ noxComputeAddress, handleGatewayUrl } = existingStackConfig);
  } else if (networkConfig.type === "edr-simulated") {
    // `hardhat` is imported lazily — a top-level import deadlocks Hardhat's CLI.
    const hre = (await import("hardhat")).default;
    ({ noxComputeAddress, handleGatewayUrl } = await ensureLocalNoxStack(
      hre,
      connection as unknown as NetworkConnection<ChainType | string>,
    ));
  } else {
    throw new Error(
      `[nox] Unsupported network type '${networkType}' for network '${connection.networkName}'.`,
    );
  }

  const handleClient = await createHandleClient(
    connection,
    {
      smartContractAddress: noxComputeAddress,
      // Validated as http(s) at config-validation time (or always http:// for
      // the local stack) — `@iexec-nox/handle` types this as a template
      // literal rather than a plain `string`.
      gatewayUrl: handleGatewayUrl as `http://${string}` | `https://${string}`,
      // The Handle SDK requires a subgraph URL for config validation even when
      // the calling code never queries it (publicDecrypt only hits the gateway
      // + the chain). Placeholder.
      subgraphUrl: "https://example.com/subgraphs/id/none",
    },
    account,
  );

  return {
    noxComputeAddress,
    handleGatewayUrl,
    ...bindHandleOperations(handleClient, handleGatewayUrl),
  };
}

export const nox = { connect };
