import { defineConfig } from "hardhat/config";
import NoxPlugin from "../../../src/index.js";

export default defineConfig({
  plugins: [NoxPlugin],
  nox: { enabled: false }, // disable stack startup in fixture
});
