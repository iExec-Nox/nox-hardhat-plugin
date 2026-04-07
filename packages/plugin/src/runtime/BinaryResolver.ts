import { exec } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

// TODO: Package binaries as a plugin dependency and download them via a
//       postinstall script. Until then, place all binaries in NOX_BIN_DIR
//       (env var override) or the default cache location below.

export type ServiceName =
  | "nats"
  | "minio"
  | "kms"
  | "gateway"
  | "ingestor"
  | "runner";

const BINARY_NAMES: Record<ServiceName, string> = {
  nats: "nats-server",
  minio: "minio",
  kms: "nox-kms",
  gateway: "nox-handle-gateway",
  ingestor: "nox-ingestor",
  runner: "nox-runner",
};

const _arch = process.arch === "arm64" ? "arm64" : "x64";
const _os = process.platform === "darwin" ? "darwin" : "linux";

export const NOX_BIN_DIR =
  process.env["NOX_BIN_DIR"] ??
  join(homedir(), ".cache", "hardhat-nox", "poc", `${_os}-${_arch}`);

export function resolveBinary(service: ServiceName): string {
  return join(NOX_BIN_DIR, BINARY_NAMES[service]);
}

/**
 * Kill any Nox service processes left over from a previous crashed test run.
 *
 * Uses the resolved binary paths (same ones the plugin would launch) so only
 * processes started by this plugin installation are targeted. An unrelated
 * nats-server or minio instance running on the same machine is not affected.
 *
 * Safe to call even when no Nox processes are running — exits silently.
 *
 * Usage in a test before() hook:
 *   import { cleanupNoxProcesses } from "@iexec-nox/hardhat-nox";
 *   before(() => cleanupNoxProcesses());
 *
 * Or from the command line:
 *   node -e "import('@iexec-nox/hardhat-nox').then(m => m.cleanupNoxProcesses())"
 */
export async function cleanupNoxProcesses(): Promise<void> {
  const services: ServiceName[] = [
    "nats",
    "minio",
    "kms",
    "gateway",
    "ingestor",
    "runner",
  ];

  await Promise.all(
    services.map(
      (service) =>
        new Promise<void>((resolve) => {
          // pkill -f matches the full command line, so the absolute binary path
          // narrows the kill to this plugin's processes only.
          const binPath = resolveBinary(service);
          exec(`pkill -f ${JSON.stringify(binPath)}`, () => resolve());
        }),
    ),
  );
}
