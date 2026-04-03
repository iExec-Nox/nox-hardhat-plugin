import { exec } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

// -----------------------------------------------------------------------------
// Binary provisioning — POC vs production
//
// POC (current):
//   Binaries are NOT bundled with this package and are NOT downloaded
//   automatically. Developers must supply them manually:
//
//   - nats-server, minio: external projects with their own release pipelines.
//     Install them via your system package manager or download from their
//     official GitHub releases, then point to them via NOX_BIN_NATS /
//     NOX_BIN_MINIO (see env vars below).
//
//   - nox-kms, nox-handle-gateway, nox-ingestor, nox-runner: iExec Nox
//     off-chain stack binaries. Build them from the local Nox Rust monorepo
//     (`cargo build --release -p <crate>`) and point to them via the
//     corresponding NOX_BIN_* env vars, or place the compiled binaries in
//     CACHE_DIR so the default resolution picks them up.
//
// Production (future):
//   When this plugin is published to npm, a postinstall script will
//   automatically download the correct platform build of the four Nox binaries
//   (nox-kms, nox-handle-gateway, nox-ingestor, nox-runner) from the iExec
//   GitHub release artifacts and place them in CACHE_DIR. nats-server and
//   minio will also be fetched from their respective official release pages.
//   No manual setup will be required — `npm install @iexec-nox/hardhat-nox`
//   will be sufficient.
//
// The NOX_BIN_* overrides remain valid in both modes and take precedence over
// any cached binary, allowing developers to test custom builds at any time.
// -----------------------------------------------------------------------------

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

// Override any binary path by setting the corresponding env var.
// Useful for testing custom builds without modifying the cache.
const ENV_VAR_NAMES: Record<ServiceName, string> = {
  nats: "NOX_BIN_NATS",
  minio: "NOX_BIN_MINIO",
  kms: "NOX_BIN_KMS",
  gateway: "NOX_BIN_GATEWAY",
  ingestor: "NOX_BIN_INGESTOR",
  runner: "NOX_BIN_RUNNER",
};

const _arch = process.arch === "arm64" ? "arm64" : "x64";
const _os = process.platform === "darwin" ? "darwin" : "linux";

// Default location for cached binaries. In production this directory is
// populated by the postinstall script; in the POC it must be populated
// manually (see provisioning notes above).
const CACHE_DIR = join(
  homedir(),
  ".cache",
  "hardhat-nox",
  "poc",
  `${_os}-${_arch}`,
);

export function resolveBinary(service: ServiceName): string {
  const override = process.env[ENV_VAR_NAMES[service]];
  if (override !== undefined && override !== "") return override;
  return join(CACHE_DIR, BINARY_NAMES[service]);
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
