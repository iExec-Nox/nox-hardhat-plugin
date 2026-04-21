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
  if (hre.config.myConfig.skipTestOverride) {
    console.log(
      "[nox] myConfig.skipTestOverride=true — running `hardhat test` without the Nox stack.",
    );
    await runSuper(args);
    return;
  }

  let server: JsonRpcServer | undefined;
  try {
    // TODO: check how to make the server replace the one started by original test task to be able to use hre.connection
    server = await hre.network.createServer(undefined, "0.0.0.0", 8545);
    const { address, port } = await server.listen();
    console.log(`[nox] Hardhat node listening on ${address}:${port}`);

    await deployNoxCompute(`http://127.0.0.1:${port}`);
    await startOffchainServices();

    await runSuper(args);
  } catch (err) {
    await dumpOffchainServicesLogs().catch(() => {
      /* best-effort diagnostic */
    });
    throw err;
  } finally {
    await stopOffchainServices().catch(() => {
      /* best-effort cleanup */
    });
    await server?.close().catch(() => {
      /* best-effort cleanup */
    });
  }
};

export default testWrapperAction;
