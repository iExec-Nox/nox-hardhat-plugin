import type { HardhatUserConfig } from "hardhat/config";
import type { HardhatConfig } from "hardhat/types/config";
import type { HardhatUserConfigValidationError } from "hardhat/types/hooks";

export async function validatePluginConfig(
  userConfig: HardhatUserConfig,
): Promise<HardhatUserConfigValidationError[]> {
  const myConfig = userConfig.myConfig;
  if (myConfig === undefined) return [];

  if (typeof myConfig !== "object") {
    return [{ path: ["myConfig"], message: "Expected an object." }];
  }

  if (
    myConfig.skipTestOverride !== undefined &&
    typeof myConfig.skipTestOverride !== "boolean"
  ) {
    return [
      {
        path: ["myConfig", "skipTestOverride"],
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
    myConfig: {
      skipTestOverride: userConfig.myConfig?.skipTestOverride ?? false,
    },
  };
}
