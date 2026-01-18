import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";

export default async function (
  _taskArguments: unknown,
  hre: HardhatRuntimeEnvironment,
) {
  const status = await hre.coreMock.status();
  console.log(
    `Core contract at ${status.address} on chainId ${status.chainId}: ${
      status.hasCode ? "ok" : "missing"
    }`,
  );
}
