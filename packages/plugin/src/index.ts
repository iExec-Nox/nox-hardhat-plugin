import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";
import type { HardhatPlugin } from "hardhat/types/plugins";

import "./type-extensions.js";

const plugin: HardhatPlugin = {
  id: "hardhat-my-plugin",
  hookHandlers: {
    config: () => import("./hooks/config.js"),
    network: () => import("./hooks/network.js"),
  },
  tasks: [
    task("my-task", "Prints a greeting.")
      .addOption({
        name: "who",
        description: "Who is receiving the greeting.",
        type: ArgumentType.STRING,
        defaultValue: "Hardhat",
      })
      .setAction(() => import("./tasks/my-task.js"))
      .build(),
    task("nox:start-stack", "Start the local Nox docker stack.")
      .setAction(() => import("./tasks/start-stack.js"))
      .build(),
    task("nox:stop-stack", "Stop the local Nox docker stack.")
      .setAction(() => import("./tasks/stop-stack.js"))
      .build(),
  ],
};

export default plugin;
