import type { PublicClient } from "viem";
import { encodeFunctionData } from "viem";

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance", 
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const ERC4626_ABI = [
  {
    name: "asset",
    type: "function", 
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "maxDeposit",
    type: "function",
    stateMutability: "view", 
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" }
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
] as const;

export type DepositParams = {
    wallet: `0x${string}`;
    vault: `0x${string}`;
    amount: bigint;
};

type Transaction = {
    data: `0x${string}`;
    from: `0x${string}`;
    to: `0x${string}`;
    value: bigint;
    gas: bigint;
};

export class NotEnoughBalanceError extends Error {
    constructor() {
        super("Not enough balance");
    }
}

export class MissingAllowanceError extends Error {
    constructor() {
        super("Not enough allowance");
    }
}

export class AmountExceedsMaxDepositError extends Error {
    constructor() {
        super("Amount exceeds max deposit");
    }
}

/**
 * Deposit an amount of an asset into a given vault.
 *
 * @throws {NotEnoughBalanceError} if the wallet does not have enough balance to deposit the amount
 * @throws {MissingAllowanceError} if the wallet does not have enough allowance to deposit the amount
 * @throws {AmountExceedsMaxDepositError} if the amount exceeds the max deposit
 */
export async function deposit(
    client: PublicClient,
    { wallet, vault, amount }: DepositParams,
): Promise<Transaction> {
    // 1. Get the asset address from the vault
    const assetAddress = await client.readContract({
        address: vault,
        abi: ERC4626_ABI,
        functionName: "asset",
    }) as `0x${string}`;

    // 2. Check user balance
    const balance = await client.readContract({
        address: assetAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [wallet],
    }) as bigint;

    if (balance < amount) {
        throw new NotEnoughBalanceError();
    }

    // 3. Check allowance
    const allowance = await client.readContract({
        address: assetAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [wallet, vault],
    }) as bigint;

    if (allowance < amount) {
        throw new MissingAllowanceError();
    }

    // 4. Check max deposit
    const maxDeposit = await client.readContract({
        address: vault,
        abi: ERC4626_ABI,
        functionName: "maxDeposit",
        args: [wallet],
    }) as bigint;

    if (amount > maxDeposit) {
        throw new AmountExceedsMaxDepositError();
    }

    // 5. Encode the deposit function call
    const data = encodeFunctionData({
        abi: ERC4626_ABI,
        functionName: "deposit",
        args: [amount, wallet],
    });

    // 6. Estimate gas
    const gas = await client.estimateGas({
        account: wallet,
        to: vault,
        data,
        value: 0n,
    });

    // 7. Return the transaction object
    return {
        data,
        from: wallet,
        to: vault,
        value: 0n,
        gas,
    };
}