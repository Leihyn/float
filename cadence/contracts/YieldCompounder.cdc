import "FlowTransactionScheduler"
import "EVM"

/// Scheduled handler that calls FloatVault.compoundYield() via COA.
/// Fires daily to trigger any yield-related maintenance.
access(all) contract YieldCompounder {

    access(all) var vaultAddress: EVM.EVMAddress

    access(all) resource Handler: FlowTransactionScheduler.TransactionHandler {
        access(FlowTransactionScheduler.Execute) fun executeTransaction(id: UInt64, data: AnyStruct?) {
            let coa = YieldCompounder.account.storage
                .borrow<auth(EVM.Call) &EVM.CadenceOwnedAccount>(from: /storage/evm)
                ?? panic("No COA found")

            let calldata = EVM.encodeABIWithSignature("compoundYield()", [])

            let result = coa.call(
                to: YieldCompounder.vaultAddress,
                data: calldata,
                gasLimit: 200_000,
                value: EVM.Balance(attoflow: UInt(0))
            )

            assert(result.status == EVM.Status.successful,
                message: "compoundYield failed: ".concat(result.errorMessage))

            log("YieldCompounder executed (id: ".concat(id.toString()).concat(")"))
        }

        access(all) view fun getViews(): [Type] {
            return [Type<StoragePath>(), Type<PublicPath>()]
        }

        access(all) fun resolveView(_ view: Type): AnyStruct? {
            switch view {
                case Type<StoragePath>(): return /storage/YieldCompounder
                case Type<PublicPath>(): return /public/YieldCompounder
                default: return nil
            }
        }
    }

    access(all) fun createHandler(): @Handler {
        return <- create Handler()
    }

    access(all) fun setVaultAddress(_ addr: String) {
        self.vaultAddress = EVM.addressFromString(addr)
    }

    init() {
        self.vaultAddress = EVM.addressFromString("0x0000000000000000000000000000000000000000")
    }
}
