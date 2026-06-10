import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { nox } from "@iexec-nox/nox-hardhat-plugin";
import { waitForHandleResolved } from "../utils/handle-gateway.js";

const INITIAL_SUPPLY = 1000n;

describe("MyConfidentialToken end-to-end", () => {
  it(
    "mints a confidential totalSupply that the Nox stack resolves and matches the cleartext value",
    { timeout: 120_000 },
    async () => {
      const { viem, handleClient } = await nox.connect();

      const token = await viem.deployContract("MyConfidentialToken", [
        "My Confidential Token",
        "MCT",
        "ipfs://example",
        INITIAL_SUPPLY,
      ]);

      const totalSupplyHandle =
        (await token.read.confidentialTotalSupply()) as `0x${string}`;
      await waitForHandleResolved(totalSupplyHandle);

      const { value } = await handleClient.publicDecrypt(totalSupplyHandle);
      assert.equal(value, INITIAL_SUPPLY);
    },
  );
});
