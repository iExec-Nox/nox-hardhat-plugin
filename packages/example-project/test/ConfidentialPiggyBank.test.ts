/**
 * Integration test: Confidential Piggy Bank (Nox Hello World).
 *
 * Demonstrates the full Nox flow using the @iexec-nox/hardhat-nox plugin:
 *   1. Connect to the local Hardhat network → plugin starts the Nox off-chain stack.
 *   2. Deploy ConfidentialPiggyBank (a contract that stores an encrypted uint256 balance).
 *   3. Encrypt a deposit amount using the HandleClient SDK.
 *   4. Call deposit() on-chain with the encrypted handle + proof.
 *   5. Wait for the Nox pipeline to process the compute request.
 *   6. Read back the encrypted balance handle and decrypt it.
 *   7. Assert the decrypted value matches.
 *
 * Prerequisites (test skips when missing):
 *   - Nox binaries in ~/bin/nox/  (run `nox-build` to populate)
 *   - `pnpm install` at workspace root (installs this package's deps)
 *
 * Reference: https://github.com/iExec-Nox/nox-handle-sdk/blob/main/README.md
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { describe, it, before, after } from "node:test";

import {
  createHardhatRuntimeEnvironment,
  importUserConfig,
  resolveHardhatConfigPath,
} from "hardhat/hre";
import { createWalletClient, custom, encodeFunctionData, decodeFunctionResult } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Hardhat default account #0 — matches DEFAULT_KEYS.kms.walletKey in the plugin.
// See: https://hardhat.org/hardhat-network/docs/reference#accounts
const HARDHAT_ACCOUNT_0_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

// ─── Contract artifact — loaded from Hardhat compilation output ───────────────
// Always reflects the current compiled source; never goes stale.

const _artifact = JSON.parse(
  readFileSync(
    path.join(
      import.meta.dirname,
      "../artifacts/contracts/ConfidentialPiggyBank.sol/ConfidentialPiggyBank.json",
    ),
    "utf8",
  ),
) as { bytecode: string; abi: unknown[] };

const PIGGY_BANK_BYTECODE = _artifact.bytecode as `0x${string}`;
const PIGGY_BANK_ABI = _artifact.abi as [
  { type: "constructor"; inputs: []; stateMutability: "nonpayable" },
  { name: "balance"; type: "function"; inputs: []; outputs: [{ name: ""; type: "bytes32" }]; stateMutability: "view" },
  { name: "deposit"; type: "function"; inputs: [{ name: "inputHandle"; type: "bytes32" }, { name: "inputProof"; type: "bytes" }]; outputs: []; stateMutability: "nonpayable" },
  { name: "withdraw"; type: "function"; inputs: [{ name: "inputHandle"; type: "bytes32" }, { name: "inputProof"; type: "bytes" }]; outputs: []; stateMutability: "nonpayable" },
  { name: "owner"; type: "function"; inputs: []; outputs: [{ name: ""; type: "address" }]; stateMutability: "view" },
];

// ─── Guard ────────────────────────────────────────────────────────────────────

// Mirror BinaryResolver.ts default: ~/.cache/hardhat-nox/poc/<os>-<arch>/
// Each binary can be overridden via NOX_BIN_<NAME> env vars (same as the plugin).
const _arch = process.arch === "arm64" ? "arm64" : "x64";
const _os = process.platform === "darwin" ? "darwin" : "linux";
const NOX_BIN_DIR = path.join(homedir(), ".cache", "hardhat-nox", "poc", `${_os}-${_arch}`);
const NOX_BINS_AVAILABLE =
  (process.env["NOX_BIN_NATS"] ? true : existsSync(path.join(NOX_BIN_DIR, "nats-server"))) &&
  (process.env["NOX_BIN_MINIO"] ? true : existsSync(path.join(NOX_BIN_DIR, "minio"))) &&
  (process.env["NOX_BIN_KMS"] ? true : existsSync(path.join(NOX_BIN_DIR, "nox-kms"))) &&
  (process.env["NOX_BIN_GATEWAY"] ? true : existsSync(path.join(NOX_BIN_DIR, "nox-handle-gateway"))) &&
  (process.env["NOX_BIN_INGESTOR"] ? true : existsSync(path.join(NOX_BIN_DIR, "nox-ingestor"))) &&
  (process.env["NOX_BIN_RUNNER"] ? true : existsSync(path.join(NOX_BIN_DIR, "nox-runner")));

describe(
  "ConfidentialPiggyBank (hello world)",
  {
    skip: NOX_BINS_AVAILABLE
      ? false
      : "Nox binaries not found in ~/bin/nox/ — run `nox-build` first",
  },
  () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let hre: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let conn: any;

    before(async () => {
      const configPath = await resolveHardhatConfigPath(
        path.join(import.meta.dirname, "../hardhat.config.ts"),
      );
      const userConfig = await importUserConfig(configPath);
      hre = await createHardhatRuntimeEnvironment(
        userConfig,
        { config: configPath },
        path.dirname(configPath),
      );
      // Connecting triggers the newConnection hook → starts NATS, MinIO, KMS,
      // Gateway, Ingestor, Runner, and deploys NoxCompute on the local chain.
      conn = await hre.network.connect();
    });

    after(async () => {
      if (conn) await conn.close();
    });

    it("deposits and reads back an encrypted balance", async () => {
      const ownerKey = HARDHAT_ACCOUNT_0_KEY;
      const ownerAccount = privateKeyToAccount(ownerKey);

      // ── 1. Wallet client backed by the Hardhat network ───────────────────────
      const walletClient = createWalletClient({
        chain: arbitrumSepolia,
        transport: custom(conn.provider),
        account: ownerAccount,
      });

      // ── 2. Deploy ConfidentialPiggyBank ──────────────────────────────────────
      const deployTxHash = (await conn.provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: ownerAccount.address,
            data: PIGGY_BANK_BYTECODE,
            gas: "0x500000",
          },
        ],
      })) as `0x${string}`;

      const receipt = (await conn.provider.request({
        method: "eth_getTransactionReceipt",
        params: [deployTxHash],
      })) as { contractAddress: `0x${string}` };

      const piggyBankAddress = receipt.contractAddress;
      assert.ok(piggyBankAddress, "contract address must be set");

      // ── 3. HandleClient via conn.nox ─────────────────────────────────────────
      const handleClient = await conn.nox.createHandleClient(walletClient);

      // ── 4. Encrypt a deposit amount ──────────────────────────────────────────
      const depositAmount = 100n;
      const { handle, handleProof } = await handleClient.encryptInput(
        depositAmount,
        "uint256",
        piggyBankAddress,
      );

      // ── 5. deposit() on-chain ────────────────────────────────────────────────
      const depositData = encodeFunctionData({
        abi: PIGGY_BANK_ABI,
        functionName: "deposit",
        args: [handle as `0x${string}`, handleProof as `0x${string}`],
      });
      await conn.provider.request({
        method: "eth_sendTransaction",
        params: [{ from: ownerAccount.address, to: piggyBankAddress, data: depositData }],
      });

      // ── 6. Read encrypted balance handle ────────────────────────────────────
      // The NoxCompute contract allocates the result handle synchronously during
      // the deposit() transaction, so balance() is non-zero immediately after
      // the tx mines — before the Runner has processed the compute.
      const balanceCallResult = (await conn.provider.request({
        method: "eth_call",
        params: [{ to: piggyBankAddress, data: encodeFunctionData({ abi: PIGGY_BANK_ABI, functionName: "balance" }) }],
      })) as `0x${string}`;

      const balanceHandle = decodeFunctionResult({
        abi: PIGGY_BANK_ABI,
        functionName: "balance",
        data: balanceCallResult,
      }) as unknown as `0x${string}`;

      // ── 7. Wait for the off-chain pipeline ──────────────────────────────────
      // Poll until the Runner has stored the key material for the result handle.
      // waitForCompute uses handleClient.decrypt() as an authenticated probe —
      // the Gateway always returns 401 for unauthenticated requests, so auth is
      // required to distinguish "not found yet" (404) from "ready" (200).
      await conn.nox.waitForCompute(balanceHandle, handleClient, 60_000);

      // ── 8. Decrypt and assert ────────────────────────────────────────────────
      const { value: decryptedBalance } = await handleClient.decrypt(balanceHandle);
      assert.equal(
        decryptedBalance,
        depositAmount,
        "decrypted balance must equal deposited amount",
      );
    });
  },
);
