import { NoxNetworkConfig, NoxNetworkUserConfig } from "./types.js";

import "hardhat/types/config";
declare module "hardhat/types/config" {
  // Only `http` networks can point at an existing stack
  interface HttpNetworkUserConfig {
    nox?: NoxNetworkUserConfig;
  }

  interface HttpNetworkConfig {
    nox?: NoxNetworkConfig;
  }
}
