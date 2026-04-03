import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateNoxConfig, resolveNoxConfig } from "../../src/config.js";

describe("validateNoxConfig", () => {
  it("returns no errors for empty config", () => {
    const errors = validateNoxConfig({});
    assert.deepEqual(errors, []);
  });

  it("returns no errors for valid port values", () => {
    const errors = validateNoxConfig({ ports: { gateway: 3001, nats: 4223 } });
    assert.deepEqual(errors, []);
  });

  it("returns error for port out of range (too high)", () => {
    const errors = validateNoxConfig({ ports: { gateway: 99999 } });
    assert.equal(errors.length, 1);
    assert.ok(
      errors[0].message.includes("gateway"),
      `expected error to mention 'gateway', got: ${errors[0].message}`,
    );
  });

  it("returns error for port out of range (zero)", () => {
    const errors = validateNoxConfig({ ports: { kms: 0 } });
    assert.equal(errors.length, 1);
    assert.ok(errors[0].message.includes("kms"));
  });

  it("returns error for non-numeric port", () => {
    const errors = validateNoxConfig({
      ports: { nats: "not-a-port" as unknown as number },
    });
    assert.equal(errors.length, 1);
  });

  it("returns multiple errors when multiple ports are invalid", () => {
    const errors = validateNoxConfig({
      ports: { gateway: 0, runner: 70000 },
    });
    assert.equal(errors.length, 2);
  });

  it("sets field path correctly", () => {
    const errors = validateNoxConfig({ ports: { s3: -1 } });
    assert.deepEqual(errors[0].path, ["nox", "ports", "s3"]);
  });
});

describe("resolveNoxConfig", () => {
  it("fills all defaults when user config is empty", () => {
    const resolved = resolveNoxConfig({});
    assert.equal(resolved.ports.gateway, 3000);
    assert.equal(resolved.ports.nats, 4222);
    assert.equal(resolved.ports.s3, 9100);
    assert.equal(resolved.ports.kms, 9000);
    assert.equal(resolved.ports.runner, 8080);
  });

  it("overrides only the specified port, leaving others at defaults", () => {
    const resolved = resolveNoxConfig({ ports: { gateway: 3001 } });
    assert.equal(resolved.ports.gateway, 3001);
    assert.equal(resolved.ports.nats, 4222);
    assert.equal(resolved.ports.kms, 9000);
  });

  it("defaults enabled to true", () => {
    const resolved = resolveNoxConfig({});
    assert.equal(resolved.enabled, true);
  });

  it("respects enabled: false", () => {
    const resolved = resolveNoxConfig({ enabled: false });
    assert.equal(resolved.enabled, false);
  });

  it("always uses internal default keys regardless of user config", () => {
    const resolved = resolveNoxConfig({});
    assert.ok(resolved.keys.kms.walletKey.startsWith("0x"));
    assert.ok(resolved.keys.kms.eccKey.startsWith("0x"));
    assert.ok(resolved.keys.kms.eccPublicKey.startsWith("0x"));
    assert.ok(resolved.keys.gateway.walletKey.startsWith("0x"));
    assert.ok(resolved.keys.runner.walletKey.startsWith("0x"));
  });
});
