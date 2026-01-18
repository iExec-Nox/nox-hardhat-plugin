import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";
import type { HardhatPlugin } from "hardhat/types/plugins";

import "./type-extensions.js";

const plugin: HardhatPlugin = {
  id: "hardhat-core-mock",
  hookHandlers: {
    config: () => import("./hooks/config.js"),
    hre: () => import("./hooks/hre.js"),
    network: () => import("./hooks/network.js"),
  },
  tasks: [
    task("core:install", "Install the HelloWorld core contract.")
      .addOption({
        name: "force",
        description: "Overwrite existing code at the core address.",
        type: ArgumentType.BOOLEAN,
        defaultValue: false,
      })
      .setAction(() => import("./tasks/core-install.js"))
      .build(),
    task("core:status", "Show HelloWorld core contract status.")
      .setAction(() => import("./tasks/core-status.js"))
      .build(),
  ],
};

export default plugin;
