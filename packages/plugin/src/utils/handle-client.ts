import type {} from "@nomicfoundation/hardhat-ethers";
import type {} from "@nomicfoundation/hardhat-toolbox-viem";
import {
  createEthersHandleClient,
  createViemHandleClient,
} from "@iexec-nox/handle";
import type { HandleClient, HandleClientConfig } from "@iexec-nox/handle";
import type { NetworkConnection } from "hardhat/types/network";

export interface HandleClientFactories {
  viem: typeof createViemHandleClient;
  ethers: typeof createEthersHandleClient;
}

const defaultFactories: HandleClientFactories = {
  viem: createViemHandleClient,
  ethers: createEthersHandleClient,
};

export async function createHandleClient(
  connection: NetworkConnection<"op">,
  config: Partial<HandleClientConfig>,
  factories: HandleClientFactories = defaultFactories,
): Promise<HandleClient> {
  if ((connection as { viem?: unknown }).viem != null) {
    const [walletClient] = await connection.viem.getWalletClients();
    return factories.viem(walletClient, config);
  }

  if ((connection as { ethers?: unknown }).ethers != null) {
    const [signer] = await connection.ethers.getSigners();
    return factories.ethers(signer, config);
  }

  throw new Error(
    "[nox] No supported Hardhat toolbox found on the network connection. " +
      "Enable `@nomicfoundation/hardhat-toolbox-viem` or " +
      "`@nomicfoundation/hardhat-ethers` in your Hardhat config.",
  );
}
