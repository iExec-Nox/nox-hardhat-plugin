import type { NoxResolvedConfig, NoxRuntime, NoxUserConfig } from "./types.js";

import "hardhat/types/config";
declare module "hardhat/types/config" {
  interface HardhatUserConfig {
    nox?: NoxUserConfig;
  }

  interface HardhatConfig {
    nox: NoxResolvedConfig;
  }
}

import "hardhat/types/network";
declare module "hardhat/types/network" {
  interface NetworkConnection<
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by Hardhat internals
    ChainTypeT extends ChainType | string = DefaultChainType,
  > {
    nox?: NoxRuntime;
  }
}
