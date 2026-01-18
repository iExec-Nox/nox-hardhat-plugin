import type { HardhatRuntimeEnvironmentHooks } from "hardhat/types/hooks";

import { createCoreMockRuntime } from "../core.js";

export default async (): Promise<Partial<HardhatRuntimeEnvironmentHooks>> => ({
  created: async (_context, hre) => {
    hre.coreMock = createCoreMockRuntime(hre);
  },
});
