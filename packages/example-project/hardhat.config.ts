import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";
import noxPlugin from "@iexec-nox/nox-hardhat-plugin";
import { arbitrumSepolia, sepolia } from "viem/chains";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin, noxPlugin],
  solidity: "0.8.35",
  networks: {
    default: {
      type: "http",
      chainType: "op",
      chainId: arbitrumSepolia.id,
      url: "https://sepolia-rollup.arbitrum.io/rpc",
    },
    sepolia: {
      type: "http",
      chainType: "op",
      chainId: sepolia.id,
      url: "https://rpc.sepolia.org",
    },
  },
});
