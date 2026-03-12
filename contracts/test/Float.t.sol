// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {FloatVault} from "../src/FloatVault.sol";
import {BattlePool} from "../src/BattlePool.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @notice Mock USDC for testing
contract MockERC20 is IERC20 {
    string public name = "Mock USDC";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function burn(address from, uint256 amount) external {
        balanceOf[from] -= amount;
        totalSupply -= amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

/// @notice Mock Aave Pool that mints aTokens 1:1 on supply
contract MockPool {
    MockERC20 public usdc;
    MockERC20 public aToken;

    constructor(address _usdc, address _aToken) {
        usdc = MockERC20(_usdc);
        aToken = MockERC20(_aToken);
    }

    function supply(address, uint256 amount, address onBehalfOf, uint16) external {
        usdc.transferFrom(msg.sender, address(this), amount);
        aToken.mint(onBehalfOf, amount);
    }

    function withdraw(address, uint256 amount, address to) external returns (uint256) {
        // Burn aTokens from caller (the vault) — simulates Aave's internal burn
        aToken.burn(msg.sender, amount);
        usdc.transfer(to, amount);
        return amount;
    }

    /// @notice Simulate yield by minting extra aTokens to the vault
    function simulateYield(address vault, uint256 amount) external {
        aToken.mint(vault, amount);
    }
}

contract FloatTest is Test {
    FloatVault vault;
    BattlePool battlePool;
    MockERC20 usdc;
    MockERC20 aToken;
    MockPool pool;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address admin;

    function setUp() public {
        admin = address(this);

        usdc = new MockERC20();
        aToken = new MockERC20();
        pool = new MockPool(address(usdc), address(aToken));

        vault = new FloatVault(address(usdc), address(aToken), address(pool));
        battlePool = new BattlePool(address(vault), 500); // 5% fee

        vault.setBattlePool(address(battlePool));

        // Fund mock pool with USDC for withdrawals
        usdc.mint(address(pool), 1_000_000e6);

        // Fund users
        usdc.mint(alice, 10_000e6);
        usdc.mint(bob, 10_000e6);
    }

    // --- Deposit Tests ---

    function test_deposit() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 500e6);
        vault.deposit(500e6);
        vm.stopPrank();

        assertEq(vault.principalOf(alice), 500e6);
        assertEq(vault.totalPrincipal(), 500e6);
    }

    function test_deposit_zero_reverts() public {
        vm.expectRevert(FloatVault.ZeroAmount.selector);
        vm.prank(alice);
        vault.deposit(0);
    }

    function test_deposit_multiple_users() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 500e6);
        vault.deposit(500e6);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), 300e6);
        vault.deposit(300e6);
        vm.stopPrank();

        assertEq(vault.principalOf(alice), 500e6);
        assertEq(vault.principalOf(bob), 300e6);
        assertEq(vault.totalPrincipal(), 800e6);
    }

    // --- Yield Tests ---

    function test_yield_accrual() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 500e6);
        vault.deposit(500e6);
        vm.stopPrank();

        // Simulate 10 USDC yield
        pool.simulateYield(address(vault), 10e6);

        assertEq(vault.yieldOf(alice), 10e6);
        assertEq(vault.totalValueOf(alice), 510e6);
    }

    function test_yield_proportional_to_principal() public {
        // Alice deposits 750, Bob deposits 250 → 75%/25% split
        vm.startPrank(alice);
        usdc.approve(address(vault), 750e6);
        vault.deposit(750e6);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), 250e6);
        vault.deposit(250e6);
        vm.stopPrank();

        // 100 USDC yield → Alice gets 75, Bob gets 25
        pool.simulateYield(address(vault), 100e6);

        assertEq(vault.yieldOf(alice), 75e6);
        assertEq(vault.yieldOf(bob), 25e6);
    }

    // --- Withdraw Tests ---

    function test_withdraw_principal() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 500e6);
        vault.deposit(500e6);

        vault.withdraw(200e6);
        vm.stopPrank();

        assertEq(vault.principalOf(alice), 300e6);
        assertEq(vault.totalPrincipal(), 300e6);
    }

    function test_withdraw_exceeds_principal_reverts() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 500e6);
        vault.deposit(500e6);

        vm.expectRevert(FloatVault.InsufficientPrincipal.selector);
        vault.withdraw(600e6);
        vm.stopPrank();
    }

    function test_withdraw_yield() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 500e6);
        vault.deposit(500e6);
        vm.stopPrank();

        pool.simulateYield(address(vault), 20e6);

        uint256 yieldBefore = vault.yieldOf(alice);
        assertEq(yieldBefore, 20e6);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        vault.withdrawYield(10e6);
        uint256 balAfter = usdc.balanceOf(alice);

        // User received USDC
        assertEq(balAfter - balBefore, 10e6);

        // Yield decreased: aToken balance dropped by 10e6, so remaining yield = 10e6
        assertEq(vault.yieldOf(alice), 10e6);
    }

    // --- Battle Tests ---

    function test_create_battle() public {
        uint256 id = battlePool.createBattle(
            "Will FLOW be above $1?",
            block.timestamp + 1 days,
            "FLOW",
            0.8e18,  // reference price
            1e18,     // target price
            0,        // target percent
            BattlePool.BattleType.ABOVE_TARGET
        );

        assertEq(id, 0);
        BattlePool.Battle memory b = battlePool.getBattle(0);
        assertEq(b.question, "Will FLOW be above $1?");
        assertEq(uint(b.status), uint(BattlePool.BattleStatus.OPEN));
    }

    function test_create_event_battle() public {
        uint256 id = battlePool.createEventBattle(
            "Will Bitcoin hit $100K this week?",
            block.timestamp + 7 days
        );

        BattlePool.Battle memory b = battlePool.getBattle(id);
        assertTrue(b.isEventBattle);
    }

    function test_enter_battle() public {
        // Setup: deposit and create battle
        vm.startPrank(alice);
        usdc.approve(address(vault), 500e6);
        vault.deposit(500e6);
        vm.stopPrank();

        pool.simulateYield(address(vault), 10e6);

        battlePool.createBattle(
            "Will FLOW go up?",
            block.timestamp + 1 days,
            "FLOW", 0.8e18, 0, 0,
            BattlePool.BattleType.HIGHER
        );

        // Alice enters with 5 USDC yield on YES
        vm.prank(alice);
        battlePool.enter(0, BattlePool.Side.YES, 5e6);

        BattlePool.Entry memory e = battlePool.getEntry(0, alice);
        assertEq(e.amount, 5e6);
        assertEq(uint(e.side), uint(BattlePool.Side.YES));

        // Yield is now locked
        assertEq(vault.yieldLockedOf(alice), 5e6);
        assertEq(vault.yieldOf(alice), 5e6); // 10 total - 5 locked = 5 available
    }

    function test_enter_battle_insufficient_yield_reverts() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 500e6);
        vault.deposit(500e6);
        vm.stopPrank();

        pool.simulateYield(address(vault), 5e6);

        battlePool.createBattle(
            "Test", block.timestamp + 1 days,
            "FLOW", 0.8e18, 0, 0,
            BattlePool.BattleType.HIGHER
        );

        vm.prank(alice);
        vm.expectRevert(FloatVault.InsufficientYield.selector);
        battlePool.enter(0, BattlePool.Side.YES, 10e6); // More than available yield
    }

    function test_battle_resolve_and_claim() public {
        // Setup: both users deposit and earn yield
        vm.startPrank(alice);
        usdc.approve(address(vault), 1000e6);
        vault.deposit(1000e6);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), 1000e6);
        vault.deposit(1000e6);
        vm.stopPrank();

        pool.simulateYield(address(vault), 100e6); // 50 each

        battlePool.createBattle(
            "Will FLOW go up?",
            block.timestamp + 1 days,
            "FLOW", 0.8e18, 0, 0,
            BattlePool.BattleType.HIGHER
        );

        // Alice bets YES 20, Bob bets NO 20
        vm.prank(alice);
        battlePool.enter(0, BattlePool.Side.YES, 20e6);

        vm.prank(bob);
        battlePool.enter(0, BattlePool.Side.NO, 20e6);

        // Resolve: FLOW went up → YES wins
        battlePool.resolve(0, 0.9e18);

        BattlePool.Battle memory b = battlePool.getBattle(0);
        assertEq(uint(b.status), uint(BattlePool.BattleStatus.RESOLVED));
        assertEq(uint(b.winningSide), uint(BattlePool.Side.YES));

        // Alice claims: gets her 20 back + (20 - 5% fee) = 20 + 19 = 39
        uint256 alicePrincipalBefore = vault.principalOf(alice);
        vm.prank(alice);
        battlePool.claim(0);
        uint256 alicePrincipalAfter = vault.principalOf(alice);

        // Winner gets: wager + (wager * distributable) / winnerPool
        // distributable = 20 - (20 * 500 / 10000) = 20 - 1 = 19
        // winnings = 20 + (20 * 19 / 20) = 20 + 19 = 39
        assertEq(alicePrincipalAfter - alicePrincipalBefore, 39e6);

        // Bob claims: gets 0 (loser)
        uint256 bobPrincipalBefore = vault.principalOf(bob);
        vm.prank(bob);
        battlePool.claim(0);
        uint256 bobPrincipalAfter = vault.principalOf(bob);
        assertEq(bobPrincipalAfter, bobPrincipalBefore); // No change for loser
    }

    function test_battle_cancel_refunds() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 500e6);
        vault.deposit(500e6);
        vm.stopPrank();

        pool.simulateYield(address(vault), 20e6);

        battlePool.createBattle(
            "Test", block.timestamp + 1 days,
            "FLOW", 0.8e18, 0, 0,
            BattlePool.BattleType.HIGHER
        );

        vm.prank(alice);
        battlePool.enter(0, BattlePool.Side.YES, 10e6);

        assertEq(vault.yieldLockedOf(alice), 10e6);

        // Cancel battle
        battlePool.cancelBattle(0);

        // Yield unlocked
        assertEq(vault.yieldLockedOf(alice), 0);
    }

    function test_one_sided_battle_auto_cancels() public {
        // Only YES bets → should auto-cancel on resolve
        vm.startPrank(alice);
        usdc.approve(address(vault), 500e6);
        vault.deposit(500e6);
        vm.stopPrank();

        pool.simulateYield(address(vault), 20e6);

        battlePool.createBattle(
            "Test", block.timestamp + 1 days,
            "FLOW", 0.8e18, 0, 0,
            BattlePool.BattleType.HIGHER
        );

        vm.prank(alice);
        battlePool.enter(0, BattlePool.Side.YES, 10e6);

        // Resolve with only one side
        battlePool.resolve(0, 0.9e18);

        BattlePool.Battle memory b = battlePool.getBattle(0);
        assertEq(uint(b.status), uint(BattlePool.BattleStatus.CANCELLED));
        assertEq(vault.yieldLockedOf(alice), 0); // Refunded
    }

    function test_event_battle_manual_resolve() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 500e6);
        vault.deposit(500e6);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), 500e6);
        vault.deposit(500e6);
        vm.stopPrank();

        pool.simulateYield(address(vault), 40e6); // 20 each

        battlePool.createEventBattle(
            "Will it rain in Lagos tomorrow?",
            block.timestamp + 1 days
        );

        vm.prank(alice);
        battlePool.enter(0, BattlePool.Side.YES, 10e6);

        vm.prank(bob);
        battlePool.enter(0, BattlePool.Side.NO, 10e6);

        // Resolve manually: YES wins
        battlePool.resolveManual(0, true);

        BattlePool.Battle memory b = battlePool.getBattle(0);
        assertEq(uint(b.winningSide), uint(BattlePool.Side.YES));
    }

    function test_non_admin_cannot_create_battle() public {
        vm.prank(alice);
        vm.expectRevert(BattlePool.NotAdmin.selector);
        battlePool.createBattle(
            "Test", block.timestamp + 1 days,
            "FLOW", 0.8e18, 0, 0,
            BattlePool.BattleType.HIGHER
        );
    }

    function test_cannot_enter_twice() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 500e6);
        vault.deposit(500e6);
        vm.stopPrank();

        pool.simulateYield(address(vault), 20e6);

        battlePool.createBattle(
            "Test", block.timestamp + 1 days,
            "FLOW", 0.8e18, 0, 0,
            BattlePool.BattleType.HIGHER
        );

        vm.startPrank(alice);
        battlePool.enter(0, BattlePool.Side.YES, 5e6);

        vm.expectRevert(BattlePool.AlreadyEntered.selector);
        battlePool.enter(0, BattlePool.Side.NO, 5e6);
        vm.stopPrank();
    }

    function test_cannot_claim_twice() public {
        // Full flow: deposit, yield, battle, resolve, claim, try claim again
        vm.startPrank(alice);
        usdc.approve(address(vault), 500e6);
        vault.deposit(500e6);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), 500e6);
        vault.deposit(500e6);
        vm.stopPrank();

        pool.simulateYield(address(vault), 40e6);

        battlePool.createBattle(
            "Test", block.timestamp + 1 days,
            "FLOW", 0.8e18, 0, 0,
            BattlePool.BattleType.HIGHER
        );

        vm.prank(alice);
        battlePool.enter(0, BattlePool.Side.YES, 10e6);
        vm.prank(bob);
        battlePool.enter(0, BattlePool.Side.NO, 10e6);

        battlePool.resolve(0, 0.9e18);

        vm.startPrank(alice);
        battlePool.claim(0);

        vm.expectRevert(BattlePool.AlreadyClaimed.selector);
        battlePool.claim(0);
        vm.stopPrank();
    }
}
