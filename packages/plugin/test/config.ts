import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HardhatConfig, HardhatUserConfig } from "hardhat/types/config";
import {
  resolvePluginConfig,
  resolveTargetNetworkName,
  validatePluginConfig,
} from "../src/config.js";

const VALID_NOX_COMPUTE_ADDRESS = "0x8D88B61356Fa291505d3E3D3a77e19fad0958fe3";
const VALID_HANDLE_GATEWAY_URL = "https://gateway.example.com";

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
    });
  });

  describe("Config resolution", () => {
    it("Should default skipTestOverride to false when nox is missing", async () => {
      const resolved = await resolvePluginConfig({}, {} as HardhatConfig);
      assert.deepEqual(resolved.nox, { skipTestOverride: false });
    });

    it("Should default skipTestOverride to false on empty nox", async () => {
      const resolved = await resolvePluginConfig(
        { nox: {} } satisfies HardhatUserConfig,
        {} as HardhatConfig,
      );
      assert.deepEqual(resolved.nox, { skipTestOverride: false });
    });

    it("Should pass skipTestOverride=true through", async () => {
      const resolved = await resolvePluginConfig(
        { nox: { skipTestOverride: true } } satisfies HardhatUserConfig,
        {} as HardhatConfig,
      );
      assert.deepEqual(resolved.nox, { skipTestOverride: true });
    });

    it("Should carry a network's nox config through to the resolved network", async () => {
      const userConfig = {
        networks: {
          existingStack: {
            type: "http",
            url: "https://rpc.example.com",
            nox: {
              noxComputeAddress: VALID_NOX_COMPUTE_ADDRESS,
              handleGatewayUrl: VALID_HANDLE_GATEWAY_URL,
            },
          },
        },
      } satisfies HardhatUserConfig;
      const partiallyResolvedConfig = {
        networks: {
          existingStack: { type: "http", url: "https://rpc.example.com" },
        },
      } as unknown as HardhatConfig;

      const resolved = await resolvePluginConfig(
        userConfig,
        partiallyResolvedConfig,
      );

      assert.deepEqual(resolved.networks.existingStack, {
        type: "http",
        url: "https://rpc.example.com",
        nox: {
          noxComputeAddress: VALID_NOX_COMPUTE_ADDRESS,
          handleGatewayUrl: VALID_HANDLE_GATEWAY_URL,
        },
      });
    });

    it("Should strip a trailing slash from handleGatewayUrl when resolving", async () => {
      const userConfig = {
        networks: {
          existingStack: {
            type: "http",
            url: "https://rpc.example.com",
            nox: {
              noxComputeAddress: VALID_NOX_COMPUTE_ADDRESS,
              handleGatewayUrl: "https://gateway.example.com/",
            },
          },
        },
      } satisfies HardhatUserConfig;
      const partiallyResolvedConfig = {
        networks: {
          existingStack: { type: "http", url: "https://rpc.example.com" },
        },
      } as unknown as HardhatConfig;

      const resolved = await resolvePluginConfig(
        userConfig,
        partiallyResolvedConfig,
      );

      assert.deepEqual(resolved.networks.existingStack, {
        type: "http",
        url: "https://rpc.example.com",
        nox: {
          noxComputeAddress: VALID_NOX_COMPUTE_ADDRESS,
          handleGatewayUrl: "https://gateway.example.com",
        },
      });
    });

    it("Should leave networks without a nox config untouched", async () => {
      const userConfig = {
        networks: { plain: { type: "http", url: "https://rpc.example.com" } },
      } satisfies HardhatUserConfig;
      const partiallyResolvedConfig = {
        networks: {
          plain: { type: "http", url: "https://rpc.example.com" },
        },
      } as unknown as HardhatConfig;

      const resolved = await resolvePluginConfig(
        userConfig,
        partiallyResolvedConfig,
      );

      assert.deepEqual(resolved.networks.plain, {
        type: "http",
        url: "https://rpc.example.com",
      });
    });
  });

  describe("Per-network nox config validation", () => {
    describe("Valid cases", () => {
      it("Should accept a network without a nox field", async () => {
        const errors = await validatePluginConfig({
          networks: { foo: { type: "http", url: "https://rpc.example.com" } },
        });
        assert.equal(errors.length, 0);
      });

      it("Should accept a well-formed nox config on an http network", async () => {
        const errors = await validatePluginConfig({
          networks: {
            existingStack: {
              type: "http",
              url: "https://rpc.example.com",
              nox: {
                noxComputeAddress: VALID_NOX_COMPUTE_ADDRESS,
                handleGatewayUrl: VALID_HANDLE_GATEWAY_URL,
              },
            },
          },
        });
        assert.equal(errors.length, 0);
      });
    });

    describe("Invalid cases", () => {
      it("Should reject a nox config on an edr-simulated network", async () => {
        const errors = await validatePluginConfig({
          networks: {
            local: {
              type: "edr-simulated",
              // @ts-expect-error intentionally invalid — nox isn't declared on edr networks
              nox: {
                noxComputeAddress: VALID_NOX_COMPUTE_ADDRESS,
                handleGatewayUrl: VALID_HANDLE_GATEWAY_URL,
              },
            },
          },
        });
        assert.deepEqual(errors, [
          {
            path: ["networks", "local", "nox"],
            message:
              "Only supported on http networks — an edr-simulated network is " +
              "re-created fresh on every connect, so it can never be an " +
              "already-running stack.",
          },
        ]);
      });

      it("Should reject a missing noxComputeAddress", async () => {
        const errors = await validatePluginConfig({
          networks: {
            existingStack: {
              type: "http",
              url: "https://rpc.example.com",
              // @ts-expect-error intentionally invalid — noxComputeAddress is missing
              nox: { handleGatewayUrl: VALID_HANDLE_GATEWAY_URL },
            },
          },
        });
        assert.deepEqual(errors, [
          {
            path: ["networks", "existingStack", "nox", "noxComputeAddress"],
            message: "Expected an address, none was given.",
          },
        ]);
      });

      it("Should reject an invalid noxComputeAddress", async () => {
        const errors = await validatePluginConfig({
          networks: {
            existingStack: {
              type: "http",
              url: "https://rpc.example.com",
              nox: {
                // @ts-expect-error intentionally invalid
                noxComputeAddress: "NOT_AN_ADDRESS",
                handleGatewayUrl: VALID_HANDLE_GATEWAY_URL,
              },
            },
          },
        });
        assert.deepEqual(errors, [
          {
            path: ["networks", "existingStack", "nox", "noxComputeAddress"],
            message: "Expected a valid address.",
          },
        ]);
      });

      it("Should reject a missing handleGatewayUrl", async () => {
        const errors = await validatePluginConfig({
          networks: {
            existingStack: {
              type: "http",
              url: "https://rpc.example.com",
              // @ts-expect-error intentionally invalid — handleGatewayUrl is missing
              nox: { noxComputeAddress: VALID_NOX_COMPUTE_ADDRESS },
            },
          },
        });
        assert.deepEqual(errors, [
          {
            path: ["networks", "existingStack", "nox", "handleGatewayUrl"],
            message: "Expected a URL, none was given.",
          },
        ]);
      });

      it("Should reject an invalid handleGatewayUrl", async () => {
        const errors = await validatePluginConfig({
          networks: {
            existingStack: {
              type: "http",
              url: "https://rpc.example.com",
              nox: {
                noxComputeAddress: VALID_NOX_COMPUTE_ADDRESS,
                handleGatewayUrl: "NOT A URL",
              },
            },
          },
        });
        assert.deepEqual(errors, [
          {
            path: ["networks", "existingStack", "nox", "handleGatewayUrl"],
            message: "Expected a valid http(s) URL.",
          },
        ]);
      });

      it("Should report every problem on a network at once", async () => {
        const errors = await validatePluginConfig({
          networks: {
            existingStack: {
              type: "http",
              url: "https://rpc.example.com",
              // @ts-expect-error intentionally invalid — both fields missing
              nox: {},
            },
          },
        });
        assert.deepEqual(errors, [
          {
            path: ["networks", "existingStack", "nox", "noxComputeAddress"],
            message: "Expected an address, none was given.",
          },
          {
            path: ["networks", "existingStack", "nox", "handleGatewayUrl"],
            message: "Expected a URL, none was given.",
          },
        ]);
      });

      it("Should validate multiple networks independently", async () => {
        const errors = await validatePluginConfig({
          networks: {
            good: {
              type: "http",
              url: "https://rpc.example.com",
              nox: {
                noxComputeAddress: VALID_NOX_COMPUTE_ADDRESS,
                handleGatewayUrl: VALID_HANDLE_GATEWAY_URL,
              },
            },
            bad: {
              type: "http",
              url: "https://rpc.example.com",
              // @ts-expect-error intentionally invalid — handleGatewayUrl is missing
              nox: { noxComputeAddress: VALID_NOX_COMPUTE_ADDRESS },
            },
          },
        });
        assert.deepEqual(errors, [
          {
            path: ["networks", "bad", "nox", "handleGatewayUrl"],
            message: "Expected a URL, none was given.",
          },
        ]);
      });
    });
  });

  describe("resolveTargetNetworkName", () => {
    it("Should default to 'default' when undefined", () => {
      assert.equal(resolveTargetNetworkName(undefined), "default");
    });

    it("Should default to 'default' when empty", () => {
      assert.equal(resolveTargetNetworkName(""), "default");
    });

    it("Should pass a given network name through", () => {
      assert.equal(resolveTargetNetworkName("sepolia"), "sepolia");
    });
  });
});
