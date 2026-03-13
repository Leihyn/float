import { useState, useEffect } from 'react'
import { publicClient } from '../config/viem'
import { CONTRACTS } from '../config/flow'
import { battlePoolAbi } from '../lib/abis'
import { claimBattle, waitForTransaction } from '../lib/transactions'

interface PastBattlesProps {
  evmAddress: string | null
}

interface ResolvedBattle {
  id: number
  question: string
  status: number // 1 = RESOLVED, 2 = CANCELLED
  winningSide: number // 0 = YES, 1 = NO
  yesPool: bigint
  noPool: bigint
  isEventBattle: boolean
  // User's entry
  userSide: number
  userAmount: bigint
  userClaimed: boolean
}

export function PastBattles({ evmAddress }: PastBattlesProps) {
  const [battles, setBattles] = useState<ResolvedBattle[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<number | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)

  useEffect(() => {
    if (!evmAddress) {
      setLoading(false)
      return
    }

    async function fetchPastBattles() {
      try {
        const addr = (evmAddress!.startsWith('0x') ? evmAddress! : `0x${evmAddress}`) as `0x${string}`
        const nextId = await publicClient.readContract({
          address: CONTRACTS.BATTLE_POOL,
          abi: battlePoolAbi,
          functionName: 'nextBattleId',
        })
        const total = Number(nextId)
        if (total === 0) {
          setLoading(false)
          return
        }

        const results = await Promise.all(
          Array.from({ length: total }, (_, i) =>
            Promise.all([
              publicClient.readContract({
                address: CONTRACTS.BATTLE_POOL,
                abi: battlePoolAbi,
                functionName: 'getBattle',
                args: [BigInt(i)],
              }),
              publicClient.readContract({
                address: CONTRACTS.BATTLE_POOL,
                abi: battlePoolAbi,
                functionName: 'getEntry',
                args: [BigInt(i), addr],
              }),
            ]).then(([battle, entry]) => ({
              id: i,
              battle: battle as any,
              entry: entry as any,
            }))
          )
        )

        const resolved: ResolvedBattle[] = results
          .filter((r) => {
            const status = r.battle.status
            const hasEntry = r.entry.amount > 0n
            return (status === 1 || status === 2) && hasEntry
          })
          .map((r) => ({
            id: r.id,
            question: r.battle.question,
            status: r.battle.status,
            winningSide: r.battle.winningSide,
            yesPool: r.battle.yesPool,
            noPool: r.battle.noPool,
            isEventBattle: r.battle.isEventBattle,
            userSide: r.entry.side,
            userAmount: r.entry.amount,
            userClaimed: r.entry.claimed,
          }))

        setBattles(resolved)
      } catch {
        // contracts not deployed or no battles
      } finally {
        setLoading(false)
      }
    }

    fetchPastBattles()
    const interval = setInterval(fetchPastBattles, 30000)
    return () => clearInterval(interval)
  }, [evmAddress])

  const handleClaim = async (battleId: number) => {
    setClaiming(battleId)
    setClaimError(null)
    try {
      const txId = await claimBattle(battleId.toString())
      await waitForTransaction(txId)
      // Mark as claimed locally
      setBattles((prev) =>
        prev.map((b) => (b.id === battleId ? { ...b, userClaimed: true } : b))
      )
    } catch (err: any) {
      setClaimError(err?.message || 'Claim failed')
    } finally {
      setClaiming(null)
    }
  }

  if (loading) return null
  if (!evmAddress) return null

  return (
    <div
      className="p-6"
      style={{ borderRadius: 'var(--radius)', backgroundColor: 'var(--float-surface)' }}
    >
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--float-text-muted)]">
        Past Battles
      </div>

      {battles.length === 0 ? (
        <div className="py-4 text-center text-[13px] text-[var(--float-text-muted)]">
          No resolved battles yet. Enter a battle and wait for it to resolve.
        </div>
      ) : (
      <div className="flex flex-col gap-3">
        {battles.map((b) => {
          const isCancelled = b.status === 2
          const userWon = !isCancelled && b.userSide === b.winningSide
          const sideLabel = b.userSide === 0 ? 'YES' : 'NO'
          const winnerLabel = b.winningSide === 0 ? 'YES' : 'NO'
          const amountUsd = (Number(b.userAmount) / 1e6).toFixed(2)

          return (
            <div
              key={b.id}
              className="flex items-center justify-between gap-4 border-b border-[var(--float-border-subtle)] pb-3 last:border-0 last:pb-0"
            >
              <div className="flex-1 min-w-0">
                <div className="truncate text-[14px] font-semibold text-[var(--float-text)]">
                  {b.question}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[12px]">
                  <span className="text-[var(--float-text-muted)]">
                    You picked{' '}
                    <span
                      className={
                        b.userSide === 0 ? 'text-emerald-400' : 'text-red-400'
                      }
                    >
                      {sideLabel}
                    </span>
                    {' · '}${amountUsd}
                  </span>
                  <span className="text-[var(--float-text-muted)]">·</span>
                  {isCancelled ? (
                    <span className="text-amber-400">Cancelled</span>
                  ) : (
                    <span className={userWon ? 'text-emerald-400' : 'text-red-400'}>
                      {winnerLabel} won {userWon ? '- You won!' : '- Lost'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0">
                {b.userClaimed ? (
                  <span className="text-[12px] text-[var(--float-text-muted)]">Claimed</span>
                ) : userWon || isCancelled ? (
                  <button
                    onClick={() => handleClaim(b.id)}
                    disabled={claiming === b.id}
                    className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: 'var(--float-emerald)' }}
                  >
                    {claiming === b.id ? (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 animate-spinner rounded-full border-2 border-white/30 border-t-white" />
                        Claiming
                      </span>
                    ) : (
                      'Claim'
                    )}
                  </button>
                ) : (
                  <span className="text-[12px] text-red-400/60">No payout</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      )}

      {claimError && (
        <div
          className="mt-3 px-4 py-2.5 text-[13px] text-red-400"
          style={{
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
          }}
        >
          {claimError}
        </div>
      )}
    </div>
  )
}
