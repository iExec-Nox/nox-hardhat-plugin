import path from "node:path";
import { IDockerComposeOptions } from "docker-compose";
import type { Address } from "viem";

export const NOX_COMPUTE_CONTRACT_NAME = "NoxCompute";
export const NOX_KMS_PUBLIC_KEY =
  "0x03902284a6bd5198b4a32ef2319fc3ae37ea166aff0320eaa8addb0182ee80381e";
export const NOX_GATEWAY_ADDRESS = "0xE1a6B1De3AbF04e7FA5355373880350Dc3004D0e";

/**
 * Chain-id → NoxCompute address map. Must stay in sync with
 * `noxComputeContract()` in `@iexec-nox/nox-protocol-contracts`'s
 * `contracts/sdk/Nox.sol`, because contracts built against that library look up
 * NoxCompute at whichever address this table resolves for `block.chainid`.
 */
export const NOX_COMPUTE_ADDRESSES: Record<number, Address> = {
  421614: "0xd464B198f06756a1d00be223634b85E0a731c229", // Arbitrum Sepolia
  31337: "0x44C00793aD4975617b3B5Fc27D4FB78E772c8236", // Local dev chain
};

export const COMPOSE_OPTS: IDockerComposeOptions = {
  cwd: path.resolve(import.meta.dirname, "..", "..", "offchain-services"),
  log: false,
  composeOptions: [["--env-file", "dev.env"]],
};

export const ALL_SERVICES = [
  "nats",
  "s3",
  "nox-kms",
  "nox-handle-gateway",
  "nox-ingestor",
  "nox-runner",
];
