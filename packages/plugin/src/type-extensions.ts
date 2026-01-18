import { CoreMockConfig, CoreMockRuntime, CoreMockUserConfig } from "./types.js";

import "hardhat/types/config";
declare module "hardhat/types/config" {
  interface HardhatUserConfig {
    coreMock?: CoreMockUserConfig;
  }

  interface HardhatConfig {
    coreMock: CoreMockConfig;
  }
}

import "hardhat/types/hre";
declare module "hardhat/types/hre" {
  interface HardhatRuntimeEnvironment {
    coreMock: CoreMockRuntime;
  }
}

import "hardhat/types/network";
declare module "hardhat/types/network" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Delete this line if you add fields to the NetworkConnection type
  interface NetworkConnection<
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- You can ignore or remove this type parameters if your plugin doesn't use them
    ChainTypeT extends ChainType | string = DefaultChainType,
  > {
    // Add your network connection properties here
  }
}
