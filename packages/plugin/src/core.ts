import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { EthereumProvider } from "hardhat/types/providers";
import HelloWorldArtifact from "../artifacts/contracts/HelloWorld.sol/HelloWorld.json" with { type: "json" };

import type { CoreMockRuntime } from "./types.js";
import { CORE_CONTRACT_ADDRESS } from "./config.js";

const HELLO_WORLD_RUNTIME_BYTECODE = HelloWorldArtifact.deployedBytecode;

export function createCoreMockRuntime(
  hre: HardhatRuntimeEnvironment,
): CoreMockRuntime {
  return {
    install: async (options) => {
      const { provider } = await getProvider(hre);
      const { installed, skipped } = await installCoreContract(
        provider,
        CORE_CONTRACT_ADDRESS,
        {
          force: options?.force ?? false,
          quiet: options?.quiet ?? false,
        },
      );
      return { installed, skipped };
    },
    status: async () => {
      const { provider, chainId } = await getProvider(hre);
      const hasCode = await hasBytecode(provider, CORE_CONTRACT_ADDRESS);
      return { chainId, address: CORE_CONTRACT_ADDRESS, hasCode };
    },
    getAddress: () => CORE_CONTRACT_ADDRESS,
  };
}

export async function installCoreContract(
  provider: EthereumProvider,
  address: string,
  options: { force: boolean; quiet: boolean },
): Promise<{ installed: boolean; skipped: boolean }> {
  const hasCode = await hasBytecode(provider, address);
  if (hasCode && !options.force) {
    if (!options.quiet) {
      console.log("Core contract already present at", address);
    }
    return { installed: false, skipped: true };
  }

  await provider.request({
    method: "hardhat_setCode",
    params: [address, HELLO_WORLD_RUNTIME_BYTECODE],
  });

  if (!options.quiet) {
    console.log("Core contract installed at", address);
  }

  return { installed: true, skipped: false };
}

async function getProvider(hre: HardhatRuntimeEnvironment) {
  const connection = await hre.network.connect();
  const provider = connection.provider;
  const chainIdHex = await provider.request({ method: "eth_chainId" });
  const chainId = Number.parseInt(chainIdHex as string, 16);
  return { provider, chainId };
}

async function hasBytecode(
  provider: EthereumProvider,
  address: string,
): Promise<boolean> {
  const code = await provider.request({
    method: "eth_getCode",
    params: [address, "latest"],
  });
  return code !== "0x";
}
