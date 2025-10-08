# ERC4626 Deposit Helper

A TypeScript library for safely depositing assets into ERC4626 vaults with pre-transaction validation.

## 🎯 Overview

This library provides a robust `deposit` function that validates all necessary conditions before building the transaction, preventing common errors when interacting with ERC4626 vaults:
- ✅ Sufficient balance
- ✅ Adequate allowance
- ✅ Respect vault's maxDeposit limits

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Language**: TypeScript
- **Ethereum Library**: [viem](https://viem.sh)
- **Testing**: Bun test + Foundry (Anvil)
- **Smart Contracts**: Solidity (Mock contracts for testing)

## ✨ Features

- **Type-safe**: Full TypeScript support with viem
- **Pre-validation**: Checks balance, allowance, and maxDeposit before transaction
- **Gas estimation**: Automatic gas estimation included
- **Error handling**: Specific error types for different failure scenarios
- **Zero dependencies**: Uses only viem for Ethereum interactions

## 📦 Installation

```bash
bun install
```

## 🚀 Usage

```typescript
import { createPublicClient, http } from "viem";
import { deposit } from "./index";

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const transaction = await deposit(client, {
  wallet: "0x...",
  vault: "0x...",
  amount: 1000000000000000000n, // 1 token (18 decimals)
});

// Transaction object ready to be signed and sent
console.log(transaction);
```

## 🧪 Testing

```bash
# Build Solidity contracts
forge build

# Run tests (automatically starts Anvil)
bun test
```

## 🔍 API

### `deposit(client, params)`

**Parameters:**
- `client`: viem PublicClient instance
- `params.wallet`: User's wallet address
- `params.vault`: ERC4626 vault address
- `params.amount`: Amount to deposit (in wei)

**Returns:** Promise<Transaction>

**Throws:**
- `NotEnoughBalanceError`: Insufficient token balance
- `MissingAllowanceError`: Insufficient allowance for vault
- `AmountExceedsMaxDepositError`: Amount exceeds vault's maxDeposit

## 📝 License

MIT
