/**
 * Unit tests for the six service config factory functions.
 *
 * Each factory returns a plain ServiceConfig object whose only job is:
 *   1. Expose a correct healthUrl.
 *   2. Wire the right environment variables for the binary.
 *
 * We test both properties without spawning any process.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  natsConfig,
  minioConfig,
  kmsConfig,
  gatewayConfig,
  ingestorConfig,
  runnerConfig,
} from "../../src/services/configs.js";
import { resolveNoxConfig } from "../../src/config.js";
import { DEFAULT_KEYS } from "../../src/config.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONTRACT = "0x" + "a".repeat(40);
const CHAIN_ID = "421614";
const RPC_URL = "http://127.0.0.1:8545";
const CONFIG = resolveNoxConfig({});

// ---------------------------------------------------------------------------
// natsConfig
// ---------------------------------------------------------------------------

describe("natsConfig", () => {
  it("exposes the correct health URL", () => {
    const cfg = natsConfig("/bin/nats", CONFIG.ports);
    assert.equal(
      cfg.healthUrl,
      `http://127.0.0.1:${CONFIG.ports.natsMonitor}/healthz`,
    );
  });

  it("has no environment variables (NATS uses CLI args only)", () => {
    const cfg = natsConfig("/bin/nats", CONFIG.ports);
    assert.deepEqual(cfg.env, {});
  });
});

// ---------------------------------------------------------------------------
// minioConfig
// ---------------------------------------------------------------------------

describe("minioConfig", () => {
  it("exposes a health URL that includes the configured port", () => {
    const cfg = minioConfig("/bin/minio", CONFIG.ports);
    assert.ok(
      cfg.healthUrl.includes(String(CONFIG.ports.s3)),
      `expected port in URL: ${cfg.healthUrl}`,
    );
    assert.ok(
      cfg.healthUrl.includes("/minio/health/live"),
      `unexpected URL format: ${cfg.healthUrl}`,
    );
  });

  it("sets MINIO_ROOT_USER from S3 constants", () => {
    const cfg = minioConfig("/bin/minio", CONFIG.ports);
    assert.ok(cfg.env["MINIO_ROOT_USER"] !== undefined);
  });

  it("sets MINIO_ROOT_PASSWORD from S3 constants", () => {
    const cfg = minioConfig("/bin/minio", CONFIG.ports);
    assert.ok(cfg.env["MINIO_ROOT_PASSWORD"] !== undefined);
  });
});

// ---------------------------------------------------------------------------
// kmsConfig
// ---------------------------------------------------------------------------

describe("kmsConfig", () => {
  it("exposes a health URL that includes the configured port", () => {
    const cfg = kmsConfig("/bin/kms", CONFIG, CONTRACT, CHAIN_ID, RPC_URL);
    assert.ok(
      cfg.healthUrl.includes(String(CONFIG.ports.kms)),
      `expected port in URL: ${cfg.healthUrl}`,
    );
  });

  it("passes the chain ID to the binary", () => {
    const cfg = kmsConfig("/bin/kms", CONFIG, CONTRACT, CHAIN_ID, RPC_URL);
    assert.equal(cfg.env["NOX_KMS_CHAIN__CHAIN_ID"], CHAIN_ID);
  });

  it("passes the RPC URL to the binary", () => {
    const cfg = kmsConfig("/bin/kms", CONFIG, CONTRACT, CHAIN_ID, RPC_URL);
    assert.equal(cfg.env["NOX_KMS_CHAIN__RPC_URL"], RPC_URL);
  });

  it("passes the contract address to the binary", () => {
    const cfg = kmsConfig("/bin/kms", CONFIG, CONTRACT, CHAIN_ID, RPC_URL);
    assert.equal(cfg.env["NOX_KMS_CHAIN__NOX_COMPUTE_CONTRACT"], CONTRACT);
  });

  it("passes the KMS wallet key from DEFAULT_KEYS", () => {
    const cfg = kmsConfig("/bin/kms", CONFIG, CONTRACT, CHAIN_ID, RPC_URL);
    assert.equal(cfg.env["NOX_KMS_WALLET_KEY"], DEFAULT_KEYS.kms.walletKey);
  });

  it("passes the KMS ECC key from DEFAULT_KEYS", () => {
    const cfg = kmsConfig("/bin/kms", CONFIG, CONTRACT, CHAIN_ID, RPC_URL);
    assert.equal(cfg.env["NOX_KMS_ECC_KEY"], DEFAULT_KEYS.kms.eccKey);
  });
});

// ---------------------------------------------------------------------------
// gatewayConfig
// ---------------------------------------------------------------------------

describe("gatewayConfig", () => {
  it("exposes a health URL that includes the configured port", () => {
    const cfg = gatewayConfig(
      "/bin/gateway",
      CONFIG,
      CONTRACT,
      CHAIN_ID,
      RPC_URL,
    );
    assert.ok(
      cfg.healthUrl.includes(String(CONFIG.ports.gateway)),
      `expected port in URL: ${cfg.healthUrl}`,
    );
  });

  it("passes the contract address to the binary", () => {
    const cfg = gatewayConfig(
      "/bin/gateway",
      CONFIG,
      CONTRACT,
      CHAIN_ID,
      RPC_URL,
    );
    assert.equal(
      cfg.env["NOX_HANDLE_GATEWAY_CHAIN__NOX_COMPUTE_CONTRACT"],
      CONTRACT,
    );
  });

  it("passes the chain ID to the binary", () => {
    const cfg = gatewayConfig(
      "/bin/gateway",
      CONFIG,
      CONTRACT,
      CHAIN_ID,
      RPC_URL,
    );
    assert.equal(cfg.env["NOX_HANDLE_GATEWAY_CHAIN__ID"], CHAIN_ID);
  });

  it("passes the gateway signer wallet key from DEFAULT_KEYS", () => {
    const cfg = gatewayConfig(
      "/bin/gateway",
      CONFIG,
      CONTRACT,
      CHAIN_ID,
      RPC_URL,
    );
    assert.equal(
      cfg.env["NOX_HANDLE_GATEWAY_SIGNER__WALLET_KEY"],
      DEFAULT_KEYS.gateway.walletKey,
    );
  });

  it("wires the KMS URL using the configured kms port", () => {
    const cfg = gatewayConfig(
      "/bin/gateway",
      CONFIG,
      CONTRACT,
      CHAIN_ID,
      RPC_URL,
    );
    assert.ok(
      cfg.env["NOX_HANDLE_GATEWAY_KMS__URL"]?.includes(
        String(CONFIG.ports.kms),
      ),
      `expected kms port in URL`,
    );
  });

  it("wires the S3 endpoint using the configured s3 port", () => {
    const cfg = gatewayConfig(
      "/bin/gateway",
      CONFIG,
      CONTRACT,
      CHAIN_ID,
      RPC_URL,
    );
    assert.ok(
      cfg.env["NOX_HANDLE_GATEWAY_S3__ENDPOINT_URL"]?.includes(
        String(CONFIG.ports.s3),
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// ingestorConfig
// ---------------------------------------------------------------------------

describe("ingestorConfig", () => {
  it("exposes a health URL that includes the configured port", () => {
    const cfg = ingestorConfig(
      "/bin/ingestor",
      CONFIG,
      CONTRACT,
      CHAIN_ID,
      RPC_URL,
      "100",
    );
    assert.ok(cfg.healthUrl.includes(String(CONFIG.ports.ingestor)));
  });

  it("passes the contract address to the binary", () => {
    const cfg = ingestorConfig(
      "/bin/ingestor",
      CONFIG,
      CONTRACT,
      CHAIN_ID,
      RPC_URL,
      "100",
    );
    assert.equal(cfg.env["NOX_INGESTOR_CHAIN__CONTRACT_ADDRESS"], CONTRACT);
  });

  it("passes the initial block number to the binary", () => {
    const cfg = ingestorConfig(
      "/bin/ingestor",
      CONFIG,
      CONTRACT,
      CHAIN_ID,
      RPC_URL,
      "42",
    );
    assert.equal(cfg.env["NOX_INGESTOR_CHAIN__INITIAL_BLOCK"], "42");
  });

  it("wires the NATS URL using the configured nats port", () => {
    const cfg = ingestorConfig(
      "/bin/ingestor",
      CONFIG,
      CONTRACT,
      CHAIN_ID,
      RPC_URL,
      "1",
    );
    assert.ok(
      cfg.env["NOX_INGESTOR_NATS__URL"]?.includes(String(CONFIG.ports.nats)),
    );
  });
});

// ---------------------------------------------------------------------------
// runnerConfig
// ---------------------------------------------------------------------------

describe("runnerConfig", () => {
  it("exposes a health URL that includes the configured port", () => {
    const cfg = runnerConfig(
      "/bin/runner",
      CONFIG,
      CONTRACT,
      CHAIN_ID,
      RPC_URL,
    );
    assert.ok(cfg.healthUrl.includes(String(CONFIG.ports.runner)));
  });

  it("passes the contract address to the binary", () => {
    const cfg = runnerConfig(
      "/bin/runner",
      CONFIG,
      CONTRACT,
      CHAIN_ID,
      RPC_URL,
    );
    assert.equal(cfg.env["NOX_RUNNER_NOX_COMPUTE_CONTRACT_ADDRESS"], CONTRACT);
  });

  it("passes the runner wallet key from DEFAULT_KEYS", () => {
    const cfg = runnerConfig(
      "/bin/runner",
      CONFIG,
      CONTRACT,
      CHAIN_ID,
      RPC_URL,
    );
    assert.equal(
      cfg.env["NOX_RUNNER_WALLET_KEY"],
      DEFAULT_KEYS.runner.walletKey,
    );
  });

  it("wires the gateway URL using the configured gateway port", () => {
    const cfg = runnerConfig(
      "/bin/runner",
      CONFIG,
      CONTRACT,
      CHAIN_ID,
      RPC_URL,
    );
    assert.ok(
      cfg.env["NOX_RUNNER_HANDLE_GATEWAY_URL"]?.includes(
        String(CONFIG.ports.gateway),
      ),
    );
  });

  it("wires the NATS URL using the configured nats port", () => {
    const cfg = runnerConfig(
      "/bin/runner",
      CONFIG,
      CONTRACT,
      CHAIN_ID,
      RPC_URL,
    );
    assert.ok(
      cfg.env["NOX_RUNNER_NATS_URL"]?.includes(String(CONFIG.ports.nats)),
    );
  });
});
