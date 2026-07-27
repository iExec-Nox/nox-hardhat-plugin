import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { nox } from "@iexec-nox/nox-hardhat-plugin";

describe("nox API", () => {
  it("connect() returns pre-configured handle operations", async () => {
    const connection = await network.getOrCreate();
    const conn = await nox.connect(connection);
    assert.equal(typeof conn.publicDecrypt, "function");
    assert.equal(typeof conn.encryptInput, "function");
    assert.equal(typeof conn.decrypt, "function");
  });

  it("encryptInput() returns a { handle, handleProof } pair", async () => {
    const connection = await network.getOrCreate();
    const { encryptInput } = await nox.connect(connection);
    const result = await encryptInput(
      42n,
      "uint256",
      "0x000000000000000000000000000000000000dead",
    );
    assert.match(
      result.handle,
      /^0x[0-9a-fA-F]{64}$/,
      "handle should be a 32-byte hex string",
    );
    assert.match(
      result.handleProof,
      /^0x[0-9a-fA-F]+$/,
      "handleProof should be a hex string",
    );
  });

  it("publicDecrypt() returns the cleartext of a publicly decryptable handle", async () => {
    const connection = await network.getOrCreate();
    const { publicDecrypt } = await nox.connect(connection);
    const token = await connection.viem.deployContract("MyConfidentialToken", [
      "Nox API Token",
      "NAT",
      "ipfs://example",
      7n,
    ]);
    const handle =
      (await token.read.confidentialTotalSupply()) as `0x${string}`;
    const { value } = await publicDecrypt(handle);
    assert.equal(value, 7n);
  });
});
