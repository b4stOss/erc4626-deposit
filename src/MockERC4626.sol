// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract MockERC4626 {
    IERC20 public immutable asset;
    
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;
    
    string public name = "Mock Vault";
    string public symbol = "mvToken";
    uint8 public decimals = 18;
    
    uint256 public maxDepositLimit = type(uint256).max;
    
    constructor(address _asset) {
        asset = IERC20(_asset);
    }
    
    function setMaxDepositLimit(uint256 _limit) external {
        maxDepositLimit = _limit;
    }
    
    function maxDeposit(address) external view returns (uint256) {
        return maxDepositLimit;
    }
    
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        require(assets <= maxDepositLimit, "Exceeds max deposit");
        
        // Simple 1:1 ratio for testing
        shares = assets;
        
        // Transfer assets from caller
        require(asset.transferFrom(msg.sender, address(this), assets), "Transfer failed");
        
        // Mint shares
        balanceOf[receiver] += shares;
        totalSupply += shares;
        
        return shares;
    }
    
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        shares = assets; // 1:1 ratio
        
        require(balanceOf[owner] >= shares, "Insufficient shares");
        
        if (msg.sender != owner) {
            // Handle allowance logic if needed
        }
        
        balanceOf[owner] -= shares;
        totalSupply -= shares;
        
        // Transfer assets to receiver
        require(asset.transferFrom(address(this), receiver, assets), "Transfer failed");
        
        return shares;
    }
}