import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HardhatConfig, HardhatUserConfig } from "hardhat/types/config";
import { resolvePluginConfig, validatePluginConfig } from "../src/config.js";

describe("Nox plugin config", () => {
  describe("Config validation", () => {
    describe("Valid cases", () => {
      it("Should consider an empty config as valid", async () => {
        assert.equal((await validatePluginConfig({})).length, 0);
      });

      it("Should ignore errors in other parts of the config", async () => {
        const errors = await validatePluginConfig({
          networks: { foo: { type: "http", url: "INVALID URL" } },
        });
        assert.equal(errors.length, 0);
      });

      it("Should accept an empty nox object", async () => {
        assert.equal((await validatePluginConfig({ nox: {} })).length, 0);
      });

      it("Should accept skipTestOverride=true", async () => {
        assert.equal(
          (
            await validatePluginConfig({
              nox: { skipTestOverride: true },
            })
          ).length,
          0,
        );
      });

      it("Should accept skipTestOverride=false", async () => {
        assert.equal(
          (
            await validatePluginConfig({
              nox: { skipTestOverride: false },
            })
          ).length,
          0,
        );
      });

      it("Should accept forceExitAfterTest=true", async () => {
        assert.equal(
          (
            await validatePluginConfig({
              nox: { forceExitAfterTest: true },
            })
          ).length,
          0,
        );
      });

      it("Should accept forceExitAfterTest=false", async () => {
        assert.equal(
          (
            await validatePluginConfig({
              nox: { forceExitAfterTest: false },
            })
          ).length,
          0,
        );
      });
    });

    describe("Invalid cases", () => {
      it("Should reject a nox field that isn't an object", async () => {
        const errors = await validatePluginConfig({
          // @ts-expect-error intentionally invalid
          nox: "INVALID",
        });
        assert.deepEqual(errors, [
          { path: ["nox"], message: "Expected an object." },
        ]);
      });

      it("Should reject a non-boolean skipTestOverride", async () => {
        const errors = await validatePluginConfig({
          nox: {
            // @ts-expect-error intentionally invalid
            skipTestOverride: "yes",
          },
        });
        assert.deepEqual(errors, [
          {
            path: ["nox", "skipTestOverride"],
            message: "Expected a boolean.",
          },
        ]);
      });

      it("Should reject a non-boolean forceExitAfterTest", async () => {
        const errors = await validatePluginConfig({
          nox: {
            // @ts-expect-error intentionally invalid
            forceExitAfterTest: "yes",
          },
        });
        assert.deepEqual(errors, [
          {
            path: ["nox", "forceExitAfterTest"],
            message: "Expected a boolean.",
          },
        ]);
      });
    });
  });

  describe("Config resolution", () => {
    it("Should default skipTestOverride to false when nox is missing", async () => {
      const resolved = await resolvePluginConfig({}, {} as HardhatConfig);
      assert.deepEqual(resolved.nox, {
        skipTestOverride: false,
        forceExitAfterTest: true,
      });
    });

    it("Should default skipTestOverride to false on empty nox", async () => {
      const resolved = await resolvePluginConfig(
        { nox: {} } satisfies HardhatUserConfig,
        {} as HardhatConfig,
      );
      assert.deepEqual(resolved.nox, {
        skipTestOverride: false,
        forceExitAfterTest: true,
      });
    });

    it("Should pass skipTestOverride=true through", async () => {
      const resolved = await resolvePluginConfig(
        { nox: { skipTestOverride: true } } satisfies HardhatUserConfig,
        {} as HardhatConfig,
      );
      assert.deepEqual(resolved.nox, {
        skipTestOverride: true,
        forceExitAfterTest: true,
      });
    });

    it("Should default forceExitAfterTest to true when nox is missing", async () => {
      const resolved = await resolvePluginConfig({}, {} as HardhatConfig);
      assert.equal(resolved.nox.forceExitAfterTest, true);
    });

    it("Should pass forceExitAfterTest=false through", async () => {
      const resolved = await resolvePluginConfig(
        { nox: { forceExitAfterTest: false } } satisfies HardhatUserConfig,
        {} as HardhatConfig,
      );
      assert.equal(resolved.nox.forceExitAfterTest, false);
    });
  });
});
