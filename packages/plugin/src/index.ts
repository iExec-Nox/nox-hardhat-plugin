import { overrideTask, task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";
import type { HardhatPlugin } from "hardhat/types/plugins";
import "./type-extensions.js";
export {
  NOX_COMPUTE_PROXY_ADDRESS,
  NOX_COMPUTE_IMPL_ADDRESS,
  NOX_GATEWAY_ADDRESS,
  NOX_KMS_PUBLIC_KEY,
  HANDLE_GATEWAY_URL,
  RPC_URL,
} from "./nox-config.js";

const plugin: HardhatPlugin = {
  // TODO: rename id to `nox-hardhat-plugin` once the package is renamed
  id: "hardhat-my-plugin",
  hookHandlers: {
    config: () => import("./hooks/config.js"),
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
    overrideTask("test")
      .setAction(() => import("./tasks/test-override.js"))
      .build(),
  ],
};

export default plugin;
