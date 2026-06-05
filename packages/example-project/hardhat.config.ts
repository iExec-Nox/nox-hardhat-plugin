import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";
import noxPlugin, {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
} from "@iexec-nox/nox-hardhat-plugin";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin, noxPlugin],
  solidity: "0.8.35",
  networks: {
    default: {
      type: "http",
      chainType: "op",
      chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
      url: "https://sepolia-rollup.arbitrum.io/rpc",
    },
    sepolia: {
      type: "http",
      chainType: "op",
      chainId: SEPOLIA_CHAIN_ID,
      url: "https://rpc.sepolia.org",
    },
  },
});
