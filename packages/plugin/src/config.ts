import type {
  NoxUserConfig,
  NoxResolvedConfig,
  NoxResolvedPorts,
  NoxResolvedKeys,
} from "./types.js";

export const DEFAULT_KEYS: NoxResolvedKeys = {
  kms: {
    walletKey:
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // account #0
    eccKey:
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // account #1
    eccPublicKey:
      "0x02ba5734d8f7091719471e7f7ed6b9df170dc70cc661ca05e688601ad984f068b0",
  },
  gateway: {
    walletKey:
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // account #3
  },
  runner: {
    walletKey:
      "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // account #2
  },
};

const DEFAULT_PORTS: NoxResolvedPorts = {
  rpc: 8545,
  nats: 4222,
  natsMonitor: 8222,
  s3: 9100,
  kms: 9000,
  gateway: 3000,
  ingestor: 8090,
  runner: 8080,
};

function isValidPort(v: unknown): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 65535;
}

export function validateNoxConfig(
  userConfig: NoxUserConfig,
): Array<{ path: string[]; message: string }> {
  const errors: Array<{ path: string[]; message: string }> = [];

  if (userConfig.ports !== undefined) {
    for (const [key, val] of Object.entries(userConfig.ports)) {
      if (val !== undefined && !isValidPort(val)) {
        errors.push({
          path: ["nox", "ports", key],
          message: `nox.ports.${key} must be an integer between 1 and 65535, got: ${JSON.stringify(val)}`,
        });
      }
    }
  }

  return errors;
}

export function resolveNoxConfig(userConfig: NoxUserConfig): NoxResolvedConfig {
  return {
    enabled: userConfig.enabled ?? true,
    contractAddress: userConfig.contractAddress,
    ports: { ...DEFAULT_PORTS, ...userConfig.ports },
    keys: DEFAULT_KEYS,
  };
}
