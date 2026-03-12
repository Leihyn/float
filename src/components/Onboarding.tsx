import { useState } from 'react'
import * as fcl from '@onflow/fcl'
import { createPasskeyAccount } from '../lib/passkey'

interface OnboardingProps {
  onAuthenticated: (flowAddress: string) => void
}

export function Onboarding({ onAuthenticated }: OnboardingProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'idle' | 'passkey' | 'wallet'>('idle')

  const handlePasskey = async () => {
    setLoading(true)
    setMode('passkey')
    setError(null)
    try {
      const result = await createPasskeyAccount()
      onAuthenticated(result.flowAddress)
    } catch (err: any) {
      const msg = err?.message || 'Passkey creation failed'
      if (msg.includes('cancelled') || msg.includes('NotAllowed')) {
        setError('Passkey cancelled. Try again or use Flow Wallet.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
      setMode('idle')
    }
  }

  const handleWallet = async () => {
    setLoading(true)
    setMode('wallet')
    setError(null)
    try {
      await fcl.authenticate()
      const user = await fcl.currentUser.snapshot()
      if (!user?.addr) {
        setError('Connection closed. Try again.')
        return
      }
      onAuthenticated(user.addr)
    } catch (err: any) {
      setError(err?.message || 'Connection failed.')
    } finally {
      setLoading(false)
      setMode('idle')
    }
  }

  return (
    <div className="flex flex-col items-center pt-16 animate-fade-in">
      {/* Logo */}
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
      <div className="mb-10 flex w-full max-w-xs items-center justify-between border-y border-[var(--float-border-subtle)] py-5">
        <StatItem label="Vault APY" value="4.1%" />
        <div className="h-8 w-px bg-[var(--float-border-subtle)]" />
        <StatItem label="Principal risk" value="$0" />
        <div className="h-8 w-px bg-[var(--float-border-subtle)]" />
        <StatItem label="Min deposit" value="$1" />
      </div>

      {/* Primary CTA: Passkey */}
      <button
        onClick={handlePasskey}
        disabled={loading}
        className="w-full max-w-xs py-4 text-[15px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 active:translate-y-px disabled:opacity-40"
        style={{
          borderRadius: 'var(--radius)',
          backgroundColor: 'var(--float-emerald)',
        }}
      >
        {loading && mode === 'passkey' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spinner rounded-full border-2 border-white/30 border-t-white" />
            Creating account...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 10v4M7 15.5a5 5 0 0 1 10 0" />
              <rect x="5" y="15" width="14" height="7" rx="2" />
              <circle cx="12" cy="8" r="3" />
            </svg>
            Get Started with Passkey
          </span>
        )}
      </button>

      <p className="mt-3 text-[12px] text-[var(--float-text-muted)]">
        Face ID or fingerprint. No wallet needed.
      </p>

      {/* Divider */}
      <div className="my-6 flex w-full max-w-xs items-center gap-3">
        <div className="h-px flex-1 bg-[var(--float-border-subtle)]" />
        <span className="text-[11px] text-[var(--float-text-muted)]">or</span>
        <div className="h-px flex-1 bg-[var(--float-border-subtle)]" />
      </div>

      {/* Secondary CTA: Wallet */}
      <button
        onClick={handleWallet}
        disabled={loading}
        className="w-full max-w-xs py-3.5 text-[14px] font-semibold text-[var(--float-text-secondary)] transition-opacity duration-150 hover:opacity-70 active:translate-y-px disabled:opacity-40"
        style={{
          borderRadius: 'var(--radius)',
          border: '1px solid var(--float-border)',
        }}
      >
        {loading && mode === 'wallet' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spinner rounded-full border-2 border-white/30 border-t-white" />
            Connecting...
          </span>
        ) : (
          'Connect Flow Wallet'
        )}
      </button>

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
