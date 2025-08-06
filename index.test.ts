import { test, expect, beforeAll, afterAll } from "bun:test";
import { createPublicClient, createWalletClient, http, parseEther, getContract } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { deposit, NotEnoughBalanceError, MissingAllowanceError, AmountExceedsMaxDepositError } from "./index";

// Anvil configuration
const ANVIL_URL = "http://127.0.0.1:8545";
const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Anvil default account

// Contract ABIs
const ERC20_ABI = [
  {
    type: "constructor",
    inputs: [{ name: "_initialSupply", type: "uint256" }],
  },
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
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const ERC4626_ABI = [
  {
    type: "constructor",
    inputs: [{ name: "_asset", type: "address" }],
  },
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
  {
    name: "setMaxDepositLimit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_limit", type: "uint256" }],
    outputs: [],
  },
] as const;

// Test setup
let publicClient: any;
let walletClient: any;
let account: any;
let tokenAddress: `0x${string}`;
let vaultAddress: `0x${string}`;
let anvilProcess: any;

beforeAll(async () => {
    // Start Anvil
    const anvilPath = `${process.env.HOME}/.foundry/bin/anvil`;
    const anvilCmd = Bun.spawn([anvilPath, "--silent"], {
        stdio: ["ignore", "ignore", "ignore"],
    });
    anvilProcess = anvilCmd;
    
    // Wait for Anvil to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Setup clients
    publicClient = createPublicClient({
        chain: foundry,
        transport: http(ANVIL_URL),
    });

    account = privateKeyToAccount(TEST_PRIVATE_KEY);
    walletClient = createWalletClient({
        account,
        chain: foundry,
        transport: http(ANVIL_URL),
    });

    // Deploy MockERC20
    const tokenBytecode = await Bun.file("out/MockERC20.sol/MockERC20.json").json();
    const tokenHash = await walletClient.deployContract({
        abi: ERC20_ABI,
        bytecode: tokenBytecode.bytecode.object,
        args: [parseEther("0")], // Start with 0 supply, we'll mint later
    });
    
    const tokenReceipt = await publicClient.waitForTransactionReceipt({ hash: tokenHash });
    tokenAddress = tokenReceipt.contractAddress!;

    // Deploy MockERC4626
    const vaultBytecode = await Bun.file("out/MockERC4626.sol/MockERC4626.json").json();
    const vaultHash = await walletClient.deployContract({
        abi: ERC4626_ABI,
        bytecode: vaultBytecode.bytecode.object,
        args: [tokenAddress],
    });
    
    const vaultReceipt = await publicClient.waitForTransactionReceipt({ hash: vaultHash });
    vaultAddress = vaultReceipt.contractAddress!;
});

afterAll(async () => {
    if (anvilProcess) {
        anvilProcess.kill();
    }
});

test("deposit should work with valid parameters", async () => {
    // Mint tokens to test account
    await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [account.address, parseEther("1000")],
    });

    // Approve vault to spend tokens
    await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vaultAddress, parseEther("500")],
    });

    const transaction = await deposit(publicClient, {
        wallet: account.address,
        vault: vaultAddress,
        amount: parseEther("100"),
    });

    expect(transaction.from).toBe(account.address);
    expect(transaction.to).toBe(vaultAddress);
    expect(transaction.value).toBe(0n);
    expect(transaction.gas).toBeGreaterThan(0n);
    expect(transaction.data).toMatch(/^0x[a-fA-F0-9]+$/);
});

test("deposit should throw NotEnoughBalanceError when balance is insufficient", async () => {
    // Create a fresh account with no tokens
    const testAccount = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
    
    // This account has no tokens, so any deposit should fail
    expect(async () => {
        await deposit(publicClient, {
            wallet: testAccount.address,
            vault: vaultAddress,
            amount: parseEther("1"), // Any amount should fail
        });
    }).toThrow(NotEnoughBalanceError);
});

test("deposit should throw MissingAllowanceError when allowance is insufficient", async () => {
    // Mint enough tokens
    await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [account.address, parseEther("1000")],
    });

    // Set low allowance
    await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vaultAddress, parseEther("10")], // Less than deposit amount
    });

    expect(async () => {
        await deposit(publicClient, {
            wallet: account.address,
            vault: vaultAddress,
            amount: parseEther("100"), // More than allowance
        });
    }).toThrow(MissingAllowanceError);
});

test("deposit should throw AmountExceedsMaxDepositError when amount exceeds max deposit", async () => {
    // Mint tokens and approve
    await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [account.address, parseEther("1000")],
    });

    await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vaultAddress, parseEther("1000")],
    });

    // Set low max deposit limit
    await walletClient.writeContract({
        address: vaultAddress,
        abi: ERC4626_ABI,
        functionName: "setMaxDepositLimit",
        args: [parseEther("50")], // Lower than deposit amount
    });

    expect(async () => {
        await deposit(publicClient, {
            wallet: account.address,
            vault: vaultAddress,
            amount: parseEther("100"), // More than max deposit
        });
    }).toThrow(AmountExceedsMaxDepositError);
});

test("deposit should work with exact balance", async () => {
    const amount = parseEther("100");
    
    // Reset vault limit
    await walletClient.writeContract({
        address: vaultAddress,
        abi: ERC4626_ABI,
        functionName: "setMaxDepositLimit",
        args: [parseEther("1000")],
    });

    // Mint exact amount
    await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [account.address, amount],
    });

    await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vaultAddress, amount],
    });

    const transaction = await deposit(publicClient, {
        wallet: account.address,
        vault: vaultAddress,
        amount,
    });

    expect(transaction.from).toBe(account.address);
});

test("error classes should have correct messages", () => {
    expect(new NotEnoughBalanceError().message).toBe("Not enough balance");
    expect(new MissingAllowanceError().message).toBe("Not enough allowance");
    expect(new AmountExceedsMaxDepositError().message).toBe("Amount exceeds max deposit");
});