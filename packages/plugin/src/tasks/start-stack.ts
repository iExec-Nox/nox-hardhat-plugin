import path from "node:path";
import { fileURLToPath } from "node:url";
import { upAll } from "docker-compose";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { NOX_COMPUTE_ADDRESS, NOX_COMPUTE_CONTRACT_NAME } from "../nox-config.js";
import { loadDeployedBytecode } from "../utils/artifacts.js";

const COMPOSE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "offchain-services",
);

export default async function (
  _taskArguments: unknown,
  hre: HardhatRuntimeEnvironment,
) {
  const deployedBytecode = await loadDeployedBytecode(
    hre,
    NOX_COMPUTE_CONTRACT_NAME,
  );
  const connection = await hre.network.connect();
  await connection.provider.request({
    method: "hardhat_setCode",
    params: [NOX_COMPUTE_ADDRESS, deployedBytecode],
  });
  console.log(
    `[nox] Injected ${NOX_COMPUTE_CONTRACT_NAME} bytecode at ${NOX_COMPUTE_ADDRESS} via hardhat_setCode.`,
  );

  console.log(`[nox] Starting docker stack from ${COMPOSE_DIR}...`);
  await upAll({
    cwd: COMPOSE_DIR,
    log: true,
    composeOptions: [["--env-file", "dev.env"]],
    commandOptions: ["--remove-orphans"],
  });
  console.log("[nox] Docker stack is up.");
}
