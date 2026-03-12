import { useState } from 'react'
import * as fcl from '@onflow/fcl'

interface OnboardingProps {
  onAuthenticated: (flowAddress: string) => void
}

export function Onboarding({ onAuthenticated }: OnboardingProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    setLoading(true)
    setError(null)
    try {
      // fcl.authenticate opens Discovery wallet popup
      // User picks Blocto/Lilico, signs in, popup returns address
      await fcl.authenticate()
      const user = await fcl.currentUser.snapshot()
      if (!user?.addr) {
        setError('Connection closed. Click "Connect Wallet" and complete sign-in in the popup.')
        return
      }
      onAuthenticated(user.addr)
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('cancelled') || msg.includes('closed')) {
        setError('Popup closed. Allow popups for this site and try again.')
      } else {
        setError(msg || 'Connection failed. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center pt-16 animate-fade-in">
      {/* Logo mark */}
      <div className="mb-12 flex h-14 w-14 items-center justify-center">
        <img src="/logo.jpg" alt="" className="h-14 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
      </div>

      {/* Headline */}
      <h2 className="mb-4 max-w-xs text-center text-[2rem] font-bold leading-[1.1] tracking-tight">
        Your deposit earns.
        <br />
        <span className="text-[var(--float-text-muted)]">Your yield plays.</span>
      </h2>

      <p className="mb-10 max-w-[280px] text-center text-[15px] leading-relaxed text-[var(--float-text-secondary)]">
        Deposit stablecoins into a yield vault, then wager your earnings
        on daily prediction battles. Principal never at risk.
      </p>

      {/* Stats strip */}
      <div
        className="mb-10 flex w-full max-w-xs items-center justify-between border-y border-[var(--float-border-subtle)] py-5"
      >
        <StatItem label="Vault APY" value="4.1%" />
        <div className="h-8 w-px bg-[var(--float-border-subtle)]" />
        <StatItem label="Principal risk" value="$0" />
        <div className="h-8 w-px bg-[var(--float-border-subtle)]" />
        <StatItem label="Min deposit" value="$1" />
      </div>

      {/* CTA */}
      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-full max-w-xs py-4 text-[15px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 active:translate-y-px disabled:opacity-40"
        style={{
          borderRadius: 'var(--radius)',
          backgroundColor: 'var(--float-emerald)',
        }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spinner rounded-full border-2 border-white/30 border-t-white" />
            Connecting...
          </span>
        ) : (
          'Connect Wallet'
        )}
      </button>

      <p className="mt-4 text-[13px] text-[var(--float-text-muted)]">
        Connect with Flow Wallet to get started
      </p>

      {error && (
        <div
          className="mt-5 w-full max-w-xs px-4 py-3 text-[13px] text-red-400 animate-slide-up"
          style={{
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="font-tabular text-lg font-bold tracking-tight text-[var(--float-text)]">
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-[var(--float-text-muted)]">
        {label}
      </div>
    </div>
  )
}
