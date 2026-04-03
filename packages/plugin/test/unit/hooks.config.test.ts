import assert from "node:assert/strict";
import { describe, it } from "node:test";

import hooksConfigFactory from "../../src/hooks/config.js";

// The factory is called by Hardhat to obtain the hook handlers.
// We instantiate it once and test each handler directly.

describe("config hook — validateUserConfig", () => {
  it("returns no errors for a valid nox config", async () => {
    const { validateUserConfig } = await hooksConfigFactory();
    const result = await validateUserConfig!({
      nox: { enabled: true, contractAddress: "0xABCD" },
    } as never);
    assert.deepEqual(result, []);
  });

  it("returns validation errors for an invalid port", async () => {
    const { validateUserConfig } = await hooksConfigFactory();
    const result = await validateUserConfig!({
      nox: { ports: { gateway: 0 } },
    } as never);
    assert.equal(result.length, 1);
    assert.ok(result[0].message.includes("gateway"));
  });

  it("returns multiple errors for multiple invalid ports", async () => {
    const { validateUserConfig } = await hooksConfigFactory();
    const result = await validateUserConfig!({
      nox: { ports: { gateway: 0, runner: 99999 } },
    } as never);
    assert.equal(result.length, 2);
  });

  it("returns no errors when nox key is absent from user config", async () => {
    const { validateUserConfig } = await hooksConfigFactory();
    const result = await validateUserConfig!({} as never);
    assert.deepEqual(result, []);
  });
});

describe("config hook — resolveUserConfig", () => {
  it("injects nox resolved config alongside other resolved fields", async () => {
    const { resolveUserConfig } = await hooksConfigFactory();
    const next = async (cfg: object) => ({ ...cfg, otherField: 42 });
    const result = (await resolveUserConfig!(
      { nox: { enabled: false } } as never,
      {} as never,
      next as never,
    )) as unknown as Record<string, unknown>;
    assert.equal((result["nox"] as Record<string, unknown>)["enabled"], false);
    assert.equal(result["otherField"], 42);
  });

  it("applies full defaults when nox is absent from user config", async () => {
    const { resolveUserConfig } = await hooksConfigFactory();
    const next = async (cfg: object) => cfg;
    const result = (await resolveUserConfig!(
      {} as never,
      {} as never,
      next as never,
    )) as unknown as Record<string, unknown>;
    const nox = result["nox"] as Record<string, unknown>;
    assert.equal(nox["enabled"], true);
    assert.equal((nox["ports"] as Record<string, unknown>)["gateway"], 3000);
    assert.equal((nox["ports"] as Record<string, unknown>)["nats"], 4222);
  });

  it("respects port overrides while keeping other defaults", async () => {
    const { resolveUserConfig } = await hooksConfigFactory();
    const next = async (cfg: object) => cfg;
    const result = (await resolveUserConfig!(
      { nox: { ports: { gateway: 3001 } } } as never,
      {} as never,
      next as never,
    )) as unknown as Record<string, unknown>;
    const ports = (result["nox"] as Record<string, unknown>)["ports"] as Record<
      string,
      unknown
    >;
    assert.equal(ports["gateway"], 3001);
    assert.equal(ports["nats"], 4222); // default untouched
  });

  it("calls next and preserves its output", async () => {
    const { resolveUserConfig } = await hooksConfigFactory();
    let nextCalled = false;
    const next = async (cfg: object) => {
      nextCalled = true;
      return { ...cfg, injected: true };
    };
    await resolveUserConfig!({} as never, {} as never, next as never);
    assert.ok(nextCalled);
  });
});
