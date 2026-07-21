import type {
  EthereumAddress,
  Handle,
  HandleClient,
  HexString,
  JsValue,
  SolidityType,
} from "@iexec-nox/handle";
import { NOX_LOCAL_NETWORK, resolveTargetNetworkName } from "./config.js";
import {
  resolvedHandleGatewayUrl,
  resolvedNoxComputeAddress,
  RESOLVE_DELAY_MS,
  RESOLVE_MAX_RETRIES,
} from "./nox-config.js";
import type { NoxConnection } from "./types.js";
import { createHandleClient } from "./utils/handle-client.js";

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

async function connect(): Promise<NoxConnection> {
  // `hardhat` is imported lazily — a top-level import deadlocks Hardhat's CLI.
  const { network, config, globalOptions } = await import("hardhat");

  // When the currently active network carries a `nox` config, it points at
  // an already-running stack: connect to that network directly, and read
  // its address/gateway URL straight from the config instead of the
  // env-var-backed resolvers below, which stay reserved for the plugin's own
  // local stack (only `hardhat test` can start it, and only it populates
  // those env vars).
  const targetNetworkName = resolveTargetNetworkName(globalOptions.network);
  const targetNetworkConfig = config.networks[targetNetworkName];
  const existingStackConfig =
    targetNetworkConfig?.type === "http" ? targetNetworkConfig.nox : undefined;

  const noxComputeAddress =
    existingStackConfig?.noxComputeAddress ?? resolvedNoxComputeAddress();
  const handleGatewayUrl =
    existingStackConfig?.handleGatewayUrl ?? resolvedHandleGatewayUrl();

  const connection = await network.create<"op">(
    existingStackConfig !== undefined ? targetNetworkName : NOX_LOCAL_NETWORK,
  );
  // Works with either toolbox (viem or ethers), auto-detected from `connection`.
  const handleClient = await createHandleClient(connection, {
    smartContractAddress: noxComputeAddress,
    // Validated as http(s) at config-validation time (or always http:// for
    // the local stack) — `@iexec-nox/handle` types this as a template
    // literal rather than a plain `string`.
    gatewayUrl: handleGatewayUrl as `http://${string}` | `https://${string}`,
    // The Handle SDK requires a subgraph URL for config validation even when
    // the calling code never queries it (publicDecrypt only hits the gateway
    // + the chain). Placeholder.
    subgraphUrl: "https://example.com/subgraphs/id/none",
  });

  return Object.assign(connection, {
    noxComputeAddress,
    handleGatewayUrl,
    ...bindHandleOperations(handleClient, handleGatewayUrl),
  });
}

export const nox = { connect };
