import { readFile } from "node:fs/promises";
import type { DeploymentArtifact } from "../types.js";

/**
 * Loads a Hardhat-compiled artifact (ABI + creation/deployed bytecode) from an
 * absolute path.
 */
export async function loadDeploymentArtifact(
  filePath: string,
): Promise<DeploymentArtifact> {
  const raw = await readFile(filePath, "utf-8").catch((err: unknown) => {
    throw new Error(
      `[nox] Could not read artifact at ${filePath}. Underlying error: ${String(err)}`,
    );
  });
  return JSON.parse(raw) as DeploymentArtifact;
}
