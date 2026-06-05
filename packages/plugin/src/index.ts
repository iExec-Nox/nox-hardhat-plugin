import { overrideTask } from "hardhat/config";
import type { HardhatPlugin } from "hardhat/types/plugins";
import "./type-extensions.js";
export {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
  NOX_COMPUTE_CONTRACT,
  HANDLE_GATEWAY_URL,
  RPC_URL,
} from "./nox-config.js";
export { nox } from "./nox.js";

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
