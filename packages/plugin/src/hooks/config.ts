import type { HardhatUserConfig } from "hardhat/types/config";
import type { ConfigHooks } from "hardhat/types/hooks";
import { resolvePluginConfig, validatePluginConfig } from "../config.js";

const NOX_COMPUTE_SOL =
  "@iexec-nox/nox-protocol-contracts/contracts/NoxCompute.sol";

export default async (): Promise<Partial<ConfigHooks>> => {
  const handlers: Partial<ConfigHooks> = {
    // Force Hardhat to compile NoxCompute.sol from the npm package so the
    // plugin can read its deployedBytecode at `hardhat_setCode` time.
    async extendUserConfig(userConfig, next) {
      return addNoxComputeToNpmFilesToBuild(await next(userConfig));
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

function addNoxComputeToNpmFilesToBuild(
  config: HardhatUserConfig,
): HardhatUserConfig {
  // No solidity config → user is not compiling any contract → skip.
  if (config.solidity === undefined) return config;

  // `solidity` may be a string shorthand (e.g. "0.8.29"), a string array, or
  // an object. Normalize to the object form so we can add `npmFilesToBuild`.
  const asObject =
    typeof config.solidity === "string"
      ? { version: config.solidity }
      : Array.isArray(config.solidity)
        ? { versions: config.solidity }
        : config.solidity;

  const existing =
    (asObject as { npmFilesToBuild?: string[] }).npmFilesToBuild ?? [];
  if (existing.includes(NOX_COMPUTE_SOL)) return config;

  return {
    ...config,
    solidity: {
      ...asObject,
      npmFilesToBuild: [...existing, NOX_COMPUTE_SOL],
    } as HardhatUserConfig["solidity"],
  };
}
