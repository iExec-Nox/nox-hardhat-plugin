import assert from "node:assert/strict";
import { describe, it } from "node:test";

import path from "node:path";
import { createHardhatRuntimeEnvironment } from "hardhat/hre";
import NoxPlugin from "../src/index.js";
import { createFixtureProjectHRE } from "./helpers/fixture-projects.js";

describe("NoxPlugin tests", () => {
  describe("Test using a fixture project", async () => {
    it("Should load the plugin and expose nox config on the HRE", async () => {
      const hre = await createFixtureProjectHRE("base-project");

      assert.equal(hre.config.nox.enabled, false);
      assert.equal(hre.config.nox.ports.gateway, 3000);
    });
  });

  describe("Test creating a new HRE with an inline config", async () => {
    it("Should load the plugin and resolve nox config defaults", async () => {
      const hre = await createHardhatRuntimeEnvironment({
        plugins: [NoxPlugin],
        nox: { enabled: false },
      });

      assert.equal(hre.config.nox.enabled, false);
      assert.equal(hre.config.nox.ports.gateway, 3000);
      assert.equal(hre.config.nox.ports.nats, 4222);

      assert.equal(hre.config.paths.config, undefined);
      assert.equal(
        hre.config.paths.root,
        path.resolve(import.meta.dirname, ".."),
      );
    });
  });
});
