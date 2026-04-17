import path from "node:path";
import { IDockerComposeOptions } from "docker-compose";

export const NOX_COMPUTE_ADDRESS = "0xd464B198f06756a1d00be223634b85E0a731c229";
export const NOX_COMPUTE_CONTRACT_NAME = "NoxCompute";
export const NOX_KMS_PUBLIC_KEY =
  "0x03902284a6bd5198b4a32ef2319fc3ae37ea166aff0320eaa8addb0182ee80381e";
export const NOX_GATEWAY_ADDRESS = "0xE1a6B1De3AbF04e7FA5355373880350Dc3004D0e";

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
