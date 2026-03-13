# Float

Deposit USDC, earn yield, wager your earnings on daily predictions. Your deposit is always safe.

## The Problem

DeFi lending protocols pay 4% APY. Your savings account pays 0.5%. But nobody uses DeFi because the UX is hostile -- connect wallet, approve tokens, manage gas, stare at a number going up by fractions of a cent.

Prediction markets are booming. But every platform -- Polymarket, Kalshi, PredictIt -- requires you to risk real money. Lose a bet, lose your stake.

No product lets you earn passive yield *and* do something fun with it, without ever risking the money you put in.

## How Float Works

Float combines lending yield with prediction battles. You deposit USDC, it earns yield through MORE Markets (an Aave V3 fork on Flow). You wager that yield -- never your principal -- on daily predictions.

**Concrete example:**

1. You deposit $100 USDC. It starts earning ~4.1% APY immediately.
2. After 30 days, you have ~$1.01 in yield. Your $100 principal is untouched.
3. A daily battle appears: "Will ETH close higher today?" You wager $0.50 of your yield on YES.
4. ETH closes higher. The YES pool had $3.00, the NO pool had $2.00. Protocol takes 5% of the losing pool ($0.10). The remaining $1.90 is split proportionally among winners.
5. Your payout: $0.50 (your wager back) + ($0.50 / $3.00) * $1.90 = $0.82 total.
6. That $0.82 gets added to your principal. You now have $100.82 earning yield. Winnings compound.

If you lose, you lose $0.50 of yield. Your $100 deposit never moves.

## Architecture

![Float Architecture](public/architecture.svg)

```
User (passkey) --> Frontend (React + Vite) --> FCL --> Flow Account (P256 key)
                                                            |
                               .----------------------------'
                               v
                      Flow EVM Contracts
                      |-- FloatVault.sol (deposits, yield, lending)
                      |-- BattlePool.sol (battles, wagers, payouts)
                      |
                      Cadence Scheduled Handlers
                      |-- YieldCompounder.cdc  --> daily --> FloatVault.compoundYield()
                      |-- BattleResolver.cdc   --> daily ~23:30 UTC --> read Band Oracle --> resolve()
                      '-- BattleCreator.cdc    --> daily after resolve --> createBattle() for next day
```

### Frontend

React + Vite + Tailwind. Two communication paths to the blockchain:

- **Reads** go through viem directly to the Flow EVM RPC. No signing needed. This covers balance checks, battle state, yield calculations.
- **Writes** go through FCL.mutate(), which submits a Cadence transaction. That Cadence transaction borrows a CadenceOwnedAccount (COA), which calls the Solidity contract on Flow EVM via `coa.call()`.

This split exists because Flow EVM contracts live inside Flow's Cadence VM. Reading is free and direct. Writing requires a Cadence transaction that bridges into EVM.

### Cross-VM Flow (Cadence to EVM)

Every write operation follows the same pattern:

1. Frontend calls `FCL.mutate()` with a Cadence transaction
2. Cadence transaction borrows the user's COA from `/storage/evm`
3. COA encodes the Solidity function call with `EVM.encodeABIWithSignature()`
4. COA calls the EVM contract via `coa.call(to, data, gasLimit, value)`
5. Solidity contract executes on Flow EVM

This is not a bridge in the traditional sense -- there is no message passing or finality delay. Flow EVM runs inside the Cadence VM, so the call is synchronous and atomic within a single transaction.

### EVM Layer

Two Solidity contracts handle all financial logic:

- **FloatVault.sol** -- Receives USDC deposits, supplies them to MORE Markets (Aave V3 fork), tracks per-user principal and yield, locks/unlocks yield for battles, credits winnings.
- **BattlePool.sol** -- Creates prediction battles, accepts yield wagers, determines winners based on oracle prices, distributes payouts with a 5% protocol fee on the losing pool.

### Cadence Layer

Three lightweight contracts (~50 lines each) use Flow's `FlowTransactionScheduler` to automate daily operations without any off-chain infrastructure:

- **YieldCompounder** -- Triggers vault maintenance daily
- **BattleResolver** -- Reads Band Oracle prices and resolves the day's battle
- **BattleCreator** -- Creates tomorrow's battle after today's resolves

Each contract implements `FlowTransactionScheduler.TransactionHandler`. The Flow protocol itself executes these at the scheduled time. No bots, no cron jobs, no servers.

## Smart Contracts

### FloatVault.sol

Manages deposits, yield tracking, and integration with MORE Markets.

**User functions:**

| Function | Description |
|----------|-------------|
| `deposit(uint256 amount)` | Transfer USDC into the vault. Vault supplies it to MORE Markets via `Pool.supply()`. Principal is tracked per-user. |
| `withdraw(uint256 amount)` | Withdraw principal. Fails if remaining yield would not cover yield locked in active battles. |
| `withdrawYield(uint256 amount)` | Withdraw earned yield (not locked in battles). |
| `yieldOf(address user)` | View: available yield = pro-rata share of aToken growth minus locked yield. |
| `totalValueOf(address user)` | View: principal + yield combined. |

**BattlePool-only functions (called during battle lifecycle):**

| Function | Description |
|----------|-------------|
| `lockYield(address user, uint256 amount)` | Lock yield when user enters a battle. Prevents double-spending across multiple battles. |
| `unlockYield(address user, uint256 amount)` | Release locked yield after battle resolution. |
| `creditWinnings(address user, uint256 amount)` | Add winnings to user's principal. Winnings then earn yield too (compound effect). |

**Yield calculation:**

```
totalAssets = aToken.balanceOf(vault)
userShare = (totalAssets * principalOf[user]) / totalPrincipal
userYield = userShare - principalOf[user]
availableYield = userYield - yieldLockedOf[user]
```

The vault does not hold USDC directly. All deposited USDC is supplied to MORE Markets, which returns aTokens. The aToken balance grows over time as interest accrues -- this is how yield is generated.

### BattlePool.sol

Manages prediction battles, entries, resolution, and payouts.

**Battle types:**

- **HIGHER** -- "Will FLOW close higher today?" Wins if `actualPrice > referencePrice`.
- **ABOVE_TARGET** -- "Will ETH be above $2,100 tomorrow?" Wins if `actualPrice > targetPrice`.
- **CHANGE_PERCENT** -- "Will BTC move more than 5% today?" Wins if absolute change exceeds `targetPercent` (in basis points).
- **Event battles** -- "Will Lakers win tonight?" Admin-resolved, not oracle-resolved.

**Admin functions:**

| Function | Description |
|----------|-------------|
| `createBattle(question, resolveTimestamp, oracleSymbol, referencePrice, targetPrice, targetPercent, battleType)` | Create an oracle-resolved crypto battle. |
| `createEventBattle(question, resolveTimestamp)` | Create an admin-resolved event battle. |
| `resolve(battleId, actualPrice)` | Resolve a crypto battle with the oracle price. Determines winner based on battle type. |
| `resolveManual(battleId, yesWins)` | Resolve an event battle with a boolean outcome. |
| `cancelBattle(battleId)` | Cancel a battle and refund all locked yield. |

**User functions:**

| Function | Description |
|----------|-------------|
| `enter(battleId, side, amount)` | Pick YES or NO, wager yield. Locks yield in the vault. One entry per user per battle. |
| `claim(battleId)` | Winners claim wager + proportional share of losers (minus 5% fee). Losers get nothing. |

**Payout math:**

A battle has $5.00 in the YES pool and $3.00 in the NO pool. YES wins.

```
loserPool       = $3.00
protocolFee     = $3.00 * 5%           = $0.15
distributable   = $3.00 - $0.15        = $2.85

For a winner who wagered $2.00 out of the $5.00 YES pool:
payout = $2.00 + ($2.00 / $5.00) * $2.85 = $3.14
```

Winnings are credited to the winner's principal via `vault.creditWinnings()`, so they immediately start earning yield.

**Edge case: one-sided battles.** If all bets land on one side (YES pool or NO pool is zero), the battle auto-cancels and all yield is refunded. There is no losing pool to distribute.

## Cadence Contracts

### YieldCompounder.cdc

Scheduled to fire daily. Borrows the deployer's COA and calls `FloatVault.compoundYield()` on EVM. For Aave V3 forks, yield auto-compounds via aToken rebasing, so this function primarily serves as a hook for future protocol fee extraction.

### BattleResolver.cdc

Scheduled to fire daily at ~23:30 UTC. Receives battle ID and actual price as parameters (set when the scheduled transaction is created). Borrows the COA and calls `BattlePool.resolve(battleId, actualPrice)` on EVM.

The actual Band Oracle price read happens in the scheduling transaction, not in the handler itself. This avoids the handler needing direct oracle access.

### BattleCreator.cdc

Fires daily after battle resolution. Receives pre-encoded calldata for `BattlePool.createBattle()` and forwards it to EVM via `coa.call()`. The scheduling transaction determines which symbol and template to use based on the day's rotation.

**Template rotation:** 4 symbols (FLOW, ETH, BTC, SOL) rotate through templates daily. Monday is FLOW HIGHER, Tuesday is ETH ABOVE_TARGET, and so on. Zero manual work for crypto battles.

## Deployed Contracts

**Flow Testnet** -- Account: `0xf865549035cf159a`

| Contract | Address |
|----------|---------|
| FloatVault | `0x65aA2d8aa386758CE4032E1628D80F6d4CF8EbbC` |
| BattlePool | `0x807E68C074D761a0617cCDF2E61Db146F0a79Aad` |
| MockUSDC | `0x5308C7C3f9A5D5242C9462B10C927AD73Cd7E7eE` |

**Key external addresses (Flow EVM mainnet):**

| Contract | Address |
|----------|---------|
| MORE Markets Pool | `0xbC92aaC2DBBF42215248B5688eB3D3d2b32F2c8d` |
| stgUSDC | `0xF1815bd50389c46847f0Bda824eC8da914045D14` |
| aToken (stgUSDC) | `0x49c6b2799aF2Db7404b930F24471dD961CFE18b7` |
| Band Oracle (Cadence) | `0x6801a6222ebf784a` |
| FlowTransactionScheduler (testnet) | `0x8c5303eaa26202d6` |

## Revenue Model

**Battle fees:** 5% of the losing pool on every resolved battle. At 1,000 daily active users wagering an average of $2 each, that is ~$50/day in protocol revenue.

**Yield spread:** Users see 3.8% APY. The underlying protocol earns 4.13% APY. The 0.33% spread accrues to the protocol. At $1M TVL, that is ~$3,300/year.

**Premium battles (V2):** Sponsored battles with larger pools and brand partnerships. A sponsor seeds a $500 battle pot, Float takes a cut.

## Testing

19 Foundry tests cover the full battle lifecycle: deposits, yield calculation, battle creation, entry, resolution, claiming, cancellation, edge cases (one-sided battles, zero yield, double entry prevention).

```bash
cd contracts && forge test
```

All tests run against mock contracts (MockERC20, MockAToken, MockPool) that simulate Aave V3 behavior without requiring a fork.

## Troubleshooting

**"execution reverted" when calling `enter()`**

Three likely causes: (1) you already entered this battle (one entry per user per battle), (2) your available yield is less than the wager amount, or (3) the battle's resolve timestamp has passed and it no longer accepts entries.

**FCL transaction hanging with no popup**

Blocto wallet requires a popup for transaction approval. Check your browser's popup blocker settings. Safari is aggressive about blocking these.

**Yield showing $0 after depositing**

Yield accrues from aToken balance growth. On testnet with MockUSDC, call `simulateYield(amount)` on the vault to manually mint aTokens and simulate interest accrual. On mainnet, yield accrues naturally but may take hours to become visible.

**Battle auto-cancelled instead of resolved**

One-sided battles (all YES or all NO bets) auto-cancel and refund everyone. There is no losing pool to distribute, so the battle cannot produce a meaningful payout.

**"address invalid for chain flow-testnet"**

Your Flow account may not exist on testnet. Sign out of FCL, reconnect, and ensure your account is funded. New accounts need at least 0.002 FLOW for storage.

**"WouldUnderfundBattles" on withdrawal**

You have yield locked in active battles. If you withdraw principal, your remaining yield would drop below the locked amount. Wait for active battles to resolve, then withdraw.

**Scheduled transactions not firing**

Verify the handler is registered with FlowTransactionScheduler and the execution effort budget is set to at least 5000. Check that the COA exists at `/storage/evm` on the deployer account.

## Passkey Authentication

Traditional DeFi onboarding requires users to install a wallet extension, write down a seed phrase, and fund an account with gas tokens. Float eliminates all of this with passkey-based walletless onboarding.

### How it works

The system uses two separate keys with distinct responsibilities:

1. **WebAuthn credential (UX layer)** -- Triggers Face ID or fingerprint for familiar "passkey saved" experience. Created via `navigator.credentials.create()` with P-256 curve. This credential is only used for the biometric prompt.

2. **Web Crypto P256 signing key (transaction layer)** -- Generated via `crypto.subtle.generateKey()`. This key produces standard ECDSA_P256 signatures that Flow verifies natively. The private key is exported as JWK and stored in localStorage.

**Why two keys?** WebAuthn signatures wrap the challenge in `authenticatorData || SHA256(clientDataJSON)`. Flow's signature verification expects a standard ECDSA signature over the raw transaction message. WebAuthn cannot produce this. So we use WebAuthn for the biometric UX and a separate Web Crypto key for actual signing.

### Account creation flow

```
User taps "Get Started with Passkey"
  |
  v
1. navigator.credentials.create() --> Face ID / fingerprint prompt
   (creates WebAuthn credential, user sees "Passkey saved")
  |
  v
2. crypto.subtle.generateKey('P-256') --> P256 keypair
   (private key exported as JWK, stored in localStorage)
  |
  v
3. POST hardware-wallet-api-testnet.staging.onflow.org/accounts
   body: { publicKey: hex(x||y), signatureAlgorithm: ECDSA_P256, hashAlgorithm: SHA2_256 }
   --> returns Flow address (e.g. 0xe0007473789b91c2)
  |
  v
4. Deployer sends 10 FLOW to new account
   (faucet has CORS issues from browser, so deployer funds directly)
  |
  v
5. setupAccount() transaction:
   - Creates CadenceOwnedAccount (COA) at /storage/evm
   - Funds COA with 0.0005 FLOW for EVM gas
   - Mints 10,000 mock USDC to COA
   - Deposits 1,000 USDC into FloatVault
   - Simulates 50 USDC yield (testnet only)
```

### Transaction signing

Every FCL transaction goes through `walletAuthz()`, which checks for a stored passkey:

```typescript
function walletAuthz(): any {
  const stored = getStoredPasskey()
  if (stored) return passkeyAuthz   // sign locally with Web Crypto
  return fcl.currentUser.authorization // fall back to Blocto/Discovery
}
```

The `passkeyAuthz` function signs the FCL signable message using the stored private key:

```typescript
signingFunction: async (signable: { message: string }) => {
  const messageBytes = hexToBytes(signable.message)
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    messageBytes,
  )
  // Convert to r||s format, return hex
}
```

Flow's access node verifies: `ECDSA_P256(SHA2_256(message))` matches the public key registered on the account. No popups, no wallet extensions, no browser redirects.

### Session persistence

On page reload, `App.tsx` checks localStorage for a stored passkey before falling back to FCL:

```typescript
const passkey = getStoredPasskey()
if (passkey) {
  // Restore session from passkey -- no network call needed
  const evmAddr = await getEvmAddress(passkey.flowAddress)
  setAuth({ flowAddress: passkey.flowAddress, evmAddress: evmAddr, loggedIn: true })
  return
}
// Fall back to FCL wallet session
const user = await fcl.currentUser.snapshot()
```

### Security considerations

- **Private key in localStorage**: The signing key is stored as a JWK in localStorage. This is acceptable for a testnet demo but not production. A production implementation would use IndexedDB with `extractable: false` and protect access with the WebAuthn credential via the PRF extension.
- **Deployer key in frontend**: The deployer private key is embedded in `passkey.ts` for account funding. This is testnet-only. Production would use a backend funding service or gas sponsorship.
- **No key rotation**: If a user clears localStorage, the signing key is lost and the Flow account is unrecoverable. Production would need cloud backup or social recovery.

## Frontend Components

```
App.tsx
|-- Onboarding.tsx        # Dual auth: passkey primary, Flow Wallet fallback
|-- AccountSetup.tsx      # One-time COA creation + initial deposit
'-- Home.tsx              # Main dashboard
    |-- BalanceCard.tsx   # Principal, yield, total value (reads from FloatVault via viem)
    |-- BattleCard.tsx    # Active battle with YES/NO buttons + wager modal
    |-- PastBattles.tsx   # Resolved battles with claim buttons
    |-- ActivityFeed.tsx  # Recent on-chain events (deposits, withdrawals, battle entries)
    |-- DepositModal.tsx  # Deposit USDC flow
    '-- WithdrawModal.tsx # Withdraw principal flow
```

**Data flow:** All reads go through a viem public client pointed at the Flow EVM RPC (`https://testnet.evm.nodes.onflow.org`). Components call `publicClient.readContract()` with the deployed contract addresses and ABIs. Writes go through FCL as Cadence transactions.

**Polling:** BalanceCard and BattleCard poll every 15 seconds via `useEffect` intervals. ActivityFeed fetches historical logs via `publicClient.getLogs()` filtered by the user's EVM address.

## Deployment

### Local development

```bash
npm install
npm run dev          # starts Vite on localhost:5175
```

### Solidity tests

```bash
cd contracts
forge test           # 19/19 passing
forge test -vvv      # verbose output with traces
```

### Vercel deployment

Environment variables required:

```
VITE_FLOW_NETWORK=testnet
VITE_MOCK_USDC=0x8AEa486507fe32C4F37232262bb550EA2806c328
VITE_FLOAT_VAULT=0xEd247477E8aa030D37eEDd1510EEBd65d3F449dA
VITE_BATTLE_POOL=0x19FABBac46C3a330985c1833514eF96b413bCDAF
```

Build command: `tsc -b && vite build` (output: `dist/`)

### Contract deployment

Solidity contracts are deployed via Foundry's `forge script`:

```bash
cd contracts
source ../.env.testnet
forge script script/Deploy.s.sol:Deploy --rpc-url $FLOW_EVM_RPC --broadcast
```

Cadence contracts are deployed via `flow-cli`:

```bash
flow accounts add-contract YieldCompounder cadence/contracts/YieldCompounder.cdc --network testnet
flow accounts add-contract BattleResolver cadence/contracts/BattleResolver.cdc --network testnet
flow accounts add-contract BattleCreator cadence/contracts/BattleCreator.cdc --network testnet
```

Scheduled transactions are registered via:

```bash
flow transactions send cadence/transactions/schedule_yield_compounder.cdc --network testnet
flow transactions send cadence/transactions/schedule_battle_resolver.cdc --network testnet
flow transactions send cadence/transactions/schedule_battle_creator.cdc --network testnet
```

## Security Considerations

**Principal isolation.** FloatVault enforces that withdrawals cannot reduce a user's yield below their locked amount. The `withdraw()` function checks: `yieldOf(user) - yieldLockedOf[user] >= 0` after the withdrawal. This prevents users from withdrawing principal to avoid battle losses.

**One entry per battle.** BattlePool enforces `entries[battleId][msg.sender].amount == 0` before allowing entry. This prevents users from hedging by betting on both sides.

**Auto-cancel one-sided battles.** If resolution finds that either the YES or NO pool is zero, the battle is cancelled and all yield is refunded. Without this, one-sided battles would have no losing pool to distribute and winners would only get their own wager back.

**Protocol fee extraction.** The 5% fee is taken from the losing pool, not the winning pool. Winners always receive their full wager plus a share of losers. The fee never reduces a winner's return below their wager.

**Mock contracts on testnet.** MockUSDC has a public `mint()` function. This is intentional for testnet -- anyone can mint. The production deployment would use real USDC, which has no public mint.

## Roadmap

**V2:**
- Real Band Oracle integration for live price resolution on mainnet
- User-created battles with creator bonds and community dispute resolution
- Multi-outcome battles (3-way split) and range battles
- Streaks, leaderboards, and social features
- Gas sponsorship via Flow's three-role transaction model (users never see gas fees)
- IndexedDB key storage with PRF extension for production passkey security
- Social recovery for passkey accounts
- Mainnet deployment on Flow EVM
