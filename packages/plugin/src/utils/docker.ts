import http from "node:http";

const PING_TIMEOUT_MS = 2000;

function dockerSocketPath(): string | undefined {
  const dockerHost = process.env.DOCKER_HOST;
  if (dockerHost !== undefined && dockerHost !== "") {
    if (dockerHost.startsWith("unix://")) {
      return dockerHost.slice("unix://".length);
    }
    return undefined;
  }
  return process.platform === "win32"
    ? "\\\\.\\pipe\\docker_engine"
    : "/var/run/docker.sock";
}

export async function assertDockerDaemonRunning(): Promise<void> {
  const socketPath = dockerSocketPath();
  if (socketPath === undefined) {
    return;
  }

  const reachable = await new Promise<boolean>((resolve) => {
    const request = http.request(
      { socketPath, path: "/_ping", method: "GET", timeout: PING_TIMEOUT_MS },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      },
    );
    request.on("error", () => resolve(false));
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.end();
  });

  if (!reachable) {
    throw new Error(
      "[nox] Cannot connect to the Docker daemon. Is Docker running? " +
        "Start Docker Desktop (or the docker service) and try again.",
    );
  }
}
