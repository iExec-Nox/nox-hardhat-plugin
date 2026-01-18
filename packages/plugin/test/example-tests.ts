import assert from "node:assert/strict";
import { describe, it } from "node:test";

import path from "node:path";
import { createHardhatRuntimeEnvironment } from "hardhat/hre";
import CoreMock from "../src/index.js";
import { CORE_CONTRACT_ADDRESS } from "../src/config.js";
import { createFixtureProjectHRE } from "./helpers/fixture-projects.js";

describe("Core mock plugin tests", () => {
  describe("Test using a fixture project", async () => {
    it("Should define core:install", async () => {
      const hre = await createFixtureProjectHRE("base-project");

      const installTask = hre.tasks.getTask("core:install");
      assert.notEqual(
        installTask,
        undefined,
        "core:install should be defined because we loaded the plugin",
      );

      await installTask.run({ force: true });

      const conn = await hre.network.connect();
      const code = await conn.provider.request({
        method: "eth_getCode",
        params: [CORE_CONTRACT_ADDRESS, "latest"],
      });
      assert.notEqual(code, "0x", "Core mock bytecode should exist");
    });
  });

  describe("Test creating a new HRE with an inline config", async () => {
    it("Should be able to load the plugin", async () => {
      const hre = await createHardhatRuntimeEnvironment({
        plugins: [CoreMock],
        coreMock: {
          enabled: false,
        },
      });

      assert.equal(hre.config.coreMock.enabled, false);

      // The config path is undefined because we didn't provide it to
      // createHardhatRuntimeEnvironment. See its documentation for more info.
      assert.equal(hre.config.paths.config, undefined);

      // The root path is the directory containing the closest package.json to
      // the CWD, if none is provided.
      assert.equal(
        hre.config.paths.root,
        path.resolve(import.meta.dirname, ".."),
      );
    });
  });
});
