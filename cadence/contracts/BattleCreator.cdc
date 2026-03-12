import "FlowTransactionScheduler"
import "EVM"

/// Scheduled handler that creates tomorrow's battle via BattlePool.createBattle().
/// Rotates through templates and symbols automatically.
access(all) contract BattleCreator {

    access(all) var battlePoolAddress: EVM.EVMAddress

    access(all) resource Handler: FlowTransactionScheduler.TransactionHandler {
        access(FlowTransactionScheduler.Execute) fun executeTransaction(id: UInt64, data: AnyStruct?) {
            let coa = BattleCreator.account.storage
                .borrow<auth(EVM.Call) &EVM.CadenceOwnedAccount>(from: /storage/evm)
                ?? panic("No COA found")

            // data should contain encoded battle creation params
            // For now, the scheduling transaction pre-encodes the calldata
            if let calldata = data as? [UInt8] {
                let result = coa.call(
                    to: BattleCreator.battlePoolAddress,
                    data: calldata,
                    gasLimit: 500_000,
                    value: EVM.Balance(attoflow: UInt(0))
                )

                assert(result.status == EVM.Status.successful,
                    message: "createBattle failed: ".concat(result.errorMessage))

                log("BattleCreator executed (id: ".concat(id.toString()).concat(")"))
            } else {
                log("BattleCreator: no valid calldata provided")
            }
        }

        access(all) view fun getViews(): [Type] {
            return [Type<StoragePath>(), Type<PublicPath>()]
        }

        access(all) fun resolveView(_ view: Type): AnyStruct? {
            switch view {
                case Type<StoragePath>(): return /storage/BattleCreator
                case Type<PublicPath>(): return /public/BattleCreator
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
