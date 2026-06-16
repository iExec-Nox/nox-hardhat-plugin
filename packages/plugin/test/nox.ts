import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { nox } from "../src/nox.js";

const HANDLE = "0x01";

function statusResponse(resolved: boolean) {
  return {
    ok: true,
    json: async () => ({
      payload: { statuses: [{ handle: HANDLE, resolved }] },
    }),
  } as Response;
}

describe("nox.waitForHandlesResolved", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("Should return once every handle is resolved", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      statusResponse(true),
    );

    await nox.waitForHandlesResolved([HANDLE], { delayMs: 1 });

    assert.equal(fetchMock.mock.callCount(), 1);
  });

  it("Should keep polling until handles resolve", async () => {
    let calls = 0;
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      calls += 1;
      return statusResponse(calls >= 3);
    });

    await nox.waitForHandlesResolved([HANDLE], { delayMs: 1 });

    assert.equal(fetchMock.mock.callCount(), 3);
  });

  it("Should throw after exhausting maxRetries", async () => {
    mock.method(globalThis, "fetch", async () => statusResponse(false));

    await assert.rejects(
      nox.waitForHandlesResolved([HANDLE], { maxRetries: 2, delayMs: 1 }),
      /Handles not resolved after 2 attempts/,
    );
  });
});
