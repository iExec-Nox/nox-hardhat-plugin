import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { homedir } from "node:os";

import { resolveBinary } from "../../src/runtime/BinaryResolver.js";
import type { ServiceName } from "../../src/runtime/BinaryResolver.js";

let saved: Record<string, string | undefined> = {};

function setEnv(key: string, value: string) {
  saved[key] = process.env[key];
  process.env[key] = value;
}

function delEnv(key: string) {
  saved[key] = process.env[key];
  delete process.env[key];
}

beforeEach(() => {
  saved = {};
});

afterEach(() => {
  for (const [key, val] of Object.entries(saved)) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
});

describe("resolveBinary", () => {
  it("returns the env var path when NOX_BIN_KMS is set", () => {
    setEnv("NOX_BIN_KMS", "/custom/path/nox-kms");
    assert.equal(resolveBinary("kms"), "/custom/path/nox-kms");
  });

  it("returns the env var path when NOX_BIN_GATEWAY is set", () => {
    setEnv("NOX_BIN_GATEWAY", "/opt/nox/nox-handle-gateway");
    assert.equal(resolveBinary("gateway"), "/opt/nox/nox-handle-gateway");
  });

  it("falls back to cache path when env var is not set", () => {
    delEnv("NOX_BIN_GATEWAY");
    const result = resolveBinary("gateway");
    assert.ok(
      result.includes("nox-handle-gateway"),
      `expected binary name in path, got: ${result}`,
    );
    assert.ok(
      result.includes(".cache"),
      `expected .cache in path, got: ${result}`,
    );
  });

  it("cache path is rooted under homedir", () => {
    delEnv("NOX_BIN_NATS");
    const result = resolveBinary("nats");
    assert.ok(
      result.startsWith(homedir()),
      `expected path under homedir, got: ${result}`,
    );
  });

  it("cache path ends with the correct binary name for each service", () => {
    const expected: Record<ServiceName, string> = {
      nats: "nats-server",
      minio: "minio",
      kms: "nox-kms",
      gateway: "nox-handle-gateway",
      ingestor: "nox-ingestor",
      runner: "nox-runner",
    };
    for (const [svc, bin] of Object.entries(expected) as [
      ServiceName,
      string,
    ][]) {
      delEnv(`NOX_BIN_${svc.toUpperCase()}`);
      const result = resolveBinary(svc);
      assert.ok(
        result.endsWith(bin),
        `${svc}: expected to end with ${bin}, got: ${result}`,
      );
    }
  });

  it("ignores an empty string env var and uses cache path instead", () => {
    setEnv("NOX_BIN_RUNNER", "");
    const result = resolveBinary("runner");
    assert.ok(
      result.includes("nox-runner"),
      `expected cache path, got: ${result}`,
    );
    assert.ok(
      result.includes(".cache"),
      `expected .cache in path, got: ${result}`,
    );
  });
});
