import type { HardhatUserConfig } from "hardhat/config";
import type { HardhatConfig } from "hardhat/types/config";
import type { HardhatUserConfigValidationError } from "hardhat/types/hooks";
import { NOX_SUPPORTED_CHAIN_ID } from "./nox-config.js";

export const NOX_HOST_NETWORK = "noxHost";
export const NOX_LOCAL_NETWORK = "noxLocal";
export const NOX_LOCAL_PORT = 8545;

export async function validatePluginConfig(
  userConfig: HardhatUserConfig,
): Promise<HardhatUserConfigValidationError[]> {
  const nox = userConfig.nox;
  if (nox === undefined) return [];

  if (typeof nox !== "object") {
    return [{ path: ["nox"], message: "Expected an object." }];
  }

  if (
    nox.skipTestOverride !== undefined &&
    typeof nox.skipTestOverride !== "boolean"
  ) {
    return [
      {
        path: ["nox", "skipTestOverride"],
        message: "Expected a boolean.",
      },
    ];
  }

  if (
    nox.forceExitAfterTest !== undefined &&
    typeof nox.forceExitAfterTest !== "boolean"
  ) {
    return [
      {
        path: ["nox", "forceExitAfterTest"],
        message: "Expected a boolean.",
      },
    ];
  }

  return [];
}

/**
 * Returns a copy of `userConfig` with the plugin's internal networks injected:
 *   - `noxHost`: EDR-simulated, backs the JSON-RPC server we spawn.
 *   - `noxLocal`: HTTP, points at the local server (chainId 31337).
 *
 * User-supplied keys for `noxHost` / `noxLocal` are deep-merged so that
 * properties like custom `accounts` survive while required plugin settings
 * (e.g. `allowUnlimitedContractSize`) always remain set.
 */
export function withInjectedNetworks(
  userConfig: HardhatUserConfig,
): HardhatUserConfig {
  const userNetworks = userConfig.networks ?? {};
  const {
    [NOX_HOST_NETWORK]: userHost,
    [NOX_LOCAL_NETWORK]: userLocal,
    ...otherNetworks
  } = userNetworks;
  return {
    ...userConfig,
    networks: {
      [NOX_HOST_NETWORK]: {
        ...(userHost as object),
        // Required fields come after so users cannot accidentally override them.
        type: "edr-simulated",
        chainType: "op",
        // NoxCompute's bytecode exceeds EIP-170's 24 KB contract-size limit.
        allowUnlimitedContractSize: true,
      },
      [NOX_LOCAL_NETWORK]: {
        ...(userLocal as object),
        // Required fields come after so users cannot accidentally override them.
        type: "http",
        chainType: "op",
        chainId: NOX_SUPPORTED_CHAIN_ID,
        url: `http://127.0.0.1:${NOX_LOCAL_PORT}`,
      },
      ...otherNetworks,
    },
  };
}

export async function resolvePluginConfig(
  userConfig: HardhatUserConfig,
  partiallyResolvedConfig: HardhatConfig,
): Promise<HardhatConfig> {
  return {
    ...partiallyResolvedConfig,
    nox: {
      skipTestOverride: userConfig.nox?.skipTestOverride ?? false,
      forceExitAfterTest: userConfig.nox?.forceExitAfterTest ?? true,
    },
  };
}
