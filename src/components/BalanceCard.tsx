import { useState, useEffect } from 'react'
import { publicClient } from '../config/viem'
import { CONTRACTS } from '../config/flow'
import { floatVaultAbi } from '../lib/abis'
import { formatUnits } from 'viem'

interface BalanceCardProps {
  evmAddress: string | null
  onDeposit: () => void
  onWithdraw: () => void
}

export function BalanceCard({ evmAddress, onDeposit, onWithdraw }: BalanceCardProps) {
  const [principal, setPrincipal] = useState('0.00')
  const [yieldBalance, setYieldBalance] = useState('0.00')
  const [totalValue, setTotalValue] = useState('0.00')
  const [loading, setLoading] = useState(true)
  const [prevYield, setPrevYield] = useState('0.00')

  useEffect(() => {
    if (!evmAddress) return

    async function fetchBalances() {
      try {
        const addr = (evmAddress!.startsWith('0x') ? evmAddress! : `0x${evmAddress}`) as `0x${string}`

        const [principalRaw, yieldRaw, totalRaw] = await Promise.all([
          publicClient.readContract({
            address: CONTRACTS.FLOAT_VAULT,
            abi: floatVaultAbi,
            functionName: 'principalOf',
            args: [addr],
          }),
          publicClient.readContract({
            address: CONTRACTS.FLOAT_VAULT,
            abi: floatVaultAbi,
            functionName: 'yieldOf',
            args: [addr],
          }),
          publicClient.readContract({
            address: CONTRACTS.FLOAT_VAULT,
            abi: floatVaultAbi,
            functionName: 'totalValueOf',
            args: [addr],
          }),
        ])

        setPrevYield(yieldBalance)
        setPrincipal(formatUnits(principalRaw, 6))
        setYieldBalance(formatUnits(yieldRaw, 6))
        setTotalValue(formatUnits(totalRaw, 6))
      } catch {
        // Contracts not deployed yet — show zeros
      } finally {
        setLoading(false)
      }
    }

    fetchBalances()
    const interval = setInterval(fetchBalances, 15000)
    return () => clearInterval(interval)
  }, [evmAddress])

  const fmt = (val: string) => {
    const num = parseFloat(val)
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const yieldIncreased = parseFloat(yieldBalance) > parseFloat(prevYield) && prevYield !== '0.00'

  return (
    <div
      className="p-6"
      style={{
        borderRadius: 'var(--radius)',
        backgroundColor: 'var(--float-surface)',
      }}
    >
      {/* Total Balance */}
      <div className="mb-1 text-[13px] text-[var(--float-text-muted)]">Total Balance</div>
      <div className="font-tabular mb-5 text-[2rem] font-bold leading-none tracking-tight">
        {loading ? (
          <div className="skeleton h-8 w-36" style={{ borderRadius: '6px' }} />
        ) : (
          <span className="animate-number-bump inline-block">${fmt(totalValue)}</span>
        )}
      </div>

      {/* Principal & Yield breakdown */}
      <div className="mb-6 grid grid-cols-2 gap-5">
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider text-[var(--float-text-muted)]">
            Principal
          </div>
          <div className="font-tabular text-xl font-semibold text-[var(--float-text)]">
            {loading ? <span className="skeleton inline-block h-5 w-20" style={{ borderRadius: '4px' }} /> : `$${fmt(principal)}`}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--float-text-muted)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-500" />
            Protected
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider text-[var(--float-text-muted)]">
            Yield earned
          </div>
          <div className={`font-tabular text-xl font-semibold text-emerald-500 ${yieldIncreased ? 'animate-number-bump' : ''}`}>
            {loading ? <span className="skeleton inline-block h-5 w-20" style={{ borderRadius: '4px' }} /> : `$${fmt(yieldBalance)}`}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--float-text-muted)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-yield-tick" />
            Wagerable
          </div>
        </div>
      </div>

      {/* APY indicator + Deposit button */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--float-emerald-dim)',
        }}
      >
        <div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-yield-tick" />
            <span className="font-tabular text-[13px] font-semibold text-emerald-500">~4.1% APY</span>
          </div>
          <div className="ml-[14px] text-[11px] text-[var(--float-text-muted)]">via MORE Markets</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onWithdraw}
            className="px-4 py-2 text-[13px] font-semibold text-[var(--float-text-secondary)] transition-opacity duration-150 hover:opacity-70 active:translate-y-px"
            style={{
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--float-border)',
            }}
          >
            Withdraw
          </button>
          <button
            onClick={onDeposit}
            className="px-4 py-2 text-[13px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 active:translate-y-px"
            style={{
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--float-emerald)',
            }}
          >
            Add Money
          </button>
        </div>
      </div>
    </div>
  )
}
