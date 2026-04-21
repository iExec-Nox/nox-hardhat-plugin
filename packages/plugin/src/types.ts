import type { Abi, Hex } from "viem";

// TODO: rename `MyPluginUserConfig` / `MyPluginConfig` (and the `myConfig`
// namespace they extend on HardhatUserConfig/HardhatConfig) to something
// Nox-specific — e.g. `NoxPluginUserConfig` / `nox` — when we rename the
// package from `hardhat-my-plugin` to `nox-hardhat-plugin`.
export interface MyPluginUserConfig {
  /**
   * When `true`, the plugin's `test` task override becomes a no-op: it runs
   * the original Hardhat `test` action without booting the offchain Nox stack
   * or etching NoxCompute. Useful to iterate on pure-TypeScript tests or to
   * point tests at an already-running stack. Defaults to `false`.
   */
  skipTestOverride?: boolean;
}

export interface MyPluginConfig {
  skipTestOverride: boolean;
}

/** Minimal shape the plugin needs from a Hardhat/Ignition deployment artifact. */
export interface DeploymentArtifact {
  abi: Abi;
  deployedBytecode: Hex;
}

/** Minimal shape the plugin needs from a Hardhat/Ignition deployment artifact. */
export interface DeploymentArtifact {
  abi: Abi;
  deployedBytecode: Hex;
}
