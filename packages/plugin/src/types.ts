import type { Abi, Hex } from "viem";

export interface MyPluginUserConfig {
  greeting?: string;
}

export interface MyPluginConfig {
  greeting: string;
}

/** Minimal shape the plugin needs from a Hardhat/Ignition deployment artifact. */
export interface DeploymentArtifact {
  abi: Abi;
  deployedBytecode: Hex;
}
