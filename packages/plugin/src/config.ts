import type { HardhatUserConfig } from "hardhat/config";
import type { HardhatConfig } from "hardhat/types/config";
import type { HardhatUserConfigValidationError } from "hardhat/types/hooks";

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
