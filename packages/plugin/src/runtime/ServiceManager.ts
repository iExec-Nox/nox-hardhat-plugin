import {
  spawn,
  type ChildProcess,
  type SpawnOptions,
} from "node:child_process";

type SpawnFn = (
  cmd: string,
  args: string[],
  opts: SpawnOptions,
) => ChildProcess;

export class ServiceManager {
  private proc: ChildProcess | null = null;

  constructor(
    private readonly name: string,
    private readonly binary: string,
    private readonly args: string[],
    protected readonly env: Record<string, string>,
    private readonly sigkillTimeoutMs = 5_000,
    private readonly spawnFn: SpawnFn = spawn,
  ) {}

  start(): void {
    if (this.proc !== null) {
      throw new Error(`[${this.name}] already running`);
    }
    this.proc = this.spawnFn(this.binary, this.args, {
      env: { ...process.env, ...this.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.proc.stdout?.on("data", (d: Buffer) =>
      process.stdout.write(`[${this.name}] ${d.toString()}`),
    );
    this.proc.stderr?.on("data", (d: Buffer) =>
      process.stderr.write(`[${this.name}] ${d.toString()}`),
    );
    this.proc.on("exit", (code: number | null) => {
      this.proc = null;
      if (code !== 0 && code !== null) {
        console.error(`[${this.name}] exited with code ${code}`);
      }
    });
  }

  stop(): Promise<void> {
    if (this.proc === null) return Promise.resolve();
    return new Promise((resolve) => {
      const proc = this.proc!;
      const timer = setTimeout(
        () => proc.kill("SIGKILL"),
        this.sigkillTimeoutMs,
      );
      proc.once("exit", () => {
        clearTimeout(timer);
        this.proc = null;
        resolve();
      });
      proc.kill("SIGTERM");
    });
  }

  isRunning(): boolean {
    return this.proc !== null;
  }
}
