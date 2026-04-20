import { describe, it } from "node:test";
import { network } from "hardhat";
import { waitForHandleResolved } from "../utils/handle-gateway.js";

const INITIAL_SUPPLY = 1000n;

describe("MyConfidentialToken end-to-end", () => {
  it(
    "mints a confidential totalSupply that the Nox stack resolves and stores in S3",
    { timeout: 120_000 },
    async () => {
      // Connect to the HTTP node the plugin spins up — that's where NoxCompute
      // is injected and where the offchain Nox stack is listening. A fresh
      // in-memory EDR (the default) would have neither.
      const { viem } = await network.create("localhost");

      const token = await viem.deployContract("MyConfidentialToken", [
        "My Confidential Token",
        "MCT",
        "ipfs://example",
        INITIAL_SUPPLY,
      ]);

      const totalSupplyHandle = await token.read.confidentialTotalSupply();
      await waitForHandleResolved(totalSupplyHandle);

      // TODO: use the Nox SDK here to decrypt the totalSupply handle and
      // assert the cleartext value matches INITIAL_SUPPLY.
    },
  );
});
