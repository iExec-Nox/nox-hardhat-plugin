import { overrideTask } from "hardhat/config";
import type { HardhatPlugin } from "hardhat/types/plugins";
import "./type-extensions.js";
export {
  NOX_CHAIN_ID,
  NOX_COMPUTE_PROXY_ADDRESS,
  NOX_COMPUTE_IMPL_ADDRESS,
  NOX_GATEWAY_ADDRESS,
  NOX_KMS_PUBLIC_KEY,
  HANDLE_GATEWAY_URL,
  RPC_URL,
} from "./nox-config.js";

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
