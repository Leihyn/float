import { useState } from 'react'
import { BalanceCard } from './BalanceCard'
import { BattleCard } from './BattleCard'
import { PastBattles } from './PastBattles'
import { ActivityFeed } from './ActivityFeed'
import { DepositModal } from './DepositModal'
import { WithdrawModal } from './WithdrawModal'

interface HomeProps {
  user: { addr: string | null; loggedIn: boolean }
  evmAddress: string | null
}

export function Home({ evmAddress }: HomeProps) {
  const [showDeposit, setShowDeposit] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <BalanceCard
        evmAddress={evmAddress}
        onDeposit={() => setShowDeposit(true)}
        onWithdraw={() => setShowWithdraw(true)}
      />

      <BattleCard evmAddress={evmAddress} />

      <PastBattles evmAddress={evmAddress} />

      <ActivityFeed evmAddress={evmAddress} />

      {showDeposit && (
        <DepositModal onClose={() => setShowDeposit(false)} />
      )}

      {showWithdraw && (
        <WithdrawModal evmAddress={evmAddress} onClose={() => setShowWithdraw(false)} />
      )}
    </div>
  )
}
