import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { resolveNoxComputeArtifactPath } from "../src/nox-config.js";

// Fixtures are built under the OS tmp dir (outside this repo's own
// node_modules tree) rather than as committed files: `require.resolve` walks
// up parent directories looking for `node_modules`, so a fixture nested
// inside the monorepo could spuriously "succeed" by finding an unrelated,
// hoisted copy of the package instead of exercising the not-installed case.
describe("resolveNoxComputeArtifactPath", () => {
  let tmpRoot: string;

  before(async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), "nox-config-test"));
  });

  after(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("resolves the NoxCompute artifact from the consumer's own node_modules", async () => {
    const consumerRoot = path.join(tmpRoot, "consumer-with-nox");
    const artifactDir = path.join(
      consumerRoot,
      "node_modules",
      "@iexec-nox",
      "nox-protocol-contracts",
      "artifacts",
      "contracts",
      "NoxCompute.sol",
    );
    await mkdir(artifactDir, { recursive: true });
    await writeFile(
      path.join(consumerRoot, "package.json"),
      JSON.stringify({ name: "consumer-with-nox", version: "1.0.0" }),
    );
    await writeFile(
      path.join(
        consumerRoot,
        "node_modules",
        "@iexec-nox",
        "nox-protocol-contracts",
        "package.json",
      ),
      JSON.stringify({
        name: "@iexec-nox/nox-protocol-contracts",
        version: "0.2.4",
      }),
    );
    const artifactPath = path.join(artifactDir, "NoxCompute.json");
    await writeFile(artifactPath, JSON.stringify({ abi: [], bytecode: "0x" }));

    const resolved = resolveNoxComputeArtifactPath(consumerRoot);

    assert.ok(
      resolved.endsWith(
        path.join(
          "node_modules",
          "@iexec-nox",
          "nox-protocol-contracts",
          "artifacts",
          "contracts",
          "NoxCompute.sol",
          "NoxCompute.json",
        ),
      ),
      `expected ${resolved} to resolve under the consumer's node_modules`,
    );
  });

  it("throws a clear error when the consumer hasn't installed the dependency", async () => {
    const consumerRoot = path.join(tmpRoot, "consumer-without-nox");
    await mkdir(consumerRoot, { recursive: true });
    await writeFile(
      path.join(consumerRoot, "package.json"),
      JSON.stringify({ name: "consumer-without-nox", version: "1.0.0" }),
    );

    assert.throws(
      () => resolveNoxComputeArtifactPath(consumerRoot),
      /Could not resolve "@iexec-nox\/nox-protocol-contracts"/,
    );
  });
});
