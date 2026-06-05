import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { createViemHandleClient } from "@iexec-nox/handle";
import {
  HANDLE_GATEWAY_URL,
  NOX_COMPUTE_CONTRACT,
} from "@iexec-nox/nox-hardhat-plugin";
import { waitForHandleResolved } from "../utils/handle-gateway.js";

const INITIAL_SUPPLY = 1000n;

describe("MyConfidentialToken end-to-end", () => {
  it(
    "mints a confidential totalSupply that the Nox stack resolves and matches the cleartext value",
    { timeout: 360_000 },
    async () => {
      // Connect to the HTTP node the plugin spins up — that's where NoxCompute
      // is injected and where the offchain Nox stack is listening. A fresh
      // in-memory EDR (the default) would have neither.
      const { viem } = await network.create();

      const token = await viem.deployContract("MyConfidentialToken", [
        "My Confidential Token",
        "MCT",
        "ipfs://example",
        INITIAL_SUPPLY,
      ]);

      const totalSupplyHandle =
        (await token.read.confidentialTotalSupply()) as `0x${string}`;
      await waitForHandleResolved(totalSupplyHandle);

      const [walletClient] = await viem.getWalletClients();
      const handleClient = await createViemHandleClient(walletClient, {
        smartContractAddress: NOX_COMPUTE_CONTRACT[walletClient.chain.id],
        gatewayUrl: HANDLE_GATEWAY_URL,
        // For local dev we don't use the subgraph (publicDecrypt only hits the
        // gateway and the chain) but the config validator still requires a URL.
        subgraphUrl: "https://example.com/subgraphs/id/none",
      });
      const { value } = await handleClient.publicDecrypt(totalSupplyHandle);
      assert.equal(value, INITIAL_SUPPLY);
    },
  );
});
