import { readFile } from "node:fs/promises";

import { HardhatRuntimeEnvironment } from "hardhat/types/hre";

interface BuildInfoOutput {
  output?: {
    contracts?: Record<
      string,
      Record<string, { evm?: { deployedBytecode?: { object?: string } } }>
    >;
  };
}

/**
 * Hardhat 3 does not emit a standalone JSON artifact for contracts imported
 * from npm packages, so `readArtifact` may fail. Fall back to scanning the
 * build-info output to extract `deployedBytecode`.
 */
export async function loadDeployedBytecode(
  hre: HardhatRuntimeEnvironment,
  contractName: string,
): Promise<string> {
  const artifact = await hre.artifacts.readArtifact(contractName);
  if (artifact.deployedBytecode && artifact.deployedBytecode !== "0x") {
    return artifact.deployedBytecode;
  }

  for (const id of await hre.artifacts.getAllBuildInfoIds()) {
    const outputPath = await hre.artifacts.getBuildInfoOutputPath(id);
    if (outputPath === undefined) continue;

    const parsed = JSON.parse(
      await readFile(outputPath, "utf-8"),
    ) as BuildInfoOutput;
    for (const contracts of Object.values(parsed.output?.contracts ?? {})) {
      const bytecode = contracts[contractName]?.evm?.deployedBytecode?.object;
      if (bytecode)
        return bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`;
    }
  }

  throw new Error(
    `[nox] Could not find deployedBytecode for ${contractName}. Compile the project first.`,
  );
}
