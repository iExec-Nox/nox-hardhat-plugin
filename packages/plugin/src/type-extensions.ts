import { NoxPluginConfig, NoxPluginUserConfig } from "./types.js";

import "hardhat/types/config";
declare module "hardhat/types/config" {
  interface HardhatUserConfig {
    nox?: NoxPluginUserConfig;
  }

  interface HardhatConfig {
    nox: NoxPluginConfig;
  }
}
