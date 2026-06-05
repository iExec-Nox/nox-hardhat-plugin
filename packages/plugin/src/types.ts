import type { Abi, Address, Hex } from "viem";

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

/** A chain Nox is deployed on, paired with its canonical NoxCompute proxy. */
export interface NoxChain {
  chainId: number;
  noxComputeProxyAddress: Address;
}
