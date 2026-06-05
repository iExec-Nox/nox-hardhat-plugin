import { NOX_LOCAL_NETWORK } from "./config.js";

/** Public entry point for connecting to the plugin's local Nox network. */
export const nox = {
  async connect() {
    const { network } = await import("hardhat");
    return network.create(NOX_LOCAL_NETWORK);
  },
};
