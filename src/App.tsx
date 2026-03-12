import { useState, useEffect } from 'react'
import * as fcl from '@onflow/fcl'
import './config/flow' // ensure FCL is initialized
import { getEvmAddress, disconnectWallet } from './lib/transactions'
import { getStoredPasskey } from './lib/passkey'
import { Home } from './components/Home'
import { Onboarding } from './components/Onboarding'
import { AccountSetup } from './components/AccountSetup'

interface AuthState {
  flowAddress: string | null
  evmAddress: string | null
  loggedIn: boolean
}

function App() {
  const [auth, setAuth] = useState<AuthState>({
    flowAddress: null,
    evmAddress: null,
    loggedIn: false,
  })
  const [needsSetup, setNeedsSetup] = useState(false)
  const [loading, setLoading] = useState(true)

  // Restore session on mount: check passkey first, then FCL wallet
  useEffect(() => {
    async function restore() {
      // 1. Check for stored passkey session
      const passkey = getStoredPasskey()
      if (passkey) {
        const evmAddr = await getEvmAddress(passkey.flowAddress)
        setAuth({
          flowAddress: passkey.flowAddress,
          evmAddress: evmAddr,
          loggedIn: true,
        })
        if (!evmAddr) setNeedsSetup(true)
        setLoading(false)
        return
      }

      // 2. Fall back to FCL wallet session (Blocto persists sessions)
      const user = await fcl.currentUser.snapshot()
      if (user?.addr) {
        const evmAddr = await getEvmAddress(user.addr)
        setAuth({
          flowAddress: user.addr,
          evmAddress: evmAddr,
          loggedIn: true,
        })
        if (!evmAddr) setNeedsSetup(true)
      }
      setLoading(false)
    }
    restore()
  }, [])

  const handleAuthenticated = async (flowAddress: string) => {
    setAuth({ flowAddress, evmAddress: null, loggedIn: true })

    const addr = await getEvmAddress(flowAddress)
    if (addr) {
      setAuth((prev) => ({ ...prev, evmAddress: addr }))
    } else {
      setNeedsSetup(true)
    }
  }

  const handleSetupComplete = (evmAddr: string) => {
    setAuth((prev) => ({ ...prev, evmAddress: evmAddr }))
    setNeedsSetup(false)
  }

  const handleSignOut = () => {
    disconnectWallet()
    setAuth({ flowAddress: null, evmAddress: null, loggedIn: false })
    setNeedsSetup(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--float-bg)] text-[var(--float-text)]">
        <div className="h-5 w-5 animate-spinner rounded-full border-2 border-emerald-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--float-bg)] text-[var(--float-text)]">
      <header className="border-b border-[var(--float-border-subtle)] px-6 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.jpg" alt="" className="h-6 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <span className="text-lg font-bold tracking-tight text-white">Float</span>
          </div>
          {auth.loggedIn && (
            <button
              onClick={handleSignOut}
              className="text-sm text-[var(--float-text-muted)] transition-opacity duration-150 hover:opacity-70"
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-lg px-6 py-8">
        {!auth.loggedIn ? (
          <Onboarding onAuthenticated={handleAuthenticated} />
        ) : needsSetup ? (
          <AccountSetup
            flowAddress={auth.flowAddress!}
            onComplete={handleSetupComplete}
          />
        ) : (
          <Home
            user={{ addr: auth.flowAddress, loggedIn: true }}
            evmAddress={auth.evmAddress}
          />
        )}
      </main>
    </div>
  )
}

export default App
