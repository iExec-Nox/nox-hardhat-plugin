import type { HandleClient } from "@iexec-nox/handle";
import type { NetworkConnection } from "hardhat/types/network";
import type { Abi, Address, Hex } from "viem";

export interface NoxPluginUserConfig {
  /**
   * When `true`, the plugin's `test` task override becomes a no-op: it runs
   * the original Hardhat `test` action without booting the offchain Nox stack
   * or etching NoxCompute, and without honoring any per-network `nox` config
   * either. Useful to iterate on pure-TypeScript tests. Defaults to `false`.
   */
  skipTestOverride?: boolean;
}

export interface NoxPluginConfig {
  skipTestOverride: boolean;
}

/**
 * Declarative pointer to an already-running Nox stack, carried by an
 * individual `http` network entry (`networks.<name>.nox`) rather than the
 * top-level plugin config. Presence on the network hardhat targets
 * makes the plugin skip its own local stack setup entirely.
 */
export interface NoxNetworkUserConfig {
  noxComputeAddress: Address;
  handleGatewayUrl: string;
}

/** Same shape as `NoxNetworkUserConfig` — purely declarative, no defaulting. */
export type NoxNetworkConfig = NoxNetworkUserConfig;

/** Minimal shape the plugin needs from a Hardhat/Ignition deployment artifact. */
export interface DeploymentArtifact {
  abi: Abi;
  bytecode: Hex;
  deployedBytecode: Hex;
}

/**
 * A network connection to the plugin's local Nox stack, augmented with a
 * pre-configured `@iexec-nox/handle` client.
 */
export type NoxConnection = NetworkConnection<"op"> & {
  handleClient: HandleClient;
};
