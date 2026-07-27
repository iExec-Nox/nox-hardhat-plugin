import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { NetworkConnection } from "hardhat/types/network";
import { deployNoxCompute } from "../src/utils/nox-compute.js";

// The plugin package's own root resolves `@iexec-nox/nox-protocol-contracts`
// (a peerDependency, present here via the workspace) so artifact loading
// succeeds without needing a fixture consumer project.
const CONSUMER_ROOT = path.resolve(import.meta.dirname, "..");

// Only the ephemeral-connection try/finally lifecycle is unit-tested here —
// the full deploy -> extract -> etch -> initialize happy path already runs
// end-to-end against a real EDR node and the real oversized NoxCompute
// contract in the Docker-backed integration suite
// (packages/example-project/test/integration/stack.test.ts). Faking that
// much of viem's RPC surface (eth_sendTransaction, eth_getTransactionReceipt,
// eth_getCode, eth_accounts, ...) here would be low-value duplication.
describe("deployNoxCompute", () => {
  it("closes the ephemeral connection even when the ephemeral-side deploy throws", async () => {
    let closeCalls = 0;
    const ephemeralConnection = {
      provider: {
        request: async () => {
          throw new Error("boom");
        },
      },
      close: async () => {
        closeCalls++;
      },
    };
    const hre = {
      config: { paths: { root: CONSUMER_ROOT } },
      network: {
        create: async () => ephemeralConnection,
      },
    } as unknown as HardhatRuntimeEnvironment;

    const connection = {
      networkName: "default",
      chainType: "op",
      provider: {
        request: async () => {
          throw new Error("[test] target connection should not be reached");
        },
      },
    } as unknown as NetworkConnection<"op">;

    await assert.rejects(() =>
      deployNoxCompute(
        hre,
        connection,
        "0x0000000000000000000000000000000000000001",
      ),
    );
    assert.equal(closeCalls, 1);
  });
});
