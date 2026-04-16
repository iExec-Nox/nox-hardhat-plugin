import path from "node:path";
import { fileURLToPath } from "node:url";

import { upAll } from "docker-compose";

const COMPOSE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "local-stack",
);

export default async function () {
  console.log(`[nox] Starting docker stack from ${COMPOSE_DIR}...`);
  await upAll({
    cwd: COMPOSE_DIR,
    log: true,
    commandOptions: ["--remove-orphans"],
  });
  console.log("[nox] Docker stack is up.");
}
