import "FlowTransactionScheduler"
import "EVM"

/// Scheduled handler that resolves a battle by reading Band Oracle price
/// and calling BattlePool.resolve() via COA.
access(all) contract BattleResolver {

    access(all) var battlePoolAddress: EVM.EVMAddress

    access(all) resource Handler: FlowTransactionScheduler.TransactionHandler {
        access(FlowTransactionScheduler.Execute) fun executeTransaction(id: UInt64, data: AnyStruct?) {
            let coa = BattleResolver.account.storage
                .borrow<auth(EVM.Call) &EVM.CadenceOwnedAccount>(from: /storage/evm)
                ?? panic("No COA found")

            // data should contain: [battleId (UInt256), actualPrice (UInt256)]
            // The scheduler passes this through when scheduling
            if let params = data as? [UInt256] {
                let battleId = params[0]
                let actualPrice = params[1]

                let calldata = EVM.encodeABIWithSignature(
                    "resolve(uint256,uint256)",
                    [battleId, actualPrice]
                )

                let result = coa.call(
                    to: BattleResolver.battlePoolAddress,
                    data: calldata,
                    gasLimit: 500_000,
                    value: EVM.Balance(attoflow: UInt(0))
                )

                assert(result.status == EVM.Status.successful,
                    message: "resolve failed: ".concat(result.errorMessage))

                log("BattleResolver executed battle ".concat(battleId.toString()))
            } else {
                log("BattleResolver: no valid data provided")
            }
        }

        access(all) view fun getViews(): [Type] {
            return [Type<StoragePath>(), Type<PublicPath>()]
        }

        access(all) fun resolveView(_ view: Type): AnyStruct? {
            switch view {
                case Type<StoragePath>(): return /storage/BattleResolver
                case Type<PublicPath>(): return /public/BattleResolver
                default: return nil
            }
        }
    }

    access(all) fun createHandler(): @Handler {
        return <- create Handler()
    }

    access(all) fun setBattlePoolAddress(_ addr: String) {
        self.battlePoolAddress = EVM.addressFromString(addr)
    }

    init() {
        self.battlePoolAddress = EVM.addressFromString("0x0000000000000000000000000000000000000000")
    }
}
