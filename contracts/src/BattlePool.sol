// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FloatVault} from "./FloatVault.sol";

/// @title BattlePool
/// @notice Manages prediction battles where users wager yield.
///         Battles are created by the protocol and resolved via oracle or admin.
contract BattlePool {
    // --- Types ---
    enum BattleType { HIGHER, ABOVE_TARGET, CHANGE_PERCENT }
    enum BattleStatus { OPEN, RESOLVED, CANCELLED }
    enum Side { YES, NO }

    struct Battle {
        string question;
        BattleType battleType;
        BattleStatus status;
        uint256 resolveTimestamp;     // When the battle should be resolved
        uint256 referencePrice;       // Price at battle creation (1e18)
        uint256 targetPrice;          // For ABOVE_TARGET type (1e18)
        uint256 targetPercent;        // For CHANGE_PERCENT type (basis points, e.g., 300 = 3%)
        string oracleSymbol;          // Band Oracle symbol (e.g., "FLOW")
        uint256 yesPool;              // Total yield wagered on YES
        uint256 noPool;               // Total yield wagered on NO
        Side winningSide;             // Set after resolution
        bool isEventBattle;           // True = admin-resolved, False = oracle-resolved
    }

    struct Entry {
        Side side;
        uint256 amount;
        bool claimed;
    }

    // --- State ---
    FloatVault public immutable vault;
    address public admin;
    uint256 public protocolFeeBps;    // Basis points (500 = 5%)
    uint256 public protocolFees;      // Accumulated protocol fees
    uint256 public nextBattleId;

    mapping(uint256 => Battle) public battles;
    mapping(uint256 => mapping(address => Entry)) public entries;
    mapping(uint256 => address[]) internal battleParticipants;

    // --- Events ---
    event BattleCreated(uint256 indexed battleId, string question, uint256 resolveTimestamp, bool isEvent);
    event BattleEntered(uint256 indexed battleId, address indexed user, Side side, uint256 amount);
    event BattleResolved(uint256 indexed battleId, Side winningSide, uint256 yesPool, uint256 noPool);
    event BattleCancelled(uint256 indexed battleId);
    event Claimed(uint256 indexed battleId, address indexed user, uint256 payout);

    // --- Errors ---
    error NotAdmin();
    error BattleNotOpen();
    error BattleNotResolved();
    error BattleStillOpen();
    error AlreadyEntered();
    error AlreadyClaimed();
    error ZeroAmount();
    error InvalidBattle();
    error TooLateToEnter();
    error NothingToClaim();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address _vault, uint256 _feeBps) {
        vault = FloatVault(_vault);
        admin = msg.sender;
        protocolFeeBps = _feeBps;
    }

    // --- Battle Creation ---

    /// @notice Create a new oracle-resolved crypto battle.
    function createBattle(
        string calldata question,
        uint256 resolveTimestamp,
        string calldata oracleSymbol,
        uint256 referencePrice,
        uint256 targetPrice,
        uint256 targetPercent,
        BattleType battleType
    ) external onlyAdmin returns (uint256 battleId) {
        battleId = nextBattleId++;

        battles[battleId] = Battle({
            question: question,
            battleType: battleType,
            status: BattleStatus.OPEN,
            resolveTimestamp: resolveTimestamp,
            referencePrice: referencePrice,
            targetPrice: targetPrice,
            targetPercent: targetPercent,
            oracleSymbol: oracleSymbol,
            yesPool: 0,
            noPool: 0,
            winningSide: Side.YES, // default, set on resolution
            isEventBattle: false
        });

        emit BattleCreated(battleId, question, resolveTimestamp, false);
    }

    /// @notice Create an event battle (admin-resolved).
    function createEventBattle(
        string calldata question,
        uint256 resolveTimestamp
    ) external onlyAdmin returns (uint256 battleId) {
        battleId = nextBattleId++;

        battles[battleId] = Battle({
            question: question,
            battleType: BattleType.HIGHER, // unused for events
            status: BattleStatus.OPEN,
            resolveTimestamp: resolveTimestamp,
            referencePrice: 0,
            targetPrice: 0,
            targetPercent: 0,
            oracleSymbol: "",
            yesPool: 0,
            noPool: 0,
            winningSide: Side.YES,
            isEventBattle: true
        });

        emit BattleCreated(battleId, question, resolveTimestamp, true);
    }

    // --- User Actions ---

    /// @notice Enter a battle by wagering yield.
    function enter(uint256 battleId, Side side, uint256 amount) external {
        Battle storage battle = battles[battleId];
        if (battle.status != BattleStatus.OPEN) revert BattleNotOpen();
        if (block.timestamp >= battle.resolveTimestamp) revert TooLateToEnter();
        if (amount == 0) revert ZeroAmount();
        if (entries[battleId][msg.sender].amount > 0) revert AlreadyEntered();

        // Lock yield in the vault
        vault.lockYield(msg.sender, amount);

        entries[battleId][msg.sender] = Entry({
            side: side,
            amount: amount,
            claimed: false
        });
        battleParticipants[battleId].push(msg.sender);

        if (side == Side.YES) {
            battle.yesPool += amount;
        } else {
            battle.noPool += amount;
        }

        emit BattleEntered(battleId, msg.sender, side, amount);
    }

    // --- Resolution ---

    /// @notice Resolve a crypto battle with oracle price data.
    ///         Called by the Cadence scheduled tx handler via COA.
    function resolve(uint256 battleId, uint256 actualPrice) external onlyAdmin {
        Battle storage battle = battles[battleId];
        if (battle.status != BattleStatus.OPEN) revert BattleNotOpen();
        if (battle.isEventBattle) revert InvalidBattle();

        Side winner;
        if (battle.battleType == BattleType.HIGHER) {
            winner = actualPrice > battle.referencePrice ? Side.YES : Side.NO;
        } else if (battle.battleType == BattleType.ABOVE_TARGET) {
            winner = actualPrice > battle.targetPrice ? Side.YES : Side.NO;
        } else {
            // CHANGE_PERCENT
            uint256 change;
            if (actualPrice > battle.referencePrice) {
                change = ((actualPrice - battle.referencePrice) * 10000) / battle.referencePrice;
            } else {
                change = ((battle.referencePrice - actualPrice) * 10000) / battle.referencePrice;
            }
            winner = change > battle.targetPercent ? Side.YES : Side.NO;
        }

        _resolveBattle(battleId, winner);
    }

    /// @notice Resolve an event battle manually.
    function resolveManual(uint256 battleId, bool yesWins) external onlyAdmin {
        Battle storage battle = battles[battleId];
        if (battle.status != BattleStatus.OPEN) revert BattleNotOpen();
        if (!battle.isEventBattle) revert InvalidBattle();

        _resolveBattle(battleId, yesWins ? Side.YES : Side.NO);
    }

    /// @notice Cancel a battle and refund all entries.
    function cancelBattle(uint256 battleId) external onlyAdmin {
        Battle storage battle = battles[battleId];
        if (battle.status != BattleStatus.OPEN) revert BattleNotOpen();

        battle.status = BattleStatus.CANCELLED;

        // Refund all participants
        address[] storage participants = battleParticipants[battleId];
        for (uint256 i = 0; i < participants.length; i++) {
            Entry storage entry = entries[battleId][participants[i]];
            vault.unlockYield(participants[i], entry.amount);
        }

        emit BattleCancelled(battleId);
    }

    // --- Claiming ---

    /// @notice Winners claim their payout. Losers have nothing to claim.
    function claim(uint256 battleId) external {
        Battle storage battle = battles[battleId];
        if (battle.status != BattleStatus.RESOLVED) revert BattleNotResolved();

        Entry storage entry = entries[battleId][msg.sender];
        if (entry.amount == 0) revert InvalidBattle();
        if (entry.claimed) revert AlreadyClaimed();

        entry.claimed = true;

        // Unlock the user's locked yield first
        vault.unlockYield(msg.sender, entry.amount);

        if (entry.side == battle.winningSide) {
            // Winner: get wager back + proportional share of losers
            uint256 winnerPool = battle.winningSide == Side.YES ? battle.yesPool : battle.noPool;
            uint256 loserPool = battle.winningSide == Side.YES ? battle.noPool : battle.yesPool;

            uint256 fee = (loserPool * protocolFeeBps) / 10000;
            uint256 distributable = loserPool - fee;
            uint256 winnings = entry.amount + (entry.amount * distributable) / winnerPool;

            // Credit winnings to user's principal (so they earn yield)
            vault.creditWinnings(msg.sender, winnings);
            protocolFees += fee;

            emit Claimed(battleId, msg.sender, winnings);
        } else {
            // Loser: yield is gone (already unlocked above, but not credited back)
            // The yield was locked and now released — but goes to winners, not back to loser
            emit Claimed(battleId, msg.sender, 0);
        }
    }

    // --- View Functions ---

    function getBattle(uint256 battleId) external view returns (Battle memory) {
        return battles[battleId];
    }

    function getEntry(uint256 battleId, address user) external view returns (Entry memory) {
        return entries[battleId][user];
    }

    function getParticipantCount(uint256 battleId) external view returns (uint256) {
        return battleParticipants[battleId].length;
    }

    function getCurrentBattleId() external view returns (uint256) {
        return nextBattleId > 0 ? nextBattleId - 1 : 0;
    }

    // --- Internal ---

    function _resolveBattle(uint256 battleId, Side winner) internal {
        Battle storage battle = battles[battleId];
        battle.status = BattleStatus.RESOLVED;
        battle.winningSide = winner;

        // Edge case: if all bets are on one side, or no bets, cancel instead
        if (battle.yesPool == 0 || battle.noPool == 0) {
            battle.status = BattleStatus.CANCELLED;
            // Refund everyone
            address[] storage participants = battleParticipants[battleId];
            for (uint256 i = 0; i < participants.length; i++) {
                Entry storage entry = entries[battleId][participants[i]];
                vault.unlockYield(participants[i], entry.amount);
            }
            emit BattleCancelled(battleId);
            return;
        }

        emit BattleResolved(battleId, winner, battle.yesPool, battle.noPool);
    }

    // --- Admin ---

    function withdrawFees(address to) external onlyAdmin {
        uint256 fees = protocolFees;
        protocolFees = 0;
        // Fees are tracked but the actual USDC is in the vault/lending pool
        // Admin would need to coordinate withdrawal — for hackathon this is fine
        vault.creditWinnings(to, fees);
    }
}
