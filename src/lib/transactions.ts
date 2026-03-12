/**
 * FCL Transaction Helpers
 *
 * All writes go through Cadence → COA → EVM.
 * Frontend never signs EVM transactions directly.
 *
 * Supports two auth modes:
 * 1. Passkey (FLIP-264): signs locally with WebAuthn, zero popups
 * 2. Flow Wallet (Blocto): FCL Discovery wallet as fallback
 */
import * as fcl from '@onflow/fcl'
import { CONTRACTS, NETWORK } from '../config/flow'
import { getStoredPasskey } from './passkey'
import { passkeyAuthz } from './fcl-passkey'

/**
 * Disconnect wallet / clear passkey.
 */
export function disconnectWallet(): void {
  fcl.unauthenticate()
  localStorage.removeItem('float_passkey')
}

/**
 * Get authorization function.
 * Uses passkey if available, otherwise FCL wallet.
 */
function walletAuthz(): any {
  const stored = getStoredPasskey()
  if (stored) return passkeyAuthz
  return fcl.currentUser.authorization
}

// --- Account Setup (one-time after passkey creation) ---

export async function setupAccount(): Promise<string> {

  const txId = await fcl.mutate({
    cadence: `
      import EVM from 0xEVM
      import FlowToken from 0xFlowToken
      import FungibleToken from 0xFungibleToken

      transaction(
        usdcAddr: String,
        vaultAddr: String,
        mintAmount: UInt256,
        depositAmount: UInt256,
        yieldAmount: UInt256
      ) {
        prepare(signer: auth(SaveValue, BorrowValue, IssueStorageCapabilityController, PublishCapability) &Account) {
          // 1. Create COA if not exists
          if signer.storage.borrow<&EVM.CadenceOwnedAccount>(from: /storage/evm) == nil {
            let coa <- EVM.createCadenceOwnedAccount()
            signer.storage.save(<-coa, to: /storage/evm)
          }

          // 2. Publish public capability for address reading
          let existingCap = signer.capabilities.get<&EVM.CadenceOwnedAccount>(/public/evm)
          if existingCap == nil || !existingCap!.check() {
            let cap = signer.capabilities.storage.issue<&EVM.CadenceOwnedAccount>(/storage/evm)
            signer.capabilities.publish(cap, at: /public/evm)
          }

          // 3. Fund COA with FLOW for EVM gas
          let flowVault = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
            from: /storage/flowTokenVault
          ) ?? panic("No FLOW vault")

          let coa = signer.storage.borrow<auth(EVM.Call, EVM.Owner) &EVM.CadenceOwnedAccount>(from: /storage/evm)!

          let flowTokens <- flowVault.withdraw(amount: 0.0005) as! @FlowToken.Vault
          coa.deposit(from: <-flowTokens)

          let usdc = EVM.addressFromString(usdcAddr)
          let vault = EVM.addressFromString(vaultAddr)
          let coaEvmAddr = coa.address()

          // 4. Mint mock USDC to COA
          let mintData = EVM.encodeABIWithSignature(
            "mint(address,uint256)",
            [coaEvmAddr, mintAmount]
          )
          let mintResult = coa.call(to: usdc, data: mintData, gasLimit: 200_000, value: EVM.Balance(attoflow: UInt(0)))
          assert(mintResult.status == EVM.Status.successful,
            message: "USDC mint failed: ".concat(mintResult.errorMessage))

          // 5. Approve vault to spend USDC
          let approveData = EVM.encodeABIWithSignature(
            "approve(address,uint256)",
            [vault, depositAmount]
          )
          let approveResult = coa.call(to: usdc, data: approveData, gasLimit: 100_000, value: EVM.Balance(attoflow: UInt(0)))
          assert(approveResult.status == EVM.Status.successful,
            message: "USDC approve failed: ".concat(approveResult.errorMessage))

          // 6. Deposit into FloatVault
          let depositData = EVM.encodeABIWithSignature(
            "deposit(uint256)",
            [depositAmount]
          )
          let depositResult = coa.call(to: vault, data: depositData, gasLimit: 500_000, value: EVM.Balance(attoflow: UInt(0)))
          assert(depositResult.status == EVM.Status.successful,
            message: "Deposit failed: ".concat(depositResult.errorMessage))

          // 7. Simulate yield (testnet only — admin function on MockPool)
          let yieldData = EVM.encodeABIWithSignature(
            "simulateYield(uint256)",
            [yieldAmount]
          )
          let yieldResult = coa.call(to: vault, data: yieldData, gasLimit: 200_000, value: EVM.Balance(attoflow: UInt(0)))
          // Don't assert — simulateYield may not exist on all vault versions
          if yieldResult.status != EVM.Status.successful {
            log("Yield simulation skipped (not available on this vault)")
          }
        }
      }
    `,
    args: (arg: any, t: any) => [
      arg(CONTRACTS.STG_USDC, t.String),
      arg(CONTRACTS.FLOAT_VAULT, t.String),
      arg('10000000000', t.UInt256),   // 10,000 USDC mint
      arg('1000000000', t.UInt256),    // 1,000 USDC deposit
      arg('50000000', t.UInt256),      // 50 USDC simulated yield
    ],
    proposer: walletAuthz(),
    payer: walletAuthz(),
    authorizations: [walletAuthz()],
    limit: 9999,
  })

  return txId
}

// --- Get COA EVM Address ---

export async function getEvmAddress(flowAddress: string): Promise<string | null> {
  try {
    const result = await fcl.query({
      cadence: `
        import EVM from 0xEVM

        access(all) fun main(flowAddress: Address): String {
          let account = getAccount(flowAddress)
          let coa = account.capabilities.borrow<&EVM.CadenceOwnedAccount>(/public/evm)
            ?? panic("No COA capability")
          return coa.address().toString()
        }
      `,
      args: (arg: any, t: any) => [arg(flowAddress, t.Address)],
    })
    return result
  } catch {
    return null
  }
}

// --- Fund Account via Faucet API (testnet only) ---

export async function fundAccountWithFlow(flowAddress: string): Promise<boolean> {
  if (NETWORK !== 'testnet') return true

  try {
    const res = await fetch('https://faucet.flow.com/api/fund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: flowAddress,
        network: 'testnet',
        token: 'FLOW',
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// --- Deposit USDC ---

export async function depositUSDC(amount: string): Promise<string> {

  const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e6)).toString()

  const txId = await fcl.mutate({
    cadence: `
      import EVM from 0xEVM

      transaction(vaultAddr: String, usdcAddr: String, amount: UInt256) {
        let coa: auth(EVM.Call) &EVM.CadenceOwnedAccount

        prepare(signer: auth(BorrowValue) &Account) {
          self.coa = signer.storage.borrow<auth(EVM.Call) &EVM.CadenceOwnedAccount>(from: /storage/evm)
            ?? panic("No COA found. Create one first.")
        }

        execute {
          let vault = EVM.addressFromString(vaultAddr)
          let usdc = EVM.addressFromString(usdcAddr)
          let coaEvmAddr = self.coa.address()

          // 1. Mint mock USDC to COA (testnet only — MockUSDC has public mint)
          let mintData = EVM.encodeABIWithSignature(
            "mint(address,uint256)",
            [coaEvmAddr, amount]
          )
          let mintResult = self.coa.call(
            to: usdc,
            data: mintData,
            gasLimit: 200_000,
            value: EVM.Balance(attoflow: UInt(0))
          )
          // Don't assert — mint may fail on mainnet where USDC isn't mock
          if mintResult.status != EVM.Status.successful {
            log("USDC mint skipped (not a mock token)")
          }

          // 2. Approve USDC spending by vault
          let approveData = EVM.encodeABIWithSignature(
            "approve(address,uint256)",
            [vault, amount]
          )
          let approveResult = self.coa.call(
            to: usdc,
            data: approveData,
            gasLimit: 100_000,
            value: EVM.Balance(attoflow: UInt(0))
          )
          assert(approveResult.status == EVM.Status.successful,
            message: "USDC approve failed: ".concat(approveResult.errorMessage))

          // 3. Call vault.deposit(amount)
          let depositData = EVM.encodeABIWithSignature(
            "deposit(uint256)",
            [amount]
          )
          let depositResult = self.coa.call(
            to: vault,
            data: depositData,
            gasLimit: 500_000,
            value: EVM.Balance(attoflow: UInt(0))
          )
          assert(depositResult.status == EVM.Status.successful,
            message: "Deposit failed: ".concat(depositResult.errorMessage))

          // 4. Simulate yield (testnet only — 5% of deposit)
          let yieldAmount = amount / 20 as UInt256
          let yieldData = EVM.encodeABIWithSignature(
            "simulateYield(uint256)",
            [yieldAmount]
          )
          let yieldResult = self.coa.call(
            to: vault,
            data: yieldData,
            gasLimit: 200_000,
            value: EVM.Balance(attoflow: UInt(0))
          )
          if yieldResult.status != EVM.Status.successful {
            log("Yield simulation skipped")
          }
        }
      }
    `,
    args: (arg: any, t: any) => [
      arg(CONTRACTS.FLOAT_VAULT, t.String),
      arg(CONTRACTS.STG_USDC, t.String),
      arg(amountWei, t.UInt256),
    ],
    proposer: walletAuthz(),
    payer: walletAuthz(),
    authorizations: [walletAuthz()],
    limit: 9999,
  })

  return txId
}

// --- Enter Battle ---

export async function enterBattle(
  battleId: string,
  side: 'yes' | 'no',
  amount: string,
): Promise<string> {

  const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e6)).toString()
  const sideNum = side === 'yes' ? '0' : '1'

  const txId = await fcl.mutate({
    cadence: `
      import EVM from 0xEVM

      transaction(battlePoolAddr: String, battleId: UInt256, side: UInt8, amount: UInt256) {
        let coa: auth(EVM.Call) &EVM.CadenceOwnedAccount

        prepare(signer: auth(BorrowValue) &Account) {
          self.coa = signer.storage.borrow<auth(EVM.Call) &EVM.CadenceOwnedAccount>(from: /storage/evm)
            ?? panic("No COA found.")
        }

        execute {
          let pool = EVM.addressFromString(battlePoolAddr)

          let calldata = EVM.encodeABIWithSignature(
            "enter(uint256,uint8,uint256)",
            [battleId, side, amount]
          )

          let result = self.coa.call(
            to: pool,
            data: calldata,
            gasLimit: 500_000,
            value: EVM.Balance(attoflow: UInt(0))
          )
          assert(result.status == EVM.Status.successful,
            message: "Enter battle failed: ".concat(result.errorMessage))
        }
      }
    `,
    args: (arg: any, t: any) => [
      arg(CONTRACTS.BATTLE_POOL, t.String),
      arg(battleId, t.UInt256),
      arg(sideNum, t.UInt8),
      arg(amountWei, t.UInt256),
    ],
    proposer: walletAuthz(),
    payer: walletAuthz(),
    authorizations: [walletAuthz()],
    limit: 9999,
  })

  return txId
}

// --- Claim Battle Winnings ---

export async function claimBattle(battleId: string): Promise<string> {

  const txId = await fcl.mutate({
    cadence: `
      import EVM from 0xEVM

      transaction(battlePoolAddr: String, battleId: UInt256) {
        let coa: auth(EVM.Call) &EVM.CadenceOwnedAccount

        prepare(signer: auth(BorrowValue) &Account) {
          self.coa = signer.storage.borrow<auth(EVM.Call) &EVM.CadenceOwnedAccount>(from: /storage/evm)
            ?? panic("No COA found.")
        }

        execute {
          let pool = EVM.addressFromString(battlePoolAddr)

          let calldata = EVM.encodeABIWithSignature(
            "claim(uint256)",
            [battleId]
          )

          let result = self.coa.call(
            to: pool,
            data: calldata,
            gasLimit: 300_000,
            value: EVM.Balance(attoflow: UInt(0))
          )
          assert(result.status == EVM.Status.successful,
            message: "Claim failed: ".concat(result.errorMessage))
        }
      }
    `,
    args: (arg: any, t: any) => [
      arg(CONTRACTS.BATTLE_POOL, t.String),
      arg(battleId, t.UInt256),
    ],
    proposer: walletAuthz(),
    payer: walletAuthz(),
    authorizations: [walletAuthz()],
    limit: 9999,
  })

  return txId
}

// --- Withdraw Principal ---

export async function withdrawPrincipal(amount: string): Promise<string> {

  const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e6)).toString()

  const txId = await fcl.mutate({
    cadence: `
      import EVM from 0xEVM

      transaction(vaultAddr: String, amount: UInt256) {
        let coa: auth(EVM.Call) &EVM.CadenceOwnedAccount

        prepare(signer: auth(BorrowValue) &Account) {
          self.coa = signer.storage.borrow<auth(EVM.Call) &EVM.CadenceOwnedAccount>(from: /storage/evm)
            ?? panic("No COA found.")
        }

        execute {
          let vault = EVM.addressFromString(vaultAddr)

          let calldata = EVM.encodeABIWithSignature(
            "withdraw(uint256)",
            [amount]
          )

          let result = self.coa.call(
            to: vault,
            data: calldata,
            gasLimit: 500_000,
            value: EVM.Balance(attoflow: UInt(0))
          )
          assert(result.status == EVM.Status.successful,
            message: "Withdraw failed: ".concat(result.errorMessage))
        }
      }
    `,
    args: (arg: any, t: any) => [
      arg(CONTRACTS.FLOAT_VAULT, t.String),
      arg(amountWei, t.UInt256),
    ],
    proposer: walletAuthz(),
    payer: walletAuthz(),
    authorizations: [walletAuthz()],
    limit: 9999,
  })

  return txId
}

// --- Transaction Status Helper ---

export async function waitForTransaction(txId: string): Promise<void> {
  await fcl.tx(txId).onceSealed()
}
