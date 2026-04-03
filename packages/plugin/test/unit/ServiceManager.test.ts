import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EventEmitter } from "node:events";
import type { SpawnOptions, ChildProcess } from "node:child_process";

import { ServiceManager } from "../../src/runtime/ServiceManager.js";

interface FakeProcess {
  stdout: EventEmitter;
  stderr: EventEmitter;
  killed: boolean;
  _lastSignal: string;
  pid: number;
  kill: (signal?: string) => boolean;
  once: (event: string, cb: (...args: unknown[]) => void) => this;
  on: (event: string, cb: (...args: unknown[]) => void) => this;
  emit: (event: string, ...args: unknown[]) => boolean;
}

function makeFakeProcess(): FakeProcess {
  const emitter = new EventEmitter();
  const proc: FakeProcess = {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    killed: false,
    _lastSignal: "",
    pid: 12345,
    kill(signal = "SIGTERM") {
      this.killed = true;
      this._lastSignal = signal;
      return true;
    },
    once(event, cb) {
      emitter.once(event, cb);
      return this;
    },
    on(event, cb) {
      emitter.on(event, cb);
      return this;
    },
    emit(event, ...args) {
      return emitter.emit(event, ...args);
    },
  };
  return proc;
}

function makeSpawnFn(fakeProc: FakeProcess) {
  return () => fakeProc as unknown as ChildProcess;
}

describe("ServiceManager", () => {
  it("spawns the binary with provided env vars", () => {
    let capturedBinary = "";
    let capturedEnv: Record<string, string> = {};
    const fakeProc = makeFakeProcess();

    const spawnFn = (cmd: string, _args: string[], opts: SpawnOptions) => {
      capturedBinary = cmd;
      capturedEnv = (opts.env ?? {}) as Record<string, string>;
      return fakeProc as unknown as ChildProcess;
    };

    const mgr = new ServiceManager(
      "test-svc",
      "/bin/test",
      [],
      { FOO: "bar" },
      5_000,
      spawnFn,
    );
    mgr.start();

    assert.equal(capturedBinary, "/bin/test");
    assert.equal(capturedEnv.FOO, "bar");
  });

  it("sends SIGTERM on stop and resolves when process exits", async () => {
    const fakeProc = makeFakeProcess();
    const mgr = new ServiceManager(
      "test-svc",
      "/bin/test",
      [],
      {},
      5_000,
      makeSpawnFn(fakeProc),
    );
    mgr.start();

    const stopPromise = mgr.stop();
    setImmediate(() => fakeProc.emit("exit", 0));
    await stopPromise;

    assert.ok(fakeProc.killed, "kill() should have been called");
    assert.equal(fakeProc._lastSignal, "SIGTERM");
  });

  it("throws if start() is called when already running", () => {
    const fakeProc = makeFakeProcess();
    const mgr = new ServiceManager(
      "test-svc",
      "/bin/test",
      [],
      {},
      5_000,
      makeSpawnFn(fakeProc),
    );
    mgr.start();
    assert.throws(
      () => mgr.start(),
      (err: Error) => {
        assert.ok(err.message.includes("already running"));
        return true;
      },
    );
  });

  it("isRunning returns true after start and false after stop", async () => {
    const fakeProc = makeFakeProcess();
    const mgr = new ServiceManager(
      "test-svc",
      "/bin/test",
      [],
      {},
      5_000,
      makeSpawnFn(fakeProc),
    );

    assert.equal(mgr.isRunning(), false);
    mgr.start();
    assert.equal(mgr.isRunning(), true);

    const stopPromise = mgr.stop();
    setImmediate(() => fakeProc.emit("exit", 0));
    await stopPromise;

    assert.equal(mgr.isRunning(), false);
  });

  it("stop() resolves immediately when not running", async () => {
    const mgr = new ServiceManager("test-svc", "/bin/test", [], {});
    await assert.doesNotReject(() => mgr.stop());
  });
});
