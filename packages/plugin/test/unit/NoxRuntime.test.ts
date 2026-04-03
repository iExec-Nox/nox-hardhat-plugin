import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HandleClient } from "@iexec-nox/handle";

import { NoxRuntime } from "../../src/runtime/NoxRuntime.js";
import { resolveNoxConfig } from "../../src/config.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRuntime(contractAddress?: string): NoxRuntime {
  const config = resolveNoxConfig({ contractAddress });
  return new NoxRuntime(config, { request: async () => null });
}

/**
 * Minimal HandleClient mock — only implements decrypt(), which is the only
 * method called by waitForCompute().
 */
function makeHandleClient(
  decryptFn: (handle: `0x${string}`) => Promise<{ value: unknown }>,
): HandleClient {
  return { decrypt: decryptFn } as unknown as HandleClient;
}

// ---------------------------------------------------------------------------
// getContractAddress()
// ---------------------------------------------------------------------------

describe("NoxRuntime.getContractAddress()", () => {
  it("throws before start() is called", () => {
    const runtime = makeRuntime("0xABCD");
    assert.throws(
      () => runtime.getContractAddress(),
      (err: Error) => {
        assert.ok(err.message.includes("not started"));
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// waitForCompute()
// ---------------------------------------------------------------------------

describe("NoxRuntime.waitForCompute()", () => {
  it("resolves immediately when decrypt succeeds on the first poll", async () => {
    const runtime = makeRuntime();
    const client = makeHandleClient(async () => ({ value: 42n }));
    await assert.doesNotReject(() =>
      runtime.waitForCompute("0xhandle", client, 5_000, 10),
    );
  });

  it("retries when decrypt throws a 'not found' message", async () => {
    let calls = 0;
    const runtime = makeRuntime();
    const client = makeHandleClient(async () => {
      if (++calls < 3) throw new Error("handle not found");
      return { value: 1n };
    });
    await runtime.waitForCompute("0xhandle", client, 5_000, 10);
    assert.equal(calls, 3);
  });

  it("retries when decrypt throws a '404' message", async () => {
    let calls = 0;
    const runtime = makeRuntime();
    const client = makeHandleClient(async () => {
      if (++calls < 2) throw new Error("HTTP 404");
      return { value: 1n };
    });
    await runtime.waitForCompute("0xhandle", client, 5_000, 10);
    assert.equal(calls, 2);
  });

  it("retries when decrypt throws an 'Object not found' message", async () => {
    let calls = 0;
    const runtime = makeRuntime();
    const client = makeHandleClient(async () => {
      if (++calls < 2) throw new Error("Object not found in store");
      return { value: 1n };
    });
    await runtime.waitForCompute("0xhandle", client, 5_000, 10);
    assert.equal(calls, 2);
  });

  it("re-throws errors unrelated to 'not found'", async () => {
    const runtime = makeRuntime();
    const client = makeHandleClient(async () => {
      throw new Error("unauthorized: invalid signature");
    });
    await assert.rejects(
      () => runtime.waitForCompute("0xhandle", client, 5_000, 10),
      (err: Error) => {
        assert.ok(err.message.includes("unauthorized"));
        return true;
      },
    );
  });

  it("re-throws non-Error values thrown by decrypt", async () => {
    const runtime = makeRuntime();
    const client = makeHandleClient(async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw "raw string error";
    });
    await assert.rejects(
      () => runtime.waitForCompute("0xhandle", client, 5_000, 10),
      (err: unknown) => {
        assert.equal(err, "raw string error");
        return true;
      },
    );
  });

  it("throws a timeout error when the deadline passes without success", async () => {
    const runtime = makeRuntime();
    const client = makeHandleClient(async () => {
      throw new Error("not found");
    });
    await assert.rejects(
      () => runtime.waitForCompute("0xdeadbeef", client, 50, 10),
      (err: Error) => {
        assert.ok(
          err.message.includes("timeout"),
          `expected 'timeout', got: ${err.message}`,
        );
        assert.ok(
          err.message.includes("0xdeadbeef"),
          `expected handle in message`,
        );
        return true;
      },
    );
  });

  it("includes the timeout duration in the error message", async () => {
    const runtime = makeRuntime();
    const client = makeHandleClient(async () => {
      throw new Error("not found");
    });
    await assert.rejects(
      () => runtime.waitForCompute("0xhandle", client, 75, 10),
      (err: Error) => {
        assert.ok(
          err.message.includes("75ms"),
          `expected timeout value in message, got: ${err.message}`,
        );
        return true;
      },
    );
  });
});
