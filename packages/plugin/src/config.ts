import type { HardhatUserConfig } from "hardhat/config";
import type { HardhatConfig } from "hardhat/types/config";
import type { HardhatUserConfigValidationError } from "hardhat/types/hooks";
import { isAddress } from "viem";
import { NOX_SUPPORTED_CHAIN_ID } from "./nox-config.js";

export const NOX_HOST_NETWORK = "noxHost";
export const NOX_LOCAL_NETWORK = "noxLocal";
export const NOX_LOCAL_PORT = 8545;

/**
 * Resolves the network hardhat is actually targeting:
 * the `--network` flag if set, otherwise Hardhat's `"default"`.
 */
export function resolveTargetNetworkName(
  networkOption: string | undefined,
): string {
  return networkOption !== undefined && networkOption !== ""
    ? networkOption
    : "default";
}

export async function validatePluginConfig(
  userConfig: HardhatUserConfig,
): Promise<HardhatUserConfigValidationError[]> {
  return [
    ...validateTopLevelNoxConfig(userConfig),
    ...validateNetworkNoxConfigs(userConfig),
  ];
}

function isValidUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates the optional per-network `nox` field (`networks.<name>.nox`),
 * which declares an already-running Nox stack for that network to point at.
 * Only `http` networks may carry it — an `edr-simulated` network is
 * re-created fresh on every connect, so it can never be "already running".
 * All-or-nothing per network: every problem on a network is reported (one
 * error per bad/missing field), and every network is validated
 * independently.
 */
function validateNetworkNoxConfigs(
  userConfig: HardhatUserConfig,
): HardhatUserConfigValidationError[] {
  const errors: HardhatUserConfigValidationError[] = [];

  for (const [name, networkConfig] of Object.entries(
    userConfig.networks ?? {},
  )) {
    const nox = (networkConfig as { nox?: unknown }).nox;
    if (nox === undefined) continue;

    if (networkConfig.type !== "http") {
      errors.push({
        path: ["networks", name, "nox"],
        message:
          "Only supported on http networks — an edr-simulated network is " +
          "re-created fresh on every connect, so it can never be an " +
          "already-running stack.",
      });
      continue;
    }

    if (typeof nox !== "object" || nox === null) {
      errors.push({
        path: ["networks", name, "nox"],
        message: "Expected an object.",
      });
      continue;
    }

    const { noxComputeAddress, handleGatewayUrl } = nox as {
      noxComputeAddress?: unknown;
      handleGatewayUrl?: unknown;
    };

    if (
      typeof noxComputeAddress !== "string" ||
      !isAddress(noxComputeAddress, { strict: false })
    ) {
      errors.push({
        path: ["networks", name, "nox", "noxComputeAddress"],
        message:
          noxComputeAddress === undefined
            ? "Expected an address, none was given."
            : "Expected a valid address.",
      });
    }

    if (!isValidUrl(handleGatewayUrl)) {
      errors.push({
        path: ["networks", name, "nox", "handleGatewayUrl"],
        message:
          handleGatewayUrl === undefined
            ? "Expected a URL, none was given."
            : "Expected a valid http(s) URL.",
      });
    }
  }

  return errors;
}

function validateTopLevelNoxConfig(
  userConfig: HardhatUserConfig,
): HardhatUserConfigValidationError[] {
  const nox = userConfig.nox;
  if (nox === undefined) return [];

  if (typeof nox !== "object") {
    return [{ path: ["nox"], message: "Expected an object." }];
  }

  if (
    nox.skipTestOverride !== undefined &&
    typeof nox.skipTestOverride !== "boolean"
  ) {
    return [
      {
        path: ["nox", "skipTestOverride"],
        message: "Expected a boolean.",
      },
    ];
  }

  return [];
}

/**
 * Returns a copy of `userConfig` with the plugin's internal networks injected:
 *   - `noxHost`: EDR-simulated, backs the JSON-RPC server we spawn.
 *   - `noxLocal`: HTTP, points at the local server (chainId 31337).
 * User-defined entries with the same names win (last spread).
 */
export function withInjectedNetworks(
  userConfig: HardhatUserConfig,
): HardhatUserConfig {
  return {
    ...userConfig,
    networks: {
      [NOX_HOST_NETWORK]: {
        type: "edr-simulated",
        chainType: "op",
        allowUnlimitedContractSize: true,
      },
      [NOX_LOCAL_NETWORK]: {
        type: "http",
        chainType: "op",
        chainId: NOX_SUPPORTED_CHAIN_ID,
        url: `http://127.0.0.1:${NOX_LOCAL_PORT}`,
      },
      ...userConfig.networks,
    },
  };
}

/**
 * Hardhat's own network resolution builds a brand-new object per network
 * picking only known fields — it does not spread the user's object — so a
 * plugin-added field like `nox` is dropped from `partiallyResolvedConfig`
 * unless re-attached here (same pattern as `@nomicfoundation/hardhat-ignition`
 * re-attaching its own per-network `ignition` field).
 */
function resolveNetworksWithNoxConfig(
  userConfig: HardhatUserConfig,
  networks: HardhatConfig["networks"],
): HardhatConfig["networks"] {
  return Object.fromEntries(
    Object.entries(networks ?? {}).map(([name, networkConfig]) => {
      const userNetworkConfig = userConfig.networks?.[name];
      const nox =
        userNetworkConfig?.type === "http" ? userNetworkConfig.nox : undefined;
      if (nox === undefined) return [name, networkConfig];

      return [
        name,
        {
          ...networkConfig,
          nox: {
            noxComputeAddress: nox.noxComputeAddress,
            handleGatewayUrl: nox.handleGatewayUrl.replace(/\/+$/, ""),
          },
        },
      ];
    }),
  );
}

export async function resolvePluginConfig(
  userConfig: HardhatUserConfig,
  partiallyResolvedConfig: HardhatConfig,
): Promise<HardhatConfig> {
  return {
    ...partiallyResolvedConfig,
    networks: resolveNetworksWithNoxConfig(
      userConfig,
      partiallyResolvedConfig.networks,
    ),
    nox: {
      skipTestOverride: userConfig.nox?.skipTestOverride ?? false,
    },
  };
}
