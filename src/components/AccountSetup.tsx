import { useState, useEffect } from 'react'
import { setupAccount, getEvmAddress, waitForTransaction, fundAccountWithFlow } from '../lib/transactions'

interface AccountSetupProps {
  flowAddress: string
  onComplete: (evmAddress: string) => void
}

type SetupStep = 'checking' | 'funding' | 'creating' | 'ready' | 'error'

export function AccountSetup({ flowAddress, onComplete }: AccountSetupProps) {
  const [step, setStep] = useState<SetupStep>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        // 1. Check if COA already exists
        setStep('checking')
        const existing = await getEvmAddress(flowAddress)
        if (cancelled) return

        if (existing) {
          setStep('ready')
          setTimeout(() => { if (!cancelled) onComplete(existing) }, 300)
          return
        }

        // 2. Fund account with FLOW from faucet (testnet)
        setStep('funding')
        await fundAccountWithFlow(flowAddress)
        if (cancelled) return

        // 3. Create COA + mint test USDC
        setStep('creating')
        const txId = await setupAccount()
        await waitForTransaction(txId)
        if (cancelled) return

        // 4. Read the new EVM address
        const evmAddr = await getEvmAddress(flowAddress)
        if (cancelled) return

        if (evmAddr) {
          setStep('ready')
          setTimeout(() => { if (!cancelled) onComplete(evmAddr) }, 300)
        } else {
          throw new Error('COA created but EVM address not found')
        }
      } catch (err: any) {
        if (cancelled) return
        setStep('error')
        setError(err?.message || 'Setup failed')
      }
    }

    run()
    return () => { cancelled = true }
  }, [flowAddress])

  return (
    <div className="flex flex-col items-center justify-center pt-24 text-center animate-fade-in">
      <div
        className="mb-8 flex h-16 w-16 items-center justify-center"
        style={{ borderRadius: 'var(--radius)' }}
      >
        {step === 'error' ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : step === 'ready' ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <div className="h-7 w-7 animate-spinner rounded-full border-2 border-emerald-500 border-t-transparent" />
        )}
      </div>

      <h2 className="mb-2 text-xl font-bold tracking-tight">
        {step === 'checking' && 'Checking account'}
        {step === 'funding' && 'Funding account'}
        {step === 'creating' && 'Creating vault'}
        {step === 'ready' && 'Ready'}
        {step === 'error' && 'Setup failed'}
      </h2>

      {step === 'checking' && (
        <p className="text-[13px] text-[var(--float-text-muted)]">Looking up your vault on Flow</p>
      )}
      {step === 'funding' && (
        <p className="text-[13px] text-[var(--float-text-muted)]">Getting testnet FLOW from faucet</p>
      )}
      {step === 'creating' && (
        <p className="text-[13px] text-[var(--float-text-muted)]">Creating your EVM vault and minting test USDC</p>
      )}

      {step === 'error' && (
        <div className="mt-6">
          <p className="mb-5 text-[13px] text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 text-[13px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
            style={{ borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--float-elevated)' }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
