import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NetworkConnection } from "hardhat/types/network";
import {
  createHandleClient,
  type HandleClientFactories,
} from "../src/utils/handle-client.js";

const viemClient = { kind: "viem" };
const ethersClient = { kind: "ethers" };

function recordingFactories(calls: string[]): HandleClientFactories {
  return {
    viem: async () => {
      calls.push("viem");
      return viemClient;
    },
    ethers: async () => {
      calls.push("ethers");
      return ethersClient;
    },
  } as unknown as HandleClientFactories;
}

function connectionWith(props: object): NetworkConnection<"op"> {
  return props as unknown as NetworkConnection<"op">;
}

describe("createHandleClient toolbox detection", () => {
  it("uses the viem factory when connection.viem is present", async () => {
    const calls: string[] = [];
    const conn = connectionWith({
      viem: { getWalletClients: async () => ["wallet"] },
    });
    const client = await createHandleClient(
      conn,
      {},
      recordingFactories(calls),
    );
    assert.deepEqual(calls, ["viem"]);
    assert.equal(client, viemClient);
  });

  it("uses the ethers factory when only connection.ethers is present", async () => {
    const calls: string[] = [];
    const conn = connectionWith({
      ethers: { getSigners: async () => ["signer"] },
    });
    const client = await createHandleClient(
      conn,
      {},
      recordingFactories(calls),
    );
    assert.deepEqual(calls, ["ethers"]);
    assert.equal(client, ethersClient);
  });

  it("prefers viem when both toolboxes are present", async () => {
    const calls: string[] = [];
    const conn = connectionWith({
      viem: { getWalletClients: async () => ["wallet"] },
      ethers: { getSigners: async () => ["signer"] },
    });
    await createHandleClient(conn, {}, recordingFactories(calls));
    assert.deepEqual(calls, ["viem"]);
  });

  it("throws when neither toolbox is present", async () => {
    await assert.rejects(
      () => createHandleClient(connectionWith({}), {}, recordingFactories([])),
      /No supported Hardhat toolbox/,
    );
  });
});
