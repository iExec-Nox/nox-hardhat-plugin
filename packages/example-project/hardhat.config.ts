import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";
import noxPlugin, { NOX_CHAIN_ID } from "@iexec-nox/nox-hardhat-plugin";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin, noxPlugin],
  solidity: "0.8.35",
  networks: {
    default: {
      type: "edr-simulated",
      chainType: "op",
    },
    // TODO: drop this network once the plugin adapts to the user-selected
    // network (EDR simulated, mainnet fork, external http, …) and exposes
    // it directly via `hre.network.connect()`. Today the plugin hardcodes
    // an HTTP server on port 8545 so the e2e tests need a matching named
    // network to reach it.
    localhost: {
      type: "http",
      chainType: "op",
      chainId: NOX_CHAIN_ID,
      url: "http://127.0.0.1:8545",
    },
  },
});
