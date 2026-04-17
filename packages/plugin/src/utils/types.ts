import { Abi } from "viem";

export interface CompiledContract {
  abi: Abi;
  deployedBytecode: `0x${string}`;
}

export interface BuildInfoOutput {
  output?: {
    contracts?: Record<
      string,
      Record<
        string,
        { abi?: Abi; evm?: { deployedBytecode?: { object?: string } } }
      >
    >;
  };
}
