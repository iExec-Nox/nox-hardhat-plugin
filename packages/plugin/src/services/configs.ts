import { privateKeyToAccount, privateKeyToAddress } from "viem/accounts";
import type { NoxResolvedConfig, NoxResolvedPorts } from "../types.js";

export const S3_ACCESS_KEY = "admin123";
export const S3_SECRET_KEY = "password123";
export const S3_BUCKET = "handles";
export const S3_REGION = "eu-west-3";

// Temporary directories used by NATS and MinIO — cleaned before each run.
export const NATS_STORAGE_DIR = "/tmp/hardhat-nox-nats";
export const MINIO_DATA_DIR = "/tmp/hardhat-nox-minio";

export interface ServiceConfig {
  name: string;
  binary: string;
  args: string[];
  env: Record<string, string>;
  healthUrl: string;
}

export function natsConfig(
  binary: string,
  ports: NoxResolvedPorts,
): ServiceConfig {
  return {
    name: "nats",
    binary,
    args: [
      "--port",
      String(ports.nats),
      "--http_port",
      String(ports.natsMonitor),
      "-js",
      "-sd",
      NATS_STORAGE_DIR,
    ],
    env: {},
    healthUrl: `http://127.0.0.1:${ports.natsMonitor}/healthz`,
  };
}

export function minioConfig(
  binary: string,
  ports: NoxResolvedPorts,
): ServiceConfig {
  return {
    name: "minio",
    binary,
    args: [
      "server",
      `--address=:${ports.s3}`,
      "--console-address=:0",
      MINIO_DATA_DIR,
    ],
    env: {
      MINIO_ROOT_USER: S3_ACCESS_KEY,
      MINIO_ROOT_PASSWORD: S3_SECRET_KEY,
    },
    healthUrl: `http://127.0.0.1:${ports.s3}/minio/health/live`,
  };
}

export function kmsConfig(
  binary: string,
  config: NoxResolvedConfig,
  contractAddress: string,
  chainId: string,
  rpcUrl: string,
): ServiceConfig {
  return {
    name: "nox-kms",
    binary,
    args: [],
    env: {
      NOX_KMS_CHAIN__CHAIN_ID: chainId,
      NOX_KMS_CHAIN__RPC_URL: rpcUrl,
      NOX_KMS_CHAIN__NOX_COMPUTE_CONTRACT: contractAddress,
      NOX_KMS_WALLET_KEY: config.keys.kms.walletKey,
      NOX_KMS_ECC_KEY: config.keys.kms.eccKey,
      NOX_KMS_SERVER__HOST: "127.0.0.1",
      NOX_KMS_SERVER__PORT: String(config.ports.kms),
    },
    healthUrl: `http://127.0.0.1:${config.ports.kms}/health`,
  };
}

export function gatewayConfig(
  binary: string,
  config: NoxResolvedConfig,
  contractAddress: string,
  chainId: string,
  rpcUrl: string,
): ServiceConfig {
  const runnerAddress = privateKeyToAccount(
    config.keys.runner.walletKey as `0x${string}`,
  ).address;
  const kmsSignerAddress = privateKeyToAddress(
    config.keys.kms.walletKey as `0x${string}`,
  );

  return {
    name: "nox-handle-gateway",
    binary,
    args: [],
    env: {
      NOX_HANDLE_GATEWAY_CHAIN__ID: chainId,
      NOX_HANDLE_GATEWAY_CHAIN__RPC_URL: rpcUrl,
      NOX_HANDLE_GATEWAY_CHAIN__NOX_COMPUTE_CONTRACT: contractAddress,
      NOX_HANDLE_GATEWAY_KMS__URL: `http://127.0.0.1:${config.ports.kms}`,
      NOX_HANDLE_GATEWAY_KMS__SIGNER_ADDRESS: kmsSignerAddress,
      NOX_HANDLE_GATEWAY_RUNNER_ADDRESS: runnerAddress,
      NOX_HANDLE_GATEWAY_S3__ENDPOINT_URL: `http://127.0.0.1:${config.ports.s3}`,
      NOX_HANDLE_GATEWAY_S3__REGION: S3_REGION,
      NOX_HANDLE_GATEWAY_S3__BUCKET: S3_BUCKET,
      NOX_HANDLE_GATEWAY_S3__ACCESS_KEY: S3_ACCESS_KEY,
      NOX_HANDLE_GATEWAY_S3__SECRET_KEY: S3_SECRET_KEY,
      NOX_HANDLE_GATEWAY_SIGNER__WALLET_KEY: config.keys.gateway.walletKey,
      NOX_HANDLE_GATEWAY_SERVER__HOST: "127.0.0.1",
      NOX_HANDLE_GATEWAY_SERVER__PORT: String(config.ports.gateway),
      RUST_LOG: "info",
    },
    healthUrl: `http://127.0.0.1:${config.ports.gateway}/health`,
  };
}

export function ingestorConfig(
  binary: string,
  config: NoxResolvedConfig,
  contractAddress: string,
  chainId: string,
  rpcUrl: string,
  initialBlock: string,
): ServiceConfig {
  return {
    name: "nox-ingestor",
    binary,
    args: [],
    env: {
      NOX_INGESTOR_CHAIN__RPC_ENDPOINT: rpcUrl,
      NOX_INGESTOR_CHAIN__CONTRACT_ADDRESS: contractAddress,
      NOX_INGESTOR_CHAIN__CHAIN_ID: chainId,
      NOX_INGESTOR_CHAIN__INITIAL_BLOCK: initialBlock,
      NOX_INGESTOR_NATS__URL: `nats://127.0.0.1:${config.ports.nats}`,
      NOX_INGESTOR_SERVER__PORT: String(config.ports.ingestor),
    },
    healthUrl: `http://127.0.0.1:${config.ports.ingestor}/health`,
  };
}

export function runnerConfig(
  binary: string,
  config: NoxResolvedConfig,
  contractAddress: string,
  chainId: string,
  rpcUrl: string,
): ServiceConfig {
  return {
    name: "nox-runner",
    binary,
    args: [],
    env: {
      NOX_RUNNER_CHAIN_ID: chainId,
      NOX_RUNNER_RPC_URL: rpcUrl,
      NOX_RUNNER_NOX_COMPUTE_CONTRACT_ADDRESS: contractAddress,
      NOX_RUNNER_NATS_URL: `nats://127.0.0.1:${config.ports.nats}`,
      NOX_RUNNER_HANDLE_GATEWAY_URL: `http://127.0.0.1:${config.ports.gateway}`,
      NOX_RUNNER_WALLET_KEY: config.keys.runner.walletKey,
      NOX_RUNNER_SERVER__PORT: String(config.ports.runner),
    },
    healthUrl: `http://127.0.0.1:${config.ports.runner}/health`,
  };
}
