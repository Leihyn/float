import { useState, useEffect } from 'react'
import { publicClient } from '../config/viem'
import { CONTRACTS } from '../config/flow'
import { battlePoolAbi, floatVaultAbi } from '../lib/abis'
import { enterBattle, waitForTransaction } from '../lib/transactions'

interface BattleCardProps {
  evmAddress: string | null
}

interface Battle {
  question: string
  battleType: number
  status: number
  resolveTimestamp: bigint
  yesPool: bigint
  noPool: bigint
  winningSide: number
  isEventBattle: boolean
}

function useCountdown(timestamp: bigint) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    function update() {
      const now = Math.floor(Date.now() / 1000)
      const diff = Number(timestamp) - now
      if (diff <= 0) {
        setTimeLeft('Resolving...')
        return
      }
      const h = Math.floor(diff / 3600)
      const m = Math.floor((diff % 3600) / 60)
      const s = diff % 60
      setTimeLeft(`${h}h ${m}m ${s}s`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [timestamp])

  return timeLeft
}

interface OpenBattle extends Battle {
  id: number
}

export function BattleCard({ evmAddress }: BattleCardProps) {
  const [openBattles, setOpenBattles] = useState<OpenBattle[]>([])
  const [viewIndex, setViewIndex] = useState(0)
  const [selectedSide, setSelectedSide] = useState<'yes' | 'no' | null>(null)
  const [wagerAmount, setWagerAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [entering, setEntering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [availableYield, setAvailableYield] = useState<string | null>(null)

  // Fetch available yield
  useEffect(() => {
    if (!evmAddress) return
    async function fetchYield() {
      try {
        const addr = (evmAddress!.startsWith('0x') ? evmAddress! : `0x${evmAddress}`) as `0x${string}`
        const raw = await publicClient.readContract({
          address: CONTRACTS.FLOAT_VAULT,
          abi: floatVaultAbi,
          functionName: 'yieldOf',
          args: [addr],
        })
        setAvailableYield((Number(raw) / 1e6).toFixed(2))
      } catch {
        setAvailableYield(null)
      }
    }
    fetchYield()
    const interval = setInterval(fetchYield, 15000)
    return () => clearInterval(interval)
  }, [evmAddress])

  useEffect(() => {
    async function fetchBattles() {
      try {
        const nextId = await publicClient.readContract({
          address: CONTRACTS.BATTLE_POOL,
          abi: battlePoolAbi,
          functionName: 'nextBattleId',
        })
        const total = Number(nextId)
        const results = await Promise.all(
          Array.from({ length: total }, (_, i) =>
            publicClient.readContract({
              address: CONTRACTS.BATTLE_POOL,
              abi: battlePoolAbi,
              functionName: 'getBattle',
              args: [BigInt(i)],
            }).then((data) => ({ id: i, data: data as unknown as Battle }))
          )
        )
        const battles: OpenBattle[] = results
          .filter((r) => r.data.status === 0)
          .map((r) => ({ ...r.data, id: r.id }))
        setOpenBattles(battles)
        // Reset index if out of bounds
        setViewIndex((prev) => (prev >= battles.length ? 0 : prev))
      } catch {
        // Contracts not deployed yet
      } finally {
        setLoading(false)
      }
    }

    fetchBattles()
    const interval = setInterval(fetchBattles, 30000)
    return () => clearInterval(interval)
  }, [evmAddress])

  const battle = openBattles[viewIndex] ?? null
  const battleId = battle ? BigInt(battle.id) : 0n
  const countdown = useCountdown(battle?.resolveTimestamp ?? 0n)

  const handlePrev = () => {
    setViewIndex((prev) => (prev > 0 ? prev - 1 : openBattles.length - 1))
    setSelectedSide(null)
    setWagerAmount('')
    setError(null)
  }

  const handleNext = () => {
    setViewIndex((prev) => (prev < openBattles.length - 1 ? prev + 1 : 0))
    setSelectedSide(null)
    setWagerAmount('')
    setError(null)
  }

  if (loading) {
    return (
      <div className="p-6" style={{ borderRadius: 'var(--radius)', backgroundColor: 'var(--float-surface)' }}>
        <div className="skeleton mb-3 h-3 w-24" style={{ borderRadius: '4px' }} />
        <div className="skeleton mb-5 h-5 w-56" style={{ borderRadius: '4px' }} />
        <div className="flex gap-3">
          <div className="skeleton h-[72px] flex-1" style={{ borderRadius: 'var(--radius-sm)' }} />
          <div className="skeleton h-[72px] flex-1" style={{ borderRadius: 'var(--radius-sm)' }} />
        </div>
      </div>
    )
  }

  if (!battle || openBattles.length === 0) {
    return (
      <div
        className="p-6 text-center"
        style={{ borderRadius: 'var(--radius)', backgroundColor: 'var(--float-surface)' }}
      >
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--float-text-muted)]">
          Daily Battle
        </div>
        <div className="mb-1 text-[15px] text-[var(--float-text-secondary)]">No active battle right now</div>
        <div className="text-[13px] text-[var(--float-text-muted)]">Next battle drops at midnight UTC</div>
      </div>
    )
  }

  const totalPool = battle.yesPool + battle.noPool
  const yesPct = totalPool > 0n ? Number((battle.yesPool * 100n) / totalPool) : 50
  const noPct = totalPool > 0n ? 100 - yesPct : 50
  const poolUsd = totalPool > 0n ? (Number(totalPool) / 1e6).toFixed(2) : '0.00'

  const handleEnter = async () => {
    if (!selectedSide || !wagerAmount || parseFloat(wagerAmount) <= 0) return
    setEntering(true)
    setError(null)

    try {
      const txId = await enterBattle(battleId.toString(), selectedSide, wagerAmount)
      await waitForTransaction(txId)
      setSuccess(true)
      setWagerAmount('')
      // Delay clearing the side so the success message stays visible
      setTimeout(() => {
        setSuccess(false)
        setSelectedSide(null)
      }, 4000)
    } catch (err: any) {
      setError(err?.message || 'Failed to enter battle.')
    } finally {
      setEntering(false)
    }
  }

  return (
    <div className="p-6" style={{ borderRadius: 'var(--radius)', backgroundColor: 'var(--float-surface)' }}>
      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {openBattles.length > 1 && (
            <button
              onClick={handlePrev}
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--float-text-muted)] transition-colors hover:bg-[var(--float-elevated)] hover:text-[var(--float-text)]"
            >
              &lsaquo;
            </button>
          )}
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--float-text-muted)]">
            Daily Battle
            {openBattles.length > 1 && (
              <span className="ml-1.5 normal-case tracking-normal opacity-60">
                {viewIndex + 1} of {openBattles.length}
              </span>
            )}
          </div>
          {openBattles.length > 1 && (
            <button
              onClick={handleNext}
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--float-text-muted)] transition-colors hover:bg-[var(--float-elevated)] hover:text-[var(--float-text)]"
            >
              &rsaquo;
            </button>
          )}
        </div>
        <div className="font-tabular flex items-center gap-1.5 text-[12px] text-amber-500">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-yield-tick" />
          {countdown}
        </div>
      </div>

      {/* Question */}
      <h3 className="mb-5 text-[17px] font-bold leading-snug tracking-tight">{battle.question}</h3>

      {/* YES / NO buttons */}
      <div className="mb-4 flex gap-3">
        <button
          onClick={() => { setSelectedSide('yes'); setError(null) }}
          className={`flex-1 px-4 py-3 text-center font-semibold transition-colors duration-150 ${
            selectedSide === 'yes'
              ? 'border-2 border-emerald-500 bg-emerald-500/15 text-emerald-500'
              : 'border border-[var(--float-border)] text-[var(--float-text-secondary)] hover:border-[var(--float-text-muted)]'
          }`}
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          <div className="text-[17px] font-bold">YES</div>
          <div className="font-tabular mt-0.5 text-[13px] opacity-60">{yesPct}%</div>
        </button>
        <button
          onClick={() => { setSelectedSide('no'); setError(null) }}
          className={`flex-1 px-4 py-3 text-center font-semibold transition-colors duration-150 ${
            selectedSide === 'no'
              ? 'border-2 border-red-500 bg-red-500/15 text-red-400'
              : 'border border-[var(--float-border)] text-[var(--float-text-secondary)] hover:border-[var(--float-text-muted)]'
          }`}
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          <div className="text-[17px] font-bold">NO</div>
          <div className="font-tabular mt-0.5 text-[13px] opacity-60">{noPct}%</div>
        </button>
      </div>

      {/* Pool split bar */}
      <div className="mb-4">
        <div className="font-tabular mb-1.5 flex justify-between text-[11px] text-[var(--float-text-muted)]">
          <span>Pool ${poolUsd}</span>
          <span>{battle.isEventBattle ? 'Event' : 'Crypto'}</span>
        </div>
        <div className="flex h-1 gap-px overflow-hidden" style={{ borderRadius: '2px' }}>
          <div
            className="bg-emerald-500 transition-[width] duration-300"
            style={{ width: `${yesPct}%` }}
          />
          <div
            className="bg-red-500/60 transition-[width] duration-300"
            style={{ width: `${noPct}%` }}
          />
        </div>
      </div>

      {/* Wager input */}
      {selectedSide && (
        <div className="animate-slide-up mt-5 flex flex-col gap-3 border-t border-[var(--float-border-subtle)] pt-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[13px] text-[var(--float-text-muted)]">Wager from your yield</label>
              {availableYield && (
                <button
                  onClick={() => setWagerAmount(availableYield)}
                  className="text-[12px] font-medium text-emerald-400 transition-opacity hover:opacity-70"
                >
                  Max: ${availableYield}
                </button>
              )}
            </div>
            <div
              className="flex items-center gap-2 border border-[var(--float-border)] px-4 py-3"
              style={{ borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--float-elevated)' }}
            >
              <span className="text-[var(--float-text-muted)]">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={wagerAmount}
                onChange={(e) => setWagerAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="font-tabular w-full bg-transparent text-[17px] font-semibold text-white outline-none placeholder:text-[var(--float-text-muted)]"
              />
            </div>
          </div>

          {error && (
            <div
              className="px-4 py-2.5 text-[13px] text-red-400"
              style={{ borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(239, 68, 68, 0.08)' }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              className="animate-slide-up px-5 py-4 text-center"
              style={{ borderRadius: 'var(--radius)', backgroundColor: 'var(--float-emerald-dim)', border: '1px solid var(--float-emerald)' }}
            >
              <div className="text-[17px] font-bold text-emerald-400">You're in!</div>
              <div className="mt-1 text-[13px] text-emerald-400/70">Wager placed. Good luck.</div>
            </div>
          )}

          {!success && <button
            onClick={handleEnter}
            disabled={!wagerAmount || parseFloat(wagerAmount) <= 0 || entering}
            className="w-full py-3.5 font-semibold text-white transition-opacity duration-150 hover:opacity-90 active:translate-y-px disabled:opacity-40"
            style={{
              borderRadius: 'var(--radius)',
              backgroundColor: selectedSide === 'yes' ? 'var(--float-emerald)' : '#ef4444',
            }}
          >
            {entering ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spinner rounded-full border-2 border-white/30 border-t-white" />
                Entering...
              </span>
            ) : (
              `Wager $${wagerAmount || '0'} on ${selectedSide.toUpperCase()}`
            )}
          </button>}

          <p className="text-center text-[11px] text-[var(--float-text-muted)]">
            Only yield at risk. Your deposit is always safe.
          </p>
        </div>
      )}
    </div>
  )
}
