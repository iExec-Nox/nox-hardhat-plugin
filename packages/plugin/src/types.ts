import type {
  EthereumAddress,
  Handle,
  HexString,
  JsValue,
  SolidityType,
} from "@iexec-nox/handle";
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
 * A network connection to the target Nox stack (the plugin's local stack, or
 * an existing one declared via a network's `nox` config) augmented with encryption
 * and decryption methods
 */
export type NoxConnection = NetworkConnection<"op"> & {
  readonly noxComputeAddress: Address;
  readonly handleGatewayUrl: string;
  encryptInput<T extends SolidityType>(
    value: JsValue<T>,
    solidityType: T,
    applicationContract: EthereumAddress,
  ): Promise<{ handle: Handle<T>; handleProof: HexString }>;
  decrypt<T extends SolidityType>(
    handle: Handle<T>,
  ): Promise<{ value: JsValue<T>; solidityType: T }>;
  publicDecrypt<T extends SolidityType>(
    handle: Handle<T>,
  ): Promise<{
    value: JsValue<T>;
    solidityType: T;
    decryptionProof: HexString;
  }>;
};
