import { rmSync, readdirSync, unlinkSync, mkdirSync } from "node:fs";
import { createViemHandleClient, type HandleClient } from "@iexec-nox/handle";
import { encodeFunctionData } from "viem";
import { privateKeyToAddress } from "viem/accounts";
import type { WalletClient } from "viem";
import * as Minio from "minio";
import type { NoxResolvedConfig, NoxRuntime as INoxRuntime } from "../types.js";
import {
  type ServiceConfig,
  NATS_STORAGE_DIR,
  MINIO_DATA_DIR,
  natsConfig,
  minioConfig,
  kmsConfig,
  gatewayConfig,
  ingestorConfig,
  runnerConfig,
} from "../services/configs.js";
import {
  S3_ACCESS_KEY,
  S3_SECRET_KEY,
  S3_BUCKET,
  S3_REGION,
} from "../services/configs.js";
import { waitForHealthy } from "./HealthChecker.js";
import { resolveBinary } from "./BinaryResolver.js";
import { ServiceManager } from "./ServiceManager.js";
import { JsonRpcServer } from "./JsonRpcServer.js";

interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

export class NoxRuntime implements INoxRuntime {
  private contractAddress: string | null = null;
  private started: ServiceManager[] = [];
  private jsonRpcServer: JsonRpcServer | null = null;

  constructor(
    private readonly config: NoxResolvedConfig,
    private readonly provider: EIP1193Provider,
  ) {}

  private async startService(cfg: ServiceConfig): Promise<void> {
    const manager = new ServiceManager(cfg.name, cfg.binary, cfg.args, cfg.env);
    manager.start();
    await waitForHealthy(cfg.healthUrl, 30_000);
    this.started.push(manager);
  }

  async start(): Promise<void> {
    const { ports } = this.config;
    const log = (msg: string) => process.stdout.write(`[nox] ${msg}\n`);
    const rpcUrl = `http://127.0.0.1:${ports.rpc}`;

    // Detect the chain ID from the provider before starting any services.
    const chainIdHex = (await this.provider.request({
      method: "eth_chainId",
    })) as string;
    const chainId = String(Number.parseInt(chainIdHex, 16));

    // 0. HTTP JSON-RPC proxy — bridges the in-process Hardhat EVM to a TCP port
    //    so external binaries (KMS, Gateway, Ingestor, Runner) can reach it.
    log(`Starting JSON-RPC server on ${rpcUrl} (chain ${chainId})...`);
    this.jsonRpcServer = new JsonRpcServer(this.provider, ports.rpc);
    await this.jsonRpcServer.start();
    log("JSON-RPC server ready");

    // 1. NATS
    log("Starting NATS...");
    rmSync(NATS_STORAGE_DIR, { recursive: true, force: true });
    await this.startService(natsConfig(resolveBinary("nats"), ports));
    log("NATS ready");

    // 2. MinIO
    log("Starting MinIO...");
    rmSync(MINIO_DATA_DIR, { recursive: true, force: true });
    mkdirSync(MINIO_DATA_DIR, { recursive: true });
    await this.startService(minioConfig(resolveBinary("minio"), ports));
    log("MinIO ready");

    // Create S3 bucket if it doesn't exist yet.
    const s3Client = new Minio.Client({
      endPoint: "127.0.0.1",
      port: ports.s3,
      useSSL: false,
      accessKey: S3_ACCESS_KEY,
      secretKey: S3_SECRET_KEY,
    });
    if (!(await s3Client.bucketExists(S3_BUCKET))) {
      await s3Client.makeBucket(S3_BUCKET, S3_REGION, { ObjectLocking: true });
    }
    log("MinIO bucket ready");

    // 3. NoxCompute contract address.
    this.contractAddress = this.config.contractAddress;
    log(`Using NoxCompute at ${this.contractAddress} (chain ${chainId})`);

    // 3b. Patch the forked NoxCompute so it accepts signatures from our local
    //     test gateway instead of the production gateway registered on-chain.
    await this.patchForkConfig(log);

    // 4. KMS
    log("Starting KMS...");
    await this.startService(
      kmsConfig(
        resolveBinary("kms"),
        this.config,
        this.contractAddress,
        chainId,
        rpcUrl,
      ),
    );
    log("KMS ready");

    // 5. Gateway
    log("Starting Gateway...");
    await this.startService(
      gatewayConfig(
        resolveBinary("gateway"),
        this.config,
        this.contractAddress,
        chainId,
        rpcUrl,
      ),
    );
    log("Gateway ready");

    // 6. Ingestor — clear stale state files first so it always starts fresh.
    //    For a local chain, start from block 1 to capture all events.
    //    For a forked chain, start from the current block to skip historical data.
    for (const f of readdirSync(process.cwd()).filter((n) =>
      n.startsWith("nox_ingestor_state_"),
    )) {
      unlinkSync(f);
    }
    const blockHex = (await this.provider.request({
      method: "eth_blockNumber",
    })) as string;
    const initialBlock = Math.max(1, Number.parseInt(blockHex, 16)).toString();
    log("Starting Ingestor...");
    await this.startService(
      ingestorConfig(
        resolveBinary("ingestor"),
        this.config,
        this.contractAddress,
        chainId,
        rpcUrl,
        initialBlock,
      ),
    );
    log("Ingestor ready");

    // 7. Runner
    log("Starting Runner...");
    await this.startService(
      runnerConfig(
        resolveBinary("runner"),
        this.config,
        this.contractAddress,
        chainId,
        rpcUrl,
      ),
    );
    log("All services started");
  }

  /**
   * Patch the forked NoxCompute contract so it accepts handle proofs signed by
   * our local test gateway instead of the production gateway registered on-chain.
   *
   * Uses hardhat_impersonateAccount to call setGateway() as the contract owner.
   */
  private async patchForkConfig(log: (msg: string) => void): Promise<void> {
    const contract = this.contractAddress!;
    const gatewayAddress = privateKeyToAddress(
      this.config.keys.gateway.walletKey as `0x${string}`,
    );

    // Read the contract owner (OZ Ownable selector: owner() = 0x8da5cb5b)
    const ownerHex = (await this.provider.request({
      method: "eth_call",
      params: [{ to: contract, data: "0x8da5cb5b" }],
    })) as string;
    const ownerAddress = `0x${ownerHex.slice(-40)}`;

    // Impersonate the owner and fund it with 1 ETH for gas
    await this.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ownerAddress],
    });
    await this.provider.request({
      method: "hardhat_setBalance",
      params: [ownerAddress, "0xDE0B6B3A7640000"],
    });

    // Call setGateway(gatewayAddress) as the owner
    await this.provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: ownerAddress,
          to: contract,
          data: encodeFunctionData({
            abi: [
              {
                type: "function" as const,
                name: "setGateway",
                inputs: [{ name: "gatewayAddress", type: "address" }],
              },
            ],
            functionName: "setGateway",
            args: [gatewayAddress],
          }),
        },
      ],
    });

    // Call setKmsPublicKey(eccPublicKey) as the owner so the Gateway encrypts
    // with our local KMS key (not the production key stored on-chain).
    await this.provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: ownerAddress,
          to: contract,
          data: encodeFunctionData({
            abi: [
              {
                type: "function" as const,
                name: "setKmsPublicKey",
                inputs: [{ name: "newKmsPublicKey", type: "bytes" }],
              },
            ],
            functionName: "setKmsPublicKey",
            args: [this.config.keys.kms.eccPublicKey as `0x${string}`],
          }),
        },
      ],
    });

    log(
      `Fork patched: gateway → ${gatewayAddress}, kmsPublicKey → ${this.config.keys.kms.eccPublicKey}`,
    );
  }

  async stop(): Promise<void> {
    // Stop in reverse startup order
    for (const manager of [...this.started].reverse()) {
      await manager.stop();
    }
    this.started = [];
    if (this.jsonRpcServer !== null) {
      await this.jsonRpcServer.stop();
      this.jsonRpcServer = null;
    }
  }

  getContractAddress(): string {
    if (this.contractAddress === null) {
      throw new Error("NoxRuntime not started — call start() first");
    }
    return this.contractAddress;
  }

  async createHandleClient(walletClient: WalletClient): Promise<HandleClient> {
    return createViemHandleClient(walletClient, {
      gatewayUrl: `http://127.0.0.1:${this.config.ports.gateway}`,
      smartContractAddress: this.getContractAddress() as `0x${string}`,
      // Local dev has no subgraph — pass a placeholder. SubgraphService is only
      // used by viewACL(), which this integration test does not call.
      subgraphUrl: "http://localhost/subgraph",
    });
  }

  async waitForCompute(
    resultHandle: string,
    handleClient: HandleClient,
    timeoutMs = 30_000,
    intervalMs = 500,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        await handleClient.decrypt(resultHandle as `0x${string}`);
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          !msg.includes("not found") &&
          !msg.includes("404") &&
          !msg.includes("Object not found")
        ) {
          throw err;
        }
      }
      await new Promise<void>((r) => setTimeout(r, intervalMs));
    }
    throw new Error(
      `waitForCompute: timeout after ${timeoutMs}ms — handle ${resultHandle} never became available`,
    );
  }
}
