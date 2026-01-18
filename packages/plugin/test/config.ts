import { describe, it } from "node:test";

import assert from "node:assert/strict";
import { HardhatConfig, HardhatUserConfig } from "hardhat/types/config";
import { resolvePluginConfig, validatePluginConfig } from "../src/config.js";

describe("Core mock config", () => {
  describe("Config validation", () => {
    describe("Valid cases", () => {
      it("Should consider an empty config as valid", async () => {
        const validationErrors = await validatePluginConfig({});

        assert.equal(validationErrors.length, 0);
      });

      it("Should ignore errors in other parts of the config", async () => {
        const validationErrors = await validatePluginConfig({
          networks: {
            foo: {
              type: "http",
              url: "INVALID URL",
            },
          },
        });

        assert.equal(validationErrors.length, 0);
      });

      it("Should accept an empty coreMock object", async () => {
        const validationErrors = await validatePluginConfig({
          coreMock: {},
        });

        assert.equal(validationErrors.length, 0);
      });

      it("Should accept enabled: true", async () => {
        const validationErrors = await validatePluginConfig({
          coreMock: {
            enabled: true,
          },
        });

        assert.equal(validationErrors.length, 0);
      });
    });

    describe("Invalid cases", () => {
      it("Should reject a coreMock field with an invalid type", async () => {
        const validationErrors = await validatePluginConfig({
          // @ts-expect-error We're intentionally passing a string here
          coreMock: "INVALID",
        });

        assert.deepEqual(validationErrors, [
          {
            path: ["coreMock"],
            message: "Expected an object with core mock settings.",
          },
        ]);
      });

      it("Should reject enabled with invalid type", async () => {
        const validationErrors = await validatePluginConfig({
          coreMock: {
            enabled: "INVALID" as any,
          },
        });

        assert.deepEqual(validationErrors, [
          {
            path: ["coreMock", "enabled"],
            message: "Expected a boolean.",
          },
        ]);
      });
    });
  });

  describe("Config resolution", () => {
    it("Should resolve a config without a coreMock field", async () => {
      const userConfig: HardhatUserConfig = {};
      const partiallyResolvedConfig = {} as HardhatConfig;

      const resolvedConfig = await resolvePluginConfig(
        userConfig,
        partiallyResolvedConfig,
      );

      assert.equal(resolvedConfig.coreMock.enabled, true);
    });

    it("Should resolve a config with an empty coreMock field", async () => {
      const userConfig: HardhatUserConfig = { coreMock: {} };
      const partiallyResolvedConfig = {} as HardhatConfig;

      const resolvedConfig = await resolvePluginConfig(
        userConfig,
        partiallyResolvedConfig,
      );

      assert.equal(resolvedConfig.coreMock.enabled, true);
    });

    it("Should resolve a config with enabled: false", async () => {
      const userConfig: HardhatUserConfig = {
        coreMock: { enabled: false },
      };
      const partiallyResolvedConfig = {} as HardhatConfig;

      const resolvedConfig = await resolvePluginConfig(
        userConfig,
        partiallyResolvedConfig,
      );

      assert.equal(resolvedConfig.coreMock.enabled, false);
    });
  });
});
