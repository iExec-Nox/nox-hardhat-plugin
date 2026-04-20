import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPublicClient, http } from "viem";
import {
  HANDLE_GATEWAY_URL,
  NOX_COMPUTE_CONTRACT,
  RPC_URL,
} from "../config.js";

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
    const code = await client.getCode({ address: NOX_COMPUTE_CONTRACT });
    assert.ok(
      code !== undefined && code !== "0x",
      `No contract deployed at ${NOX_COMPUTE_CONTRACT}`,
    );
  });
});
