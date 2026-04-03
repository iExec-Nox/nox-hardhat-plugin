import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { waitForHealthy } from "../../src/runtime/HealthChecker.js";

const URL = "http://127.0.0.1:9000/health";

const okResponse = { ok: true } as Response;
const notOkResponse = { ok: false, status: 503 } as Response;

describe("waitForHealthy", () => {
  it("resolves immediately when service is healthy on first poll", async () => {
    const fetchFn = async () => okResponse;
    await assert.doesNotReject(() => waitForHealthy(URL, 5_000, 50, fetchFn));
  });

  it("retries and resolves when service becomes healthy after 2 failures", async () => {
    let calls = 0;
    const fetchFn = async (): Promise<Response> => {
      calls++;
      if (calls < 3) throw new Error("ECONNREFUSED");
      return okResponse;
    };
    await assert.doesNotReject(() => waitForHealthy(URL, 5_000, 10, fetchFn));
    assert.equal(calls, 3);
  });

  it("retries on non-ok response before eventually succeeding", async () => {
    let calls = 0;
    const fetchFn = async (): Promise<Response> => {
      calls++;
      return calls < 3 ? notOkResponse : okResponse;
    };
    await assert.doesNotReject(() => waitForHealthy(URL, 5_000, 10, fetchFn));
    assert.equal(calls, 3);
  });

  it("rejects with Timeout error when deadline expires", async () => {
    const fetchFn = async (): Promise<Response> => {
      throw new Error("ECONNREFUSED");
    };
    await assert.rejects(
      () => waitForHealthy(URL, 100, 20, fetchFn),
      (err: Error) => {
        assert.ok(
          err.message.includes("Timeout"),
          `expected Timeout in message, got: ${err.message}`,
        );
        return true;
      },
    );
  });

  it("rejects with the correct URL in the Timeout message", async () => {
    const fetchFn = async (): Promise<Response> => {
      throw new Error("ECONNREFUSED");
    };
    await assert.rejects(
      () => waitForHealthy(URL, 50, 20, fetchFn),
      (err: Error) => {
        assert.ok(
          err.message.includes(URL),
          `expected URL in error message, got: ${err.message}`,
        );
        return true;
      },
    );
  });
});
