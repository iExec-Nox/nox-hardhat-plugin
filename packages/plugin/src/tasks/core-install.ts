import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";

interface CoreInstallTaskArguments {
  force: boolean;
}

export default async function (
  taskArguments: CoreInstallTaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  await hre.coreMock.install({ force: taskArguments.force });
}
