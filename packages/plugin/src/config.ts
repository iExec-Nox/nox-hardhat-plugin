import type { HardhatUserConfig } from "hardhat/config";
import type { HardhatConfig } from "hardhat/types/config";
import type { HardhatUserConfigValidationError } from "hardhat/types/hooks";

export const NOX_HOST_NETWORK = "noxHost";

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
 * Returns a copy of `userConfig` with the plugin's internal `noxHost`
 * EDR-simulated network injected into `networks`. A user-defined entry of the
 * same name wins (last spread).
 */
export function withNoxHostNetwork(
  userConfig: HardhatUserConfig,
): HardhatUserConfig {
  return {
    ...userConfig,
    networks: {
      [NOX_HOST_NETWORK]: { type: "edr-simulated", chainType: "op" },
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
