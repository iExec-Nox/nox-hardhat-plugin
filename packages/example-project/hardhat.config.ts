import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";
import noxPlugin from "@iexec-nox/nox-hardhat-plugin";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin, noxPlugin],
  solidity: "0.8.29",
  networks: {
    default: {
      type: "edr-simulated",
      chainType: "op",
      // TODO: make this configurable — the offchain stack in the plugin's
      // `offchain-services/dev.env` (NOX_CHAIN_ID + NOX_COMPUTE_CONTRACT) also
      // needs to follow whatever chain id is picked here.
      chainId: 421614,
      allowUnlimitedContractSize: true,
    },
    // HTTP connection to the plugin-hosted node — used by e2e tests.
    localhost: {
      type: "http",
      chainType: "op",
      chainId: 421614,
      url: "http://127.0.0.1:8545",
    },
  },
});
