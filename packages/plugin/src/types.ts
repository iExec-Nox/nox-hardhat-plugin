export interface CoreMockUserConfig {
  enabled?: boolean;
}

export interface CoreMockConfig {
  enabled: boolean;
}

export interface CoreMockRuntime {
  install(options?: { force?: boolean; quiet?: boolean }): Promise<{
    installed: boolean;
    skipped: boolean;
  }>;
  status(): Promise<{
    chainId: number;
    address: string;
    hasCode: boolean;
  }>;
  getAddress(): string;
}
