import type { ConfigHooks } from "hardhat/types/hooks";
import {
  resolvePluginConfig,
  validatePluginConfig,
  withNoxHostNetwork,
} from "../config.js";

export default async (): Promise<Partial<ConfigHooks>> => {
  const handlers: Partial<ConfigHooks> = {
    async extendUserConfig(userConfig, next) {
      return next(withNoxHostNetwork(userConfig));
    },
    async validateUserConfig(userConfig) {
      return validatePluginConfig(userConfig);
    },
    async resolveUserConfig(userConfig, resolveConfigurationVariable, next) {
      const partiallyResolvedConfig = await next(
        userConfig,
        resolveConfigurationVariable,
      );
      return resolvePluginConfig(userConfig, partiallyResolvedConfig);
    },
  };

  return handlers;
};
