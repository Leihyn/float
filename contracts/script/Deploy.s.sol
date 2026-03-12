// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FloatVault} from "../src/FloatVault.sol";
import {BattlePool} from "../src/BattlePool.sol";

contract DeployScript is Script {
    // MORE Markets (Aave V3 fork) on Flow EVM mainnet
    // For testnet, we'll deploy mock tokens
    address constant MORE_POOL = 0xbC92aaC2DBBF42215248B5688eB3D3d2b32F2c8d;
    address constant STG_USDC = 0xF1815bd50389c46847f0Bda824eC8da914045D14;
    address constant A_TOKEN_USDC = 0x49c6b2799aF2Db7404b930F24471dD961CFE18b7;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // Deploy FloatVault
        FloatVault vault = new FloatVault(STG_USDC, A_TOKEN_USDC, MORE_POOL);
        console.log("FloatVault deployed:", address(vault));

        // Deploy BattlePool with 5% fee
        BattlePool battlePool = new BattlePool(address(vault), 500);
        console.log("BattlePool deployed:", address(battlePool));

        // Wire them together
        vault.setBattlePool(address(battlePool));
        console.log("BattlePool set on vault");

        vm.stopBroadcast();
    }
}

/// @notice Deploy with mock tokens for testnet (MORE Markets may not be on testnet)
contract DeployTestnetScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // Deploy mock USDC
        MockUSDC usdc = new MockUSDC();
        console.log("Mock USDC deployed:", address(usdc));

        // Deploy mock aToken
        MockAToken aToken = new MockAToken();
        console.log("Mock aToken deployed:", address(aToken));

        // Deploy mock Pool
        MockPool pool = new MockPool(address(usdc), address(aToken));
        console.log("Mock Pool deployed:", address(pool));

        // Deploy FloatVault
        FloatVault vault = new FloatVault(address(usdc), address(aToken), address(pool));
        console.log("FloatVault deployed:", address(vault));

        // Deploy BattlePool with 5% fee
        BattlePool battlePool = new BattlePool(address(vault), 500);
        console.log("BattlePool deployed:", address(battlePool));

        // Wire them together
        vault.setBattlePool(address(battlePool));
        console.log("BattlePool set on vault");

        // Mint some test USDC to deployer for testing
        usdc.mint(msg.sender, 100_000e6);
        console.log("Minted 100K test USDC to deployer");

        // Fund mock pool with USDC for withdrawal operations
        usdc.mint(address(pool), 1_000_000e6);

        vm.stopBroadcast();
    }
}

// Minimal mock contracts for testnet
contract MockUSDC {
    string public name = "Float Test USDC";
    string public symbol = "fUSDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
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

contract MockAToken {
    string public name = "Float Test aUSDC";
    string public symbol = "faUSDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);

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

contract MockPool {
    MockUSDC public usdc;
    MockAToken public aToken;

    constructor(address _usdc, address _aToken) {
        usdc = MockUSDC(_usdc);
        aToken = MockAToken(_aToken);
    }

    function supply(address, uint256 amount, address onBehalfOf, uint16) external {
        usdc.transferFrom(msg.sender, address(this), amount);
        aToken.mint(onBehalfOf, amount);
    }

    function withdraw(address, uint256 amount, address to) external returns (uint256) {
        aToken.burn(msg.sender, amount);
        usdc.transfer(to, amount);
        return amount;
    }

    function simulateYield(address vault, uint256 amount) external {
        aToken.mint(vault, amount);
    }
}
