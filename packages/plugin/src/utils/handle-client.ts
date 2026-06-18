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

type ViemWalletClient = Parameters<typeof createViemHandleClient>[0];
type EthersSigner = Parameters<typeof createEthersHandleClient>[0];

interface ViemConnection {
  viem: { getWalletClients(): Promise<ViemWalletClient[]> };
}

interface EthersConnection {
  ethers: { getSigners(): Promise<EthersSigner[]> };
}

function hasViem(
  connection: NetworkConnection<"op">,
): connection is NetworkConnection<"op"> & ViemConnection {
  return (connection as Partial<ViemConnection>).viem != null;
}

function hasEthers(
  connection: NetworkConnection<"op">,
): connection is NetworkConnection<"op"> & EthersConnection {
  return (connection as Partial<EthersConnection>).ethers != null;
}

/**
 * Build a handle client from whichever Hardhat toolbox the project enables:
 * `@nomicfoundation/hardhat-toolbox-viem` (`connection.viem`) or
 * `@nomicfoundation/hardhat-ethers` (`connection.ethers`). The client is bound
 * to the connection's first signer so user-decryption ACLs line up with the
 * account the tests act as.
 */
export async function createHandleClient(
  connection: NetworkConnection<"op">,
  config: Partial<HandleClientConfig>,
  factories: HandleClientFactories = defaultFactories,
): Promise<HandleClient> {
  if (hasViem(connection)) {
    const [walletClient] = await connection.viem.getWalletClients();
    return factories.viem(walletClient, config);
  }

  if (hasEthers(connection)) {
    const [signer] = await connection.ethers.getSigners();
    return factories.ethers(signer, config);
  }

  throw new Error(
    "[nox] No supported Hardhat toolbox found on the network connection. " +
      "Enable `@nomicfoundation/hardhat-toolbox-viem` or " +
      "`@nomicfoundation/hardhat-ethers` in your Hardhat config.",
  );
}
