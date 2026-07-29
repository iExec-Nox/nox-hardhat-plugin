import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";
import { installCleanupOnExit } from "../src/utils/exit-cleanup.js";

describe("installCleanupOnExit", () => {
  it("runs cleanup exactly once even if beforeExit fires and then a signal also fires", async () => {
    const raised: { pid: number; signal: string }[] = [];
    const source = Object.assign(new EventEmitter(), {
      kill: (pid: number, signal: string) => {
        raised.push({ pid, signal });
        return true;
      },
      pid: 999,
    });
    let cleanupCalls = 0;
    installCleanupOnExit(
      async () => {
        cleanupCalls++;
      },
      { source },
    );

    source.emit("beforeExit");
    source.emit("SIGINT");

    assert.equal(cleanupCalls, 1);
    assert.deepEqual(raised, []);
  });

  it("re-raises SIGINT only after cleanup resolves, and removes its own listener", async () => {
    const raised: { pid: number; signal: string }[] = [];
    const source = Object.assign(new EventEmitter(), {
      kill: (pid: number, signal: string) => {
        raised.push({ pid, signal });
        return true;
      },
      pid: 999,
    });
    let resolveCleanup!: () => void;
    installCleanupOnExit(
      () =>
        new Promise((resolve) => {
          resolveCleanup = resolve;
        }),
      { source },
    );

    source.emit("SIGINT");
    await Promise.resolve(); // let execute async code
    assert.deepEqual(raised, []);
    assert.equal(source.listenerCount("SIGINT"), 1);

    resolveCleanup();
    await Promise.resolve(); // let execute async code

    assert.deepEqual(raised, [{ pid: source.pid, signal: "SIGINT" }]);
    assert.equal(source.listenerCount("SIGINT"), 0);
  });

  it("re-raises SIGTERM after cleanup resolves, and removes its own listener", async () => {
    const raised: { pid: number; signal: string }[] = [];
    const source = Object.assign(new EventEmitter(), {
      kill: (pid: number, signal: string) => {
        raised.push({ pid, signal });
        return true;
      },
      pid: 999,
    });
    installCleanupOnExit(async () => {}, {
      source,
    });

    source.emit("SIGTERM");
    await Promise.resolve(); // let execute async code

    assert.deepEqual(raised, [{ pid: source.pid, signal: "SIGTERM" }]);
    assert.equal(source.listenerCount("SIGTERM"), 0);
  });

  it("never calls process.exit itself — only re-raises the signal", async () => {
    const raised: { pid: number; signal: string }[] = [];
    let exited = false;
    const source = Object.assign(new EventEmitter(), {
      kill: (pid: number, signal: string) => {
        raised.push({ pid, signal });
        return true;
      },
      pid: 999,
      exit: () => {
        exited = true;
      },
    });
    installCleanupOnExit(async () => {}, {
      source,
    });

    source.emit("SIGINT");
    await Promise.resolve(); // let execute async code

    assert.deepEqual(raised, [{ pid: source.pid, signal: "SIGINT" }]);
    assert.equal(exited, false);
  });
});
