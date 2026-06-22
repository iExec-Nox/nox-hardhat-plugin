import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NetworkConnection } from "hardhat/types/network";
import type { WalletClient } from "viem";
import {
  asSingleAccountWalletClient,
  createHandleClient,
  type HandleClientFactories,
} from "../src/utils/handle-client.js";

const viemClient = { kind: "viem" };
const ethersClient = { kind: "ethers" };

interface Call {
  kind: "viem" | "ethers";
  client: unknown;
}

function recordingFactories(calls: Call[]): HandleClientFactories {
  return {
    viem: async (client: unknown) => {
      calls.push({ kind: "viem", client });
      return viemClient;
    },
    ethers: async (client: unknown) => {
      calls.push({ kind: "ethers", client });
      return ethersClient;
    },
  } as unknown as HandleClientFactories;
}

function connectionWith(props: object): NetworkConnection<"op"> {
  return props as unknown as NetworkConnection<"op">;
}

function fakeSigner(
  address: string | undefined,
  allAddresses: string[],
): WalletClient {
  return {
    account: address === undefined ? undefined : { address },
    getAddresses: async () => allAddresses,
  } as unknown as WalletClient;
}

describe("createHandleClient toolbox detection", () => {
  it("uses the viem factory when connection.viem is present", async () => {
    const calls: Call[] = [];
    const conn = connectionWith({
      viem: { getWalletClients: async () => ["wallet"] },
    });
    const client = await createHandleClient(
      conn,
      {},
      {
        factories: recordingFactories(calls),
      },
    );
    assert.deepEqual(
      calls.map((c) => c.kind),
      ["viem"],
    );
    assert.equal(client, viemClient);
  });

  it("uses the ethers factory when only connection.ethers is present", async () => {
    const calls: Call[] = [];
    const conn = connectionWith({
      ethers: { getSigners: async () => ["signer"] },
    });
    const client = await createHandleClient(
      conn,
      {},
      {
        factories: recordingFactories(calls),
      },
    );
    assert.deepEqual(
      calls.map((c) => c.kind),
      ["ethers"],
    );
    assert.equal(client, ethersClient);
  });

  it("prefers viem when both toolboxes are present", async () => {
    const calls: Call[] = [];
    const conn = connectionWith({
      viem: { getWalletClients: async () => ["wallet"] },
      ethers: { getSigners: async () => ["signer"] },
    });
    await createHandleClient(
      conn,
      {},
      { factories: recordingFactories(calls) },
    );
    assert.deepEqual(
      calls.map((c) => c.kind),
      ["viem"],
    );
  });

  it("throws when neither toolbox is present", async () => {
    await assert.rejects(
      () =>
        createHandleClient(
          connectionWith({}),
          {},
          {
            factories: recordingFactories([]),
          },
        ),
      /No supported Hardhat toolbox/,
    );
  });

  it("uses a single-account viem client when a signer is given", async () => {
    const calls: Call[] = [];
    // No toolbox on the connection: the explicit signer path must still work.
    const signer = fakeSigner("0xSigner", ["0xAccount0", "0xSigner"]);
    await createHandleClient(
      connectionWith({}),
      {},
      {
        signer,
        factories: recordingFactories(calls),
      },
    );
    assert.deepEqual(
      calls.map((c) => c.kind),
      ["viem"],
    );
    const passed = calls[0].client as WalletClient;
    assert.deepEqual(await passed.getAddresses(), ["0xSigner"]);
  });
});

describe("asSingleAccountWalletClient", () => {
  it("restricts getAddresses() to the signer's own account", async () => {
    const wallet = fakeSigner("0xSigner", ["0xAccount0", "0xSigner"]);
    assert.deepEqual(await asSingleAccountWalletClient(wallet).getAddresses(), [
      "0xSigner",
    ]);
  });

  it("leaves the original wallet client untouched", async () => {
    const wallet = fakeSigner("0xSigner", ["0xAccount0", "0xSigner"]);
    asSingleAccountWalletClient(wallet);
    assert.deepEqual(await wallet.getAddresses(), ["0xAccount0", "0xSigner"]);
  });

  it("throws when the signer has no account", () => {
    assert.throws(
      () => asSingleAccountWalletClient(fakeSigner(undefined, [])),
      /no account/,
    );
  });
});
