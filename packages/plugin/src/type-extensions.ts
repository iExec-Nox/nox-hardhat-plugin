import {
  NoxNetworkConfig,
  NoxNetworkUserConfig,
  NoxPluginConfig,
  NoxPluginUserConfig,
} from "./types.js";

import "hardhat/types/config";
declare module "hardhat/types/config" {
  interface HardhatUserConfig {
    nox?: NoxPluginUserConfig;
  }

  interface HardhatConfig {
    nox: NoxPluginConfig;
  }

  // Only `http` networks can point at an existing stack
  interface HttpNetworkUserConfig {
    nox?: NoxNetworkUserConfig;
  }

  interface HttpNetworkConfig {
    nox?: NoxNetworkConfig;
  }
}
