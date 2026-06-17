import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeDockerError } from "../src/utils/offchain-services.js";

describe("describeDockerError", () => {
  it("recognises a missing docker CLI (ENOENT)", () => {
    const err = Object.assign(new Error("spawn docker ENOENT"), {
      code: "ENOENT",
    });
    const message = describeDockerError(err);
    assert.ok(message);
    assert.match(message, /Docker CLI not found/);
  });

  it("recognises a stopped docker daemon from stderr", () => {
    const rejection = {
      exitCode: 1,
      out: "",
      err: "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?",
    };
    const message = describeDockerError(rejection);
    assert.ok(message);
    assert.match(message, /Cannot connect to the Docker daemon/);
  });

  it("returns undefined for unrelated failures", () => {
    const rejection = {
      exitCode: 1,
      out: "",
      err: "Bind for 0.0.0.0:3000 failed: port is already allocated",
    };
    assert.equal(describeDockerError(rejection), undefined);
  });
});
