type StopSignal = "SIGINT" | "SIGTERM";
type StopEvent = "beforeExit" | StopSignal;

export interface ExitSignalSource {
  once(event: StopEvent, listener: () => void): unknown;
  on(event: StopEvent, listener: () => void): unknown;
  off(event: StopEvent, listener: () => void): unknown;
  kill(pid: number, signal?: string | number): true;
  pid: number;
}

/**
 * Installs a single idempotent cleanup, triggered by whichever comes first:
 * Node's `beforeExit` (normal end of a `hardhat test`/`hardhat run` process),
 * a `SIGINT`/`SIGTERM` signal (Ctrl+C / termination).
 *
 * This is a plugin, not the owner of the host process: it must not decide on
 * the host's behalf that the process should exit. So on a signal, once
 * cleanup settles, we remove our own listener and re-raise the same signal
 * instead of calling `process.exit()` ourselves — falling through to Node's
 * default terminate behavior, or to any other listener the host/consumer has
 * registered, exactly as if we had never intercepted it.
 */
export function installCleanupOnExit(
  cleanup: () => Promise<void>,
  options: {
    source?: ExitSignalSource;
  } = {},
): void {
  const { source = process } = options;

  let cleanupPromise: Promise<void> | undefined;
  const runOnce = (): Promise<void> => {
    if (cleanupPromise === undefined) {
      try {
        cleanupPromise = cleanup();
      } catch (err) {
        cleanupPromise = Promise.reject(
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    }
    return cleanupPromise;
  };

  source.once("beforeExit", () => {
    void runOnce();
  });

  const onStopSignal = (stopSignal: StopSignal) => {
    let handled = false;
    const listener = () => {
      if (handled) {
        return;
      }
      handled = true;
      void runOnce().finally(() => {
        // unregister and raise again the signal after the cleanup is done
        source.off(stopSignal, listener);
        source.kill(source.pid, stopSignal);
      });
    };
    source.on(stopSignal, listener);
  };
  onStopSignal("SIGINT");
  onStopSignal("SIGTERM");
}
