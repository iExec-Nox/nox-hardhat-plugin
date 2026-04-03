import type { HandleClient } from "@iexec-nox/handle";
import type { WalletClient } from "viem";

// ─── User-facing config (hardhat.config.ts) ───────────────────────────────────

export interface NoxPortsConfig {
  rpc?: number;
  nats?: number;
  natsMonitor?: number;
  s3?: number;
  kms?: number;
  gateway?: number;
  ingestor?: number;
  runner?: number;
}

export interface NoxUserConfig {
  enabled?: boolean;
  /**
   * Address of the deployed NoxCompute proxy contract on the forked chain.
   *
   * Arbitrum Sepolia: 0xd464B198f06756a1d00be223634b85E0a731c229
   */
  contractAddress?: string;
  ports?: NoxPortsConfig;
}

// ─── Resolved config (all fields present, defaults applied) ───────────────────

export interface NoxResolvedPorts {
  rpc: number;
  nats: number;
  natsMonitor: number;
  s3: number;
  kms: number;
  gateway: number;
  ingestor: number;
  runner: number;
}

export interface NoxResolvedConfig {
  enabled: boolean;
  contractAddress?: string;
  ports: NoxResolvedPorts;
  keys: NoxResolvedKeys;
}

// ─── Internal keys — never exposed to the user ───────────────────────────────
// Deterministic well-known keys derived from Hardhat's default mnemonic:
//   "test test test test test test test test test test test junk"
// NEVER use these on mainnet.

export interface NoxResolvedKeys {
  kms: { walletKey: string; eccKey: string; eccPublicKey: string };
  gateway: { walletKey: string };
  runner: { walletKey: string };
}

// ─── Runtime API (attached to NetworkConnection as conn.nox) ─────────────────

export interface NoxRuntime {
  /** Create an SDK HandleClient backed by the local stack. */
  createHandleClient(walletClient: WalletClient): Promise<HandleClient>;

  /** Returns the address of the NoxCompute contract in use. */
  getContractAddress(): string;

  /**
   * Poll the Gateway until the key material for `resultHandle` is available,
   * then resolve.
   *
   * Pass the RESULT handle (from your contract's state after the compute tx
   * has mined), not the input handle returned by `encryptInput`.
   *
   * @param resultHandle  The handle to poll for.
   * @param handleClient  SDK client used to generate the auth probe.
   * @param timeoutMs     Maximum wait in milliseconds (default 30 000).
   */
  waitForCompute(
    resultHandle: string,
    handleClient: HandleClient,
    timeoutMs?: number,
  ): Promise<void>;
}
