import path from "node:path";
import { fileURLToPath } from "node:url";

import { downAll } from "docker-compose";

const COMPOSE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "offchain-services",
);

export default async function () {
  console.log(`[nox] Stopping docker stack from ${COMPOSE_DIR}...`);
  await downAll({
    cwd: COMPOSE_DIR,
    composeOptions: [["--env-file", "dev.env"]],
    commandOptions: ["--volumes", "--remove-orphans"],
    log: true,
  });
  console.log("[nox] Docker stack is down.");
}
