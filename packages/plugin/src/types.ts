import type { HandleClient } from "@iexec-nox/handle";
import type { NetworkConnection } from "hardhat/types/network";
import type { Abi, Hex } from "viem";

export interface NoxPluginUserConfig {
  /**
   * When `true`, the plugin's `test` task override becomes a no-op: it runs
   * the original Hardhat `test` action without booting the offchain Nox stack
   * or etching NoxCompute. Useful to iterate on pure-TypeScript tests or to
   * point tests at an already-running stack. Defaults to `false`.
   */
  skipTestOverride?: boolean;
}

export interface NoxPluginConfig {
  skipTestOverride: boolean;
}

/** Minimal shape the plugin needs from a Hardhat/Ignition deployment artifact. */
export interface DeploymentArtifact {
  abi: Abi;
  deployedBytecode: Hex;
}

/**
 * A network connection to the plugin's local Nox stack, augmented with a
 * pre-configured `@iexec-nox/handle` client.
 */
export type NoxConnection = NetworkConnection<"op"> & {
  handleClient: HandleClient;
};
