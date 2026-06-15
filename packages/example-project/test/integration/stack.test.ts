import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { zeroAddress } from "viem";
import {
  HANDLE_GATEWAY_URL,
  NOX_COMPUTE_ADDRESS,
  nox,
} from "@iexec-nox/nox-hardhat-plugin";

// Minimal NoxCompute ABI for the install sanity checks below.
// `eip712Domain` (ERC-5267) exposes the constructor-set EIP712 immutables;
// `gateway`/`kmsPublicKey` expose the initializer-set config.
const NOX_COMPUTE_INSTALL_ABI = [
  {
    type: "function",
    name: "eip712Domain",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "fields", type: "bytes1" },
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
      { name: "salt", type: "bytes32" },
      { name: "extensions", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "gateway",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "kmsPublicKey",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes" }],
  },
] as const;

describe("Nox stack", () => {
  it("handle gateway is up", async () => {
    const response = await fetch(HANDLE_GATEWAY_URL);
    assert.ok(
      response.ok,
      `Handle gateway health check failed with status ${response.status}`,
    );
  });

  it("NoxCompute contract is deployed", async () => {
    const { viem } = await nox.connect();
    const publicClient = await viem.getPublicClient();
    const code = await publicClient.getCode({
      address: NOX_COMPUTE_ADDRESS,
    });
    assert.ok(
      code !== undefined && code !== "0x",
      `No contract deployed at ${NOX_COMPUTE_ADDRESS}`,
    );
  });

  it("NoxCompute constructor ran (EIP712 immutables are set)", async () => {
    const { viem } = await nox.connect();
    const publicClient = await viem.getPublicClient();
    const [, name, version] = await publicClient.readContract({
      address: NOX_COMPUTE_ADDRESS,
      abi: NOX_COMPUTE_INSTALL_ABI,
      functionName: "eip712Domain",
    });
    // Etching the runtime without running the constructor leaves these
    // immutables zeroed (empty strings), which breaks the EIP712 domain
    // separator and makes every input proof revert with "Invalid signature".
    assert.equal(
      name,
      "NoxCompute",
      "EIP712 domain name is empty — the constructor did not run",
    );
    assert.equal(
      version,
      "1",
      "EIP712 domain version is empty — the constructor did not run",
    );
  });

  it("NoxCompute initializer ran (gateway and KMS key are set)", async () => {
    const { viem } = await nox.connect();
    const publicClient = await viem.getPublicClient();
    const [gateway, kmsPublicKey] = await Promise.all([
      publicClient.readContract({
        address: NOX_COMPUTE_ADDRESS,
        abi: NOX_COMPUTE_INSTALL_ABI,
        functionName: "gateway",
      }),
      publicClient.readContract({
        address: NOX_COMPUTE_ADDRESS,
        abi: NOX_COMPUTE_INSTALL_ABI,
        functionName: "kmsPublicKey",
      }),
    ]);
    assert.notEqual(
      gateway,
      zeroAddress,
      "gateway is unset — initialize() did not run",
    );
    assert.ok(
      kmsPublicKey !== undefined && kmsPublicKey !== "0x",
      "kmsPublicKey is empty — initialize() did not run",
    );
  });
});
