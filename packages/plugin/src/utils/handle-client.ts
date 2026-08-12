import {
  createEthersHandleClient,
  createViemHandleClient,
} from "@iexec-nox/handle";
import type {
  EthereumAddress,
  HandleClient,
  HandleClientConfig,
} from "@iexec-nox/handle";
import type { ChainType, NetworkConnection } from "hardhat/types/network";

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

function hasViem<ChainTypeT extends ChainType | string>(
  connection: NetworkConnection<ChainTypeT>,
): connection is NetworkConnection<ChainTypeT> & ViemConnection {
  return (connection as Partial<ViemConnection>).viem != null;
}

function hasEthers<ChainTypeT extends ChainType | string>(
  connection: NetworkConnection<ChainTypeT>,
): connection is NetworkConnection<ChainTypeT> & EthersConnection {
  return (connection as Partial<EthersConnection>).ethers != null;
}

function isSameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function accountNotFoundError(
  account: EthereumAddress,
  available: string[],
): Error {
  return new Error(
    `[nox] account "${account}" not found among connection accounts. ` +
      `Available: ${available.join(", ")}`,
  );
}

function selectViemWalletClient(
  walletClients: ViemWalletClient[],
  account: EthereumAddress,
): ViemWalletClient {
  const match = walletClients.find(
    (client) =>
      client.account !== undefined &&
      isSameAddress(client.account.address, account),
  );
  if (match === undefined) {
    const available = walletClients
      .map((client) => client.account?.address)
      .filter((address): address is `0x${string}` => address !== undefined);
    throw accountNotFoundError(account, available);
  }
  return match;
}

// `EthersSigner` covers every client `createEthersHandleClient` accepts
// (`AbstractSigner | BrowserProvider`), but only signers expose `getAddress`
// — a `BrowserProvider` can't be matched against a requested account.
function hasGetAddress(
  client: EthersSigner,
): client is EthersSigner & { getAddress(): Promise<string> } {
  return typeof (client as { getAddress?: unknown }).getAddress === "function";
}

async function selectEthersSigner(
  signers: EthersSigner[],
  account: EthereumAddress,
): Promise<EthersSigner> {
  const addressableSigners = signers.filter(hasGetAddress);
  const addresses = await Promise.all(
    addressableSigners.map((signer) => signer.getAddress()),
  );
  const index = addresses.findIndex((address) =>
    isSameAddress(address, account),
  );
  if (index === -1) {
    throw accountNotFoundError(account, addresses);
  }
  return addressableSigners[index];
}

/**
 * Build a handle client from whichever Hardhat toolbox the project enables:
 * `@nomicfoundation/hardhat-toolbox-viem` (`connection.viem`) or
 * `@nomicfoundation/hardhat-ethers` (`connection.ethers`). The client is bound
 * to `account` when given (throwing if it matches none of the connection's
 * accounts), or to the connection's first signer otherwise, so
 * user-decryption ACLs line up with the account the caller acts as.
 */
export async function createHandleClient<ChainTypeT extends ChainType | string>(
  connection: NetworkConnection<ChainTypeT>,
  config: Partial<HandleClientConfig>,
  account?: EthereumAddress,
  factories: HandleClientFactories = defaultFactories,
): Promise<HandleClient> {
  if (hasViem(connection)) {
    const walletClients = await connection.viem.getWalletClients();
    const walletClient =
      account === undefined
        ? walletClients[0]
        : selectViemWalletClient(walletClients, account);
    return factories.viem(walletClient, config);
  }

  if (hasEthers(connection)) {
    const signers = await connection.ethers.getSigners();
    const signer =
      account === undefined
        ? signers[0]
        : await selectEthersSigner(signers, account);
    return factories.ethers(signer, config);
  }

  throw new Error(
    "[nox] No supported Hardhat toolbox found on the network connection. " +
      "Enable `@nomicfoundation/hardhat-toolbox-viem` or " +
      "`@nomicfoundation/hardhat-ethers` in your Hardhat config.",
  );
}
