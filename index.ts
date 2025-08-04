import type { PublicClient } from "viem";

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
    // ...
}