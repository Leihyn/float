import { useState, useEffect } from 'react'
import { withdrawPrincipal, waitForTransaction } from '../lib/transactions'
import { publicClient } from '../config/viem'
import { CONTRACTS } from '../config/flow'
import { floatVaultAbi } from '../lib/abis'

interface WithdrawModalProps {
  evmAddress: string | null
  onClose: () => void
}

export function WithdrawModal({ evmAddress, onClose }: WithdrawModalProps) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [principal, setPrincipal] = useState('0.00')

  useEffect(() => {
    if (!evmAddress) return
    async function fetch() {
      try {
        const addr = (evmAddress!.startsWith('0x') ? evmAddress! : `0x${evmAddress}`) as `0x${string}`
        const raw = await publicClient.readContract({
          address: CONTRACTS.FLOAT_VAULT,
          abi: floatVaultAbi,
          functionName: 'principalOf',
          args: [addr],
        })
        setPrincipal((Number(raw) / 1e6).toFixed(2))
      } catch {}
    }
    fetch()
  }, [evmAddress])

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    setLoading(true)
    setError(null)

    try {
      const txId = await withdrawPrincipal(amount)
      await waitForTransaction(txId)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Withdraw failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center animate-fade-in">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div
        className="animate-slide-up relative z-10 w-full max-w-lg p-6 sm:rounded-[var(--radius)]"
        style={{
          backgroundColor: 'var(--float-surface)',
          borderTopLeftRadius: 'var(--radius)',
          borderTopRightRadius: 'var(--radius)',
        }}
      >
        <div className="mb-8 flex items-center justify-between">
          <h3 className="text-lg font-bold">Withdraw</h3>
          <button
            onClick={onClose}
            className="text-[var(--float-text-muted)] transition-opacity duration-150 hover:opacity-70"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[13px] text-[var(--float-text-muted)]">Amount (USDC)</label>
            <button
              onClick={() => setAmount(principal)}
              className="text-[12px] font-medium text-emerald-400 transition-opacity hover:opacity-70"
            >
              Max: ${principal}
            </button>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl text-[var(--float-text-muted)]">$</span>
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
              autoFocus
              className="font-tabular w-full bg-transparent text-[2.5rem] font-bold leading-none text-white outline-none placeholder:text-zinc-700"
            />
          </div>
        </div>

        <div
          className="mb-6 px-4 py-3"
          style={{
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(239, 68, 68, 0.06)',
          }}
        >
          <div className="text-[13px] font-medium text-[var(--float-text-secondary)]">Withdraws from your principal</div>
          <div className="mt-0.5 text-[12px] text-[var(--float-text-muted)]">
            Yield locked in active battles cannot be withdrawn.
          </div>
        </div>

        {error && (
          <div
            className="mb-4 px-4 py-2.5 text-[13px] text-red-400"
            style={{ borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(239, 68, 68, 0.08)' }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleWithdraw}
          disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > parseFloat(principal) || loading}
          className="w-full py-4 text-[15px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 active:translate-y-px disabled:opacity-40"
          style={{
            borderRadius: 'var(--radius)',
            backgroundColor: '#ef4444',
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block h-4 w-4 animate-spinner rounded-full border-2 border-white/30 border-t-white" />
              Withdrawing...
            </span>
          ) : (
            'Confirm Withdraw'
          )}
        </button>
      </div>
    </div>
  )
}
