import { readFile } from "node:fs/promises";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { BuildInfoOutput, CompiledContract } from "./types.js";

/**
 * Loads the compiled ABI + deployedBytecode for a contract name. Hardhat 3
 * does not emit a standalone JSON artifact for contracts imported from npm
 * packages (e.g. NoxCompute from `@iexec-nox/nox-protocol-contracts`), so we
 * fall back to scanning the build-info output.
 */
export async function loadCompiledContract(
  hre: HardhatRuntimeEnvironment,
  contractName: string,
): Promise<CompiledContract> {
  const artifact = await hre.artifacts.readArtifact(contractName);
  if (artifact.deployedBytecode && artifact.deployedBytecode !== "0x") {
    return {
      abi: artifact.abi,
      deployedBytecode: artifact.deployedBytecode as `0x${string}`,
    };
  }
  
  for (const id of await hre.artifacts.getAllBuildInfoIds()) {
    const outputPath = await hre.artifacts.getBuildInfoOutputPath(id);
    if (outputPath === undefined) continue;

    const parsed = JSON.parse(
      await readFile(outputPath, "utf-8"),
    ) as BuildInfoOutput;
    for (const contracts of Object.values(parsed.output?.contracts ?? {})) {
      const contract = contracts[contractName];
      const bytecode = contract?.evm?.deployedBytecode?.object;
      if (contract?.abi && bytecode) {
        return {
          abi: contract.abi,
          deployedBytecode: (bytecode.startsWith("0x")
            ? bytecode
            : `0x${bytecode}`) as `0x${string}`,
        };
      }
    }
  }

  throw new Error(
    `[nox] Could not find compiled artifact for ${contractName}. Compile the project first.`,
  );
}
