import { readFile } from "node:fs/promises";
import path from "node:path";
import { NOX_PROTOCOL_DEPLOYMENTS_DIR } from "../nox-config.js";
import type { DeploymentArtifact } from "../types.js";

/**
 * Loads an Ignition deployment artifact (ABI + deployedBytecode) shipped by
 * `@iexec-nox/nox-protocol-contracts` under
 * `ignition/deployments/arbitrumSepolia/artifacts/`.
 */
export async function loadDeploymentArtifact(
  fileName: string,
): Promise<DeploymentArtifact> {
  const filePath = path.join(NOX_PROTOCOL_DEPLOYMENTS_DIR, fileName);
  const raw = await readFile(filePath, "utf-8").catch((err: unknown) => {
    throw new Error(
      `[nox] Could not read ${fileName} at ${filePath}. Make sure '@iexec-nox/nox-protocol-contracts' (>=0.2.2) is installed. Underlying error: ${String(err)}`,
    );
  });
  return JSON.parse(raw) as DeploymentArtifact;
}
