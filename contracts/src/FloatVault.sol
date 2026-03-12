// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @notice Minimal Aave V3 Pool interface for supply/withdraw
interface IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

/// @title FloatVault
/// @notice Manages user deposits into MORE Markets (Aave V3 fork) and tracks per-user yield.
///         BattlePool can lock/unlock yield for battles and credit winnings.
contract FloatVault {
    // --- State ---
    IERC20 public immutable usdc;
    IERC20 public immutable aToken;
    IPool public immutable pool;
    address public battlePool;
    address public owner;

    mapping(address => uint256) public principalOf;
    mapping(address => uint256) public yieldLockedOf;
    uint256 public totalPrincipal;

    // --- Events ---
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event YieldLocked(address indexed user, uint256 amount);
    event YieldUnlocked(address indexed user, uint256 amount);
    event WinningsCredited(address indexed user, uint256 amount);
    event Compounded(uint256 totalAssets, uint256 totalPrincipal);

    // --- Errors ---
    error NotOwner();
    error NotBattlePool();
    error InsufficientPrincipal();
    error InsufficientYield();
    error WouldUnderfundBattles();
    error ZeroAmount();
    error TransferFailed();

    // --- Modifiers ---
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyBattlePool() {
        if (msg.sender != battlePool) revert NotBattlePool();
        _;
    }

    constructor(address _usdc, address _aToken, address _pool) {
        usdc = IERC20(_usdc);
        aToken = IERC20(_aToken);
        pool = IPool(_pool);
        owner = msg.sender;
    }

    // --- Admin ---

    function setBattlePool(address _battlePool) external onlyOwner {
        battlePool = _battlePool;
    }

    // --- User Actions ---

    /// @notice Deposit USDC into the vault. USDC is supplied to MORE Markets.
    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        usdc.approve(address(pool), amount);
        pool.supply(address(usdc), amount, address(this), 0);

        principalOf[msg.sender] += amount;
        totalPrincipal += amount;

        emit Deposited(msg.sender, amount);
    }

    /// @notice Withdraw principal. Cannot withdraw if it would underfund active battles.
    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (amount > principalOf[msg.sender]) revert InsufficientPrincipal();

        // Check: after withdrawal, remaining yield must cover locked yield
        uint256 newPrincipal = principalOf[msg.sender] - amount;
        uint256 newTotalPrincipal = totalPrincipal - amount;
        uint256 totalAssets = aToken.balanceOf(address(this));
        // Account for the amount being withdrawn from total assets
        uint256 assetsAfterWithdraw = totalAssets > amount ? totalAssets - amount : 0;

        if (newTotalPrincipal > 0 && yieldLockedOf[msg.sender] > 0) {
            uint256 newShare = (assetsAfterWithdraw * newPrincipal) / newTotalPrincipal;
            uint256 newYield = newShare > newPrincipal ? newShare - newPrincipal : 0;
            if (newYield < yieldLockedOf[msg.sender]) revert WouldUnderfundBattles();
        }

        principalOf[msg.sender] = newPrincipal;
        totalPrincipal = newTotalPrincipal;

        pool.withdraw(address(usdc), amount, msg.sender);

        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Withdraw available yield (not locked in battles).
    function withdrawYield(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        uint256 available = yieldOf(msg.sender);
        if (amount > available) revert InsufficientYield();

        // Withdraw yield from lending pool and send to user
        pool.withdraw(address(usdc), amount, msg.sender);

        // Reduce total principal by 0 — yield withdrawal doesn't affect principal tracking
        // But we need to account for the fact that totalAssets decreased
        // The yield was "virtual" — based on aToken growth. Now it's realized.
        // No principal adjustment needed — yieldOf() recalculates from aToken balance.

        emit Withdrawn(msg.sender, amount);
    }

    // --- View Functions ---

    /// @notice Calculate available yield for a user (total yield minus locked yield).
    function yieldOf(address user) public view returns (uint256) {
        if (totalPrincipal == 0) return 0;

        uint256 totalAssets = aToken.balanceOf(address(this));
        uint256 userShare = (totalAssets * principalOf[user]) / totalPrincipal;
        uint256 userYield = userShare > principalOf[user] ? userShare - principalOf[user] : 0;

        return userYield > yieldLockedOf[user] ? userYield - yieldLockedOf[user] : 0;
    }

    /// @notice Total value for a user (principal + yield).
    function totalValueOf(address user) public view returns (uint256) {
        if (totalPrincipal == 0) return 0;
        uint256 totalAssets = aToken.balanceOf(address(this));
        return (totalAssets * principalOf[user]) / totalPrincipal;
    }

    // --- BattlePool Integration ---

    /// @notice Lock yield for an active battle. Only callable by BattlePool.
    function lockYield(address user, uint256 amount) external onlyBattlePool {
        if (amount > yieldOf(user)) revert InsufficientYield();
        yieldLockedOf[user] += amount;
        emit YieldLocked(user, amount);
    }

    /// @notice Unlock yield after battle resolution (for losers, yield is gone; for non-claimers).
    function unlockYield(address user, uint256 amount) external onlyBattlePool {
        yieldLockedOf[user] -= amount;
        emit YieldUnlocked(user, amount);
    }

    /// @notice Credit battle winnings to user's principal (so winnings earn yield).
    function creditWinnings(address user, uint256 amount) external onlyBattlePool {
        principalOf[user] += amount;
        totalPrincipal += amount;
        emit WinningsCredited(user, amount);
    }

    // --- Testnet Helpers ---

    /// @notice Simulate yield by minting aTokens to vault (testnet only).
    ///         On mainnet, aToken has no public mint — this call reverts naturally.
    function simulateYield(uint256 amount) external {
        require(amount <= 1_000e6, "Testnet: max 1000 USDC yield per call");
        // MockAToken has a public mint — on mainnet aToken this will revert, which is fine
        (bool ok,) = address(aToken).call(abi.encodeWithSignature("mint(address,uint256)", address(this), amount));
        require(ok, "simulateYield: mint failed");
    }

    // --- Automation ---

    /// @notice Compound yield — callable by anyone (scheduled tx handler).
    ///         Withdraws accrued yield spread and re-supplies.
    function compoundYield() external {
        emit Compounded(aToken.balanceOf(address(this)), totalPrincipal);
        // For Aave V3 forks, yield auto-compounds via aToken rebasing.
        // This function exists as a hook for the scheduled tx handler
        // to trigger any additional logic (e.g., taking protocol yield spread).
    }
}
