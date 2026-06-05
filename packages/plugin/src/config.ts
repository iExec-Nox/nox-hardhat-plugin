import type { HardhatUserConfig } from "hardhat/config";
import type { HardhatConfig } from "hardhat/types/config";
import type { HardhatUserConfigValidationError } from "hardhat/types/hooks";

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

  return [];
}

/**
 * Returns a copy of `userConfig` with the plugin's internal networks injected:
 *   - `noxHost`: EDR-simulated, backs the JSON-RPC server we spawn.
 *   - `noxLocal`: HTTP, points at the local server. `chainId` is filled in at
 *     task time once we know which user network is active (so the same
 *     injection works for every chain the plugin supports).
 * User-defined entries with the same names win (last spread).
 */
export function withInjectedNetworks(
  userConfig: HardhatUserConfig,
): HardhatUserConfig {
  return {
    ...userConfig,
    networks: {
      [NOX_HOST_NETWORK]: { type: "edr-simulated", chainType: "op" },
      [NOX_LOCAL_NETWORK]: {
        type: "http",
        chainType: "op",
        url: `http://127.0.0.1:${NOX_LOCAL_PORT}`,
      },
      ...userConfig.networks,
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
    },
  };
}
