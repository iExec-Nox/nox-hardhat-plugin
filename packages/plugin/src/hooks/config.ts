import type { ConfigHooks } from "hardhat/types/hooks";
import { resolvePluginConfig, validatePluginConfig } from "../config.js";

const NOX_COMPUTE_SOL =
  "@iexec-nox/nox-protocol-contracts/contracts/NoxCompute.sol";

export default async (): Promise<Partial<ConfigHooks>> => {
  const handlers: Partial<ConfigHooks> = {
    // Force Hardhat to compile NoxCompute.sol from the npm package so the
    // plugin can read its deployedBytecode at `hardhat_setCode` time.
    async extendUserConfig(userConfig, next) {
      const config = await next(userConfig);
      const solidity =
        typeof config.solidity === "object" && !Array.isArray(config.solidity)
          ? config.solidity
          : {};
      const existing = solidity.npmFilesToBuild ?? [];
      if (existing.includes(NOX_COMPUTE_SOL)) return config;
      return {
        ...config,
        solidity: {
          ...solidity,
          npmFilesToBuild: [...existing, NOX_COMPUTE_SOL],
        },
      };
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
