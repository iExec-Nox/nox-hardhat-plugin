# `hardhat-core-mock` (WIP)

Hardhat 3 plugin that installs a simple HelloWorld core contract at a fixed
address for local testing.

## Installation

To install this plugin, run the following command:

```bash
npm install --save-dev hardhat-core-mock
```

In your `hardhat.config.ts` file, import the plugin and add it to the `plugins` array:

```ts
import { defineConfig } from "hardhat/config";
import coreMock from "hardhat-core-mock";

export default defineConfig({
  plugins: [coreMock],
});
```

## Usage

Install the core contract once:

```bash
npx hardhat core:install
```

Check status:

```bash
npx hardhat core:status
```

### Development

The plugin automatically compiles `contracts/HelloWorld.sol` during build and imports the artifact directly.

To rebuild:

```bash
pnpm build  # Compile contracts + TypeScript
```

You can configure the plugin via `coreMock` in your Hardhat config:

```ts
import { defineConfig } from "hardhat/config";
import coreMock from "hardhat-core-mock";

export default defineConfig({
  plugins: [coreMock],
  coreMock: {
    autoInstall: true,
    address: "0x0000000000000000000000000000000000000042",
  },
});
```
