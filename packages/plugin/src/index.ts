import "./type-extensions.js";

import type { HardhatPlugin } from "hardhat/types/plugins";
export { cleanupNoxProcesses } from "./runtime/BinaryResolver.js";

const plugin: HardhatPlugin = {
  id: "@iexec-nox/hardhat-nox",
  npmPackage: "@iexec-nox/hardhat-nox",
  hookHandlers: {
    config: () => import("./hooks/config.js"),
    network: () => import("./hooks/network.js"),
  },
};

export default plugin;
