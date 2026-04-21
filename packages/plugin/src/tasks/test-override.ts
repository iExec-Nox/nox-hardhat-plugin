import type { JsonRpcServer } from "hardhat/types/network";
import type { TaskOverrideActionFunction } from "hardhat/types/tasks";
import { deployNoxCompute } from "../utils/nox-compute.js";
import {
  dumpOffchainServicesLogs,
  startOffchainServices,
  stopOffchainServices,
} from "../utils/offchain-services.js";

const testWrapperAction: TaskOverrideActionFunction = async (
  args,
  hre,
  runSuper,
) => {
  if (hre.config.nox.skipTestOverride) {
    console.log(
      "[nox] nox.skipTestOverride=true — running `hardhat test` without the Nox stack.",
    );
    await runSuper(args);
    return;
  }

  let server: JsonRpcServer | undefined;
  try {
    // TODO: expose the user-selected network (EDR simulated, mainnet fork,
    // external http, …) over HTTP instead of hardcoding `createServer` on
    // the default network / port 8545. The plugin should follow whatever
    // `--network` the consumer project chose (e.g. a fork of Arbitrum
    // Sepolia where NoxCompute is already deployed) so that:
    //   - Docker services read on-chain state matching the user's setup
    //   - `setCode` can be skipped when the target chain already has
    //     NoxCompute (fork case)
    //   - test files reach it via plain `hre.network.connect()` with no
    //     hardcoded URL / port.
    server = await hre.network.createServer(undefined, "0.0.0.0", 8545);
    const { address, port } = await server.listen();
    console.log(`[nox] Hardhat node listening on ${address}:${port}`);

    await deployNoxCompute(`http://127.0.0.1:${port}`);
    await startOffchainServices();

    await runSuper(args);
  } catch (err) {
    await dumpOffchainServicesLogs().catch(() => {});
    throw err;
  } finally {
    await stopOffchainServices().catch(() => {});
    await server?.close().catch(() => {});
  }
};

export default testWrapperAction;
