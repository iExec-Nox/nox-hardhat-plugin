import http from "node:http";
import { DOCKER_PING_TIMEOUT_MS } from "../nox-config.js";

export async function assertDockerDaemonRunning(): Promise<void> {
  const dockerHost = process.env.DOCKER_HOST;
  if (dockerHost !== undefined && dockerHost !== "") {
    if (!dockerHost.startsWith("unix://")) return;
  }

  const socketPath = dockerHost?.startsWith("unix://")
    ? dockerHost.slice("unix://".length)
    : process.platform === "win32"
      ? "\\\\.\\pipe\\docker_engine"
      : "/var/run/docker.sock";

  // Ping the daemon's `/_ping` health endpoint over the socket (returns 200 OK).
  const reachable = await new Promise<boolean>((resolve) => {
    const request = http.request(
      {
        socketPath,
        path: "/_ping",
        method: "GET",
        timeout: DOCKER_PING_TIMEOUT_MS,
      },
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
