import { defineConfig } from "hardhat/config";
import NoxPlugin from "@iexec-nox/hardhat-nox";

export default defineConfig({
  plugins: [NoxPlugin],
  solidity: {
    version: "0.8.28",
  },
  chainDescriptors: {
    421614: {
      name: "Arbitrum Sepolia",
      hardforkHistory: {
        cancun: { blockNumber: 0 },
      },
    },
  },
  networks: {
    default: {
      type: "edr-simulated",
      chainId: 421614,
      forking: {
        enabled: true,
        url:
          process.env["ARBITRUM_SEPOLIA_RPC_URL"] ??
          "https://sepolia-rollup.arbitrum.io/rpc",
      },
    },
  },
  nox: {
    enabled: true,
  },
});
