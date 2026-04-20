import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HANDLE_GATEWAY_URL,
  NOX_COMPUTE_PROXY_ADDRESS,
  RPC_URL,
} from "hardhat-my-plugin";
import { createPublicClient, http } from "viem";

const client = createPublicClient({ transport: http(RPC_URL) });

describe("Nox stack", () => {
  it("handle gateway is up", async () => {
    const response = await fetch(HANDLE_GATEWAY_URL);
    assert.ok(
      response.ok,
      `Handle gateway health check failed with status ${response.status}`,
    );
  });

  it("NoxCompute contract is deployed", async () => {
    const code = await client.getCode({ address: NOX_COMPUTE_PROXY_ADDRESS });
    assert.ok(
      code !== undefined && code !== "0x",
      `No contract deployed at ${NOX_COMPUTE_PROXY_ADDRESS}`,
    );
  });
});
