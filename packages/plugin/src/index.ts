import { overrideTask } from "hardhat/config";
import type { HardhatPlugin } from "hardhat/types/plugins";

const plugin: HardhatPlugin = {
  id: "nox-hardhat-plugin",
  hookHandlers: {
    config: () => import("./hooks/config.js"),
  },
  tasks: [
    overrideTask("test")
      .setAction(() => import("./tasks/test-override.js"))
      .build(),
  ],
};

export default plugin;
