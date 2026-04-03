import type { ConfigHooks } from "hardhat/types/hooks";
import { validateNoxConfig, resolveNoxConfig } from "../config.js";

export default async (): Promise<Partial<ConfigHooks>> => {
  const handlers: Partial<ConfigHooks> = {
    async validateUserConfig(userConfig) {
      return validateNoxConfig(userConfig.nox ?? {});
    },

    async resolveUserConfig(userConfig, resolveConfigurationVariable, next) {
      const partiallyResolvedConfig = await next(
        userConfig,
        resolveConfigurationVariable,
      );
      const nox = resolveNoxConfig(userConfig.nox ?? {});
      return { ...partiallyResolvedConfig, nox };
    },
  };

  return handlers;
};
