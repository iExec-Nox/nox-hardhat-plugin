import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import coreMock from "../plugin/src/index.js";

export default defineConfig({
  plugins: [hardhatEthers, coreMock],
  solidity: "0.8.29",
  networks: {
    hardhat: {
        type: "edr-simulated",
        chainType: "l1",
    },
},
});
