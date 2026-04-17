import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";
import noxPlugin from "hardhat-my-plugin";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin, noxPlugin],
  solidity: {
    version: "0.8.29",
    npmFilesToBuild: [
      "@iexec-nox/nox-protocol-contracts/contracts/NoxCompute.sol",
    ],
  },
  networks: {
    default: {
      type: "edr-simulated",
      chainType: "op",
      allowUnlimitedContractSize: true,
    },
    local: {
      type: "http",
      url: "http://127.0.0.1:8545",
    },
  },
});
