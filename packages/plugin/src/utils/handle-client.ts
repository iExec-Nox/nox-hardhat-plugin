import {
  createEthersHandleClient,
  createViemHandleClient,
} from "@iexec-nox/handle";
import type { HandleClient, HandleClientConfig } from "@iexec-nox/handle";
import type { NetworkConnection } from "hardhat/types/network";
import type { WalletClient } from "viem";

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


export function asSingleAccountWalletClient(
  signer: WalletClient,
): WalletClient {
  const address = signer.account?.address;
  if (address === undefined) {
    throw new Error("[nox] signer has no account");
  }
  const client = Object.create(signer) as WalletClient;
  (client as unknown as Record<string, unknown>).getAddresses = async () => [
    address,
  ];
  return client;
}

/**
 * Build a handle client.
 *
 * With `options.signer`, the client is bound to that viem wallet's account (so
 * proofs and user decryptions act as that account instead of the default
 * Hardhat account[0]). Otherwise the toolbox is auto-detected from the
 * connection — `@nomicfoundation/hardhat-toolbox-viem` (`connection.viem`) or
 * `@nomicfoundation/hardhat-ethers` (`connection.ethers`) — and the client is
 * bound to its first signer.
 */
export async function createHandleClient(
  connection: NetworkConnection<"op">,
  config: Partial<HandleClientConfig>,
  options: { signer?: WalletClient; factories?: HandleClientFactories } = {},
): Promise<HandleClient> {
  const { signer, factories = defaultFactories } = options;

  if (signer !== undefined) {
    return factories.viem(
      asSingleAccountWalletClient(signer) as ViemWalletClient,
      config,
    );
  }

  if (hasViem(connection)) {
    const [walletClient] = await connection.viem.getWalletClients();
    return factories.viem(walletClient, config);
  }

  if (hasEthers(connection)) {
    const [ethersSigner] = await connection.ethers.getSigners();
    return factories.ethers(ethersSigner, config);
  }

  throw new Error(
    "[nox] No supported Hardhat toolbox found on the network connection. " +
      "Enable `@nomicfoundation/hardhat-toolbox-viem` or " +
      "`@nomicfoundation/hardhat-ethers` in your Hardhat config.",
  );
}
