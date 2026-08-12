import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EthereumAddress } from "@iexec-nox/handle";
import type { NetworkConnection } from "hardhat/types/network";
import {
  createHandleClient,
  type HandleClientFactories,
} from "../src/utils/handle-client.js";

const viemClientResult = { kind: "viem" };
const ethersClientResult = { kind: "ethers" };

function capturingFactories(): HandleClientFactories & {
  viemCalls: unknown[];
  ethersCalls: unknown[];
} {
  const viemCalls: unknown[] = [];
  const ethersCalls: unknown[] = [];
  return {
    viemCalls,
    ethersCalls,
    viem: async (walletClient: unknown) => {
      viemCalls.push(walletClient);
      return viemClientResult;
    },
    ethers: async (signer: unknown) => {
      ethersCalls.push(signer);
      return ethersClientResult;
    },
  } as unknown as HandleClientFactories & {
    viemCalls: unknown[];
    ethersCalls: unknown[];
  };
}

function connectionWith(props: object): NetworkConnection<"op"> {
  return props as unknown as NetworkConnection<"op">;
}

const walletA = {
  account: { address: "0xAAA0000000000000000000000000000000AAA0" },
};
const walletB = {
  account: { address: "0xBBB0000000000000000000000000000000BBB0" },
};

function ethersSigner(address: string) {
  return { getAddress: async () => address };
}

describe("createHandleClient toolbox detection", () => {
  it("uses the viem factory when connection.viem is present", async () => {
    const factories = capturingFactories();
    const conn = connectionWith({
      viem: { getWalletClients: async () => [walletA] },
    });
    const client = await createHandleClient(conn, {}, undefined, factories);
    assert.equal(factories.viemCalls.length, 1);
    assert.equal(client, viemClientResult);
  });

  it("uses the ethers factory when only connection.ethers is present", async () => {
    const factories = capturingFactories();
    const conn = connectionWith({
      ethers: { getSigners: async () => [ethersSigner("0xCCC")] },
    });
    const client = await createHandleClient(conn, {}, undefined, factories);
    assert.equal(factories.ethersCalls.length, 1);
    assert.equal(client, ethersClientResult);
  });

  it("prefers viem when both toolboxes are present", async () => {
    const factories = capturingFactories();
    const conn = connectionWith({
      viem: { getWalletClients: async () => [walletA] },
      ethers: { getSigners: async () => [ethersSigner("0xCCC")] },
    });
    await createHandleClient(conn, {}, undefined, factories);
    assert.equal(factories.viemCalls.length, 1);
    assert.equal(factories.ethersCalls.length, 0);
  });

  it("throws when neither toolbox is present", async () => {
    await assert.rejects(
      () =>
        createHandleClient(
          connectionWith({}),
          {},
          undefined,
          capturingFactories(),
        ),
      /No supported Hardhat toolbox/,
    );
  });
});

describe("createHandleClient account selection", () => {
  it("defaults to the first wallet client when no account is given (viem)", async () => {
    const factories = capturingFactories();
    const conn = connectionWith({
      viem: { getWalletClients: async () => [walletA, walletB] },
    });
    await createHandleClient(conn, {}, undefined, factories);
    assert.equal(factories.viemCalls[0], walletA);
  });

  it("defaults to the first signer when no account is given (ethers)", async () => {
    const factories = capturingFactories();
    const signerA = ethersSigner("0xCCC0000000000000000000000000000000CCC0");
    const signerB = ethersSigner("0xDDD0000000000000000000000000000000DDD0");
    const conn = connectionWith({
      ethers: { getSigners: async () => [signerA, signerB] },
    });
    await createHandleClient(conn, {}, undefined, factories);
    assert.equal(factories.ethersCalls[0], signerA);
  });

  it("resolves the wallet client matching the given account, case-insensitively (viem)", async () => {
    const factories = capturingFactories();
    const conn = connectionWith({
      viem: { getWalletClients: async () => [walletA, walletB] },
    });
    await createHandleClient(
      conn,
      {},
      walletB.account.address.toLowerCase() as EthereumAddress,
      factories,
    );
    assert.equal(factories.viemCalls[0], walletB);
  });

  it("resolves the signer matching the given account, case-insensitively (ethers)", async () => {
    const factories = capturingFactories();
    const signerA = ethersSigner("0xCCC0000000000000000000000000000000CCC0");
    const signerB = ethersSigner("0xDDD0000000000000000000000000000000DDD0");
    const conn = connectionWith({
      ethers: { getSigners: async () => [signerA, signerB] },
    });
    await createHandleClient(
      conn,
      {},
      "0xddd0000000000000000000000000000000ddd0" as EthereumAddress,
      factories,
    );
    assert.equal(factories.ethersCalls[0], signerB);
  });

  it("throws a clear error listing available addresses when the account is unknown (viem)", async () => {
    const conn = connectionWith({
      viem: { getWalletClients: async () => [walletA, walletB] },
    });
    await assert.rejects(
      () =>
        createHandleClient(
          conn,
          {},
          "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead" as EthereumAddress,
          capturingFactories(),
        ),
      /\[nox\] account "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead" not found among connection accounts\. Available: 0xAAA0000000000000000000000000000000AAA0, 0xBBB0000000000000000000000000000000BBB0/,
    );
  });

  it("throws a clear error listing available addresses when the account is unknown (ethers)", async () => {
    const signerA = ethersSigner("0xCCC0000000000000000000000000000000CCC0");
    const signerB = ethersSigner("0xDDD0000000000000000000000000000000DDD0");
    const conn = connectionWith({
      ethers: { getSigners: async () => [signerA, signerB] },
    });
    await assert.rejects(
      () =>
        createHandleClient(
          conn,
          {},
          "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead" as EthereumAddress,
          capturingFactories(),
        ),
      /\[nox\] account "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead" not found among connection accounts\. Available: 0xCCC0000000000000000000000000000000CCC0, 0xDDD0000000000000000000000000000000DDD0/,
    );
  });
});
