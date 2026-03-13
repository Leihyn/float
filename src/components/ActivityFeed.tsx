import { useState, useEffect } from 'react'
import { publicClient } from '../config/viem'
import { CONTRACTS } from '../config/flow'
import { floatVaultAbi } from '../lib/abis'
import { formatUnits } from 'viem'

interface Activity {
  type: 'deposit' | 'withdraw' | 'battle_enter' | 'battle_win' | 'compound'
  text: string
  amount: string
  time: string
  blockNumber: bigint
}

// Event ABIs for getLogs
const depositEventAbi = [{
  type: 'event',
  name: 'Deposited',
  inputs: [
    { name: 'user', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
  ],
}] as const

const withdrawnEventAbi = [{
  type: 'event',
  name: 'Withdrawn',
  inputs: [
    { name: 'user', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
  ],
}] as const

const battleEnteredEventAbi = [{
  type: 'event',
  name: 'BattleEntered',
  inputs: [
    { name: 'battleId', type: 'uint256', indexed: true },
    { name: 'user', type: 'address', indexed: true },
    { name: 'side', type: 'uint8', indexed: false },
    { name: 'amount', type: 'uint256', indexed: false },
  ],
}] as const

const claimedEventAbi = [{
  type: 'event',
  name: 'Claimed',
  inputs: [
    { name: 'battleId', type: 'uint256', indexed: true },
    { name: 'user', type: 'address', indexed: true },
    { name: 'payout', type: 'uint256', indexed: false },
  ],
}] as const

const compoundedEventAbi = [{
  type: 'event',
  name: 'Compounded',
  inputs: [
    { name: 'totalAssets', type: 'uint256', indexed: false },
    { name: 'totalPrincipal', type: 'uint256', indexed: false },
  ],
}] as const

interface ActivityFeedProps {
  evmAddress?: string | null
}

function timeAgo(blockTimestamp: bigint): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - Number(blockTimestamp)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const typeIcons: Record<string, string> = {
  deposit: '+',
  withdraw: '-',
  battle_enter: '>',
  battle_win: '*',
  compound: '^',
}

const typeColors: Record<string, string> = {
  deposit: 'text-[var(--float-text)]',
  withdraw: 'text-red-400',
  battle_enter: 'text-amber-500',
  battle_win: 'text-emerald-500',
  compound: 'text-emerald-500',
}

export function ActivityFeed({ evmAddress }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!evmAddress) {
      setLoading(false)
      return
    }

    async function fetchEvents() {
      try {
        const addr = (evmAddress!.startsWith('0x') ? evmAddress! : `0x${evmAddress}`) as `0x${string}`
        const currentBlock = await publicClient.getBlockNumber()
        const fromBlock = currentBlock > 5000n ? currentBlock - 5000n : 0n

        const results: Activity[] = []

        const [deposits, withdrawals, battleEntries, claims, compounds] = await Promise.all([
          publicClient.getLogs({
            address: CONTRACTS.FLOAT_VAULT,
            event: depositEventAbi[0],
            args: { user: addr },
            fromBlock,
            toBlock: 'latest',
          }).catch(() => []),
          publicClient.getLogs({
            address: CONTRACTS.FLOAT_VAULT,
            event: withdrawnEventAbi[0],
            args: { user: addr },
            fromBlock,
            toBlock: 'latest',
          }).catch(() => []),
          publicClient.getLogs({
            address: CONTRACTS.BATTLE_POOL,
            event: battleEnteredEventAbi[0],
            args: { user: addr },
            fromBlock,
            toBlock: 'latest',
          }).catch(() => []),
          publicClient.getLogs({
            address: CONTRACTS.BATTLE_POOL,
            event: claimedEventAbi[0],
            args: { user: addr },
            fromBlock,
            toBlock: 'latest',
          }).catch(() => []),
          publicClient.getLogs({
            address: CONTRACTS.FLOAT_VAULT,
            event: compoundedEventAbi[0],
            fromBlock,
            toBlock: 'latest',
          }).catch(() => []),
        ])

        for (const log of deposits) {
          const amount = formatUnits(log.args.amount ?? 0n, 6)
          results.push({
            type: 'deposit',
            text: 'Deposited',
            amount: `$${parseFloat(amount).toFixed(2)}`,
            time: '',
            blockNumber: log.blockNumber,
          })
        }

        for (const log of withdrawals) {
          const amount = formatUnits(log.args.amount ?? 0n, 6)
          results.push({
            type: 'withdraw',
            text: 'Withdrawn',
            amount: `-$${parseFloat(amount).toFixed(2)}`,
            time: '',
            blockNumber: log.blockNumber,
          })
        }

        for (const log of battleEntries) {
          const amount = formatUnits(log.args.amount ?? 0n, 6)
          const side = log.args.side === 0 ? 'YES' : 'NO'
          results.push({
            type: 'battle_enter',
            text: `Entered battle (${side})`,
            amount: `$${parseFloat(amount).toFixed(2)}`,
            time: '',
            blockNumber: log.blockNumber,
          })
        }

        for (const log of claims) {
          const payout = formatUnits(log.args.payout ?? 0n, 6)
          results.push({
            type: 'battle_win',
            text: 'Battle payout',
            amount: `+$${parseFloat(payout).toFixed(2)}`,
            time: '',
            blockNumber: log.blockNumber,
          })
        }

        for (const log of compounds) {
          results.push({
            type: 'compound',
            text: 'Yield compounded',
            amount: '',
            time: '',
            blockNumber: log.blockNumber,
          })
        }

        results.sort((a, b) => Number(b.blockNumber - a.blockNumber))

        const uniqueBlocks = [...new Set(results.map(r => r.blockNumber))]
        const blockTimestamps = new Map<bigint, bigint>()

        await Promise.all(
          uniqueBlocks.slice(0, 10).map(async (blockNum) => {
            try {
              const block = await publicClient.getBlock({ blockNumber: blockNum })
              blockTimestamps.set(blockNum, block.timestamp)
            } catch {
              // ignore
            }
          })
        )

        for (const activity of results) {
          const ts = blockTimestamps.get(activity.blockNumber)
          activity.time = ts ? timeAgo(ts) : ''
        }

        setActivities(results.slice(0, 10))
      } catch {
        // Fallback to empty
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
    const interval = setInterval(fetchEvents, 30000)
    return () => clearInterval(interval)
  }, [evmAddress])

  return (
    <div className="p-6" style={{ borderRadius: 'var(--radius)', backgroundColor: 'var(--float-surface)' }}>
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--float-text-muted)]">
        Recent Activity
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="skeleton h-4 w-48" style={{ borderRadius: '4px' }} />
          <div className="skeleton h-4 w-36" style={{ borderRadius: '4px' }} />
          <div className="skeleton h-4 w-40" style={{ borderRadius: '4px' }} />
        </div>
      ) : activities.length === 0 ? (
        <div className="py-4 text-center text-[13px] text-[var(--float-text-muted)]">
          No activity yet. Deposit to begin earning.
        </div>
      ) : (
        <div className="flex flex-col gap-0">
          {activities.map((activity, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-[var(--float-border-subtle)] py-3 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 items-center justify-center text-[12px] font-bold ${typeColors[activity.type] || 'text-[var(--float-text-secondary)]'}`}
                  style={{ borderRadius: '8px', backgroundColor: 'var(--float-elevated)' }}
                >
                  {typeIcons[activity.type] || '?'}
                </span>
                <div>
                  <div className="text-[13px] text-[var(--float-text)]">{activity.text}</div>
                  {activity.time && (
                    <div className="text-[11px] text-[var(--float-text-muted)]">{activity.time}</div>
                  )}
                </div>
              </div>
              {activity.amount && (
                <div className={`font-tabular text-[13px] font-medium ${typeColors[activity.type] || 'text-[var(--float-text-secondary)]'}`}>
                  {activity.amount}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
