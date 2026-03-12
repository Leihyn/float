import "FlowTransactionScheduler"
import "FlowTransactionSchedulerUtils"
import "FlowToken"
import "FungibleToken"
import "YieldCompounder"

/// Schedule the YieldCompounder to run.
/// Creates manager, handler, and schedules the first execution.
transaction(vaultAddress: String, timestamp: UFix64) {
    prepare(signer: auth(SaveValue, BorrowValue, IssueStorageCapabilityController, PublishCapability) &Account) {
        // 1. Create and save Manager if not exists
        if signer.storage.borrow<&{FlowTransactionSchedulerUtils.Manager}>(
            from: FlowTransactionSchedulerUtils.managerStoragePath
        ) == nil {
            let manager <- FlowTransactionSchedulerUtils.createManager()
            signer.storage.save(<-manager, to: FlowTransactionSchedulerUtils.managerStoragePath)
        }

        // 2. Create and save handler if not exists
        if signer.storage.borrow<&YieldCompounder.Handler>(from: /storage/YieldCompounder) == nil {
            let handler <- YieldCompounder.createHandler()
            signer.storage.save(<-handler, to: /storage/YieldCompounder)
        }

        // 3. Issue auth capability for the scheduler
        let handlerCap = signer.capabilities.storage
            .issue<auth(FlowTransactionScheduler.Execute) &{FlowTransactionScheduler.TransactionHandler}>(
                /storage/YieldCompounder
            )

        // 4. Calculate fee and withdraw FLOW
        let fee = FlowTransactionScheduler.calculateFee(
            executionEffort: 2500,
            priority: FlowTransactionScheduler.Priority.Medium,
            dataSizeMB: 0.0
        )

        let flowVault = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
            from: /storage/flowTokenVault
        ) ?? panic("No FlowToken vault")

        let fees <- flowVault.withdraw(amount: fee) as! @FlowToken.Vault

        // 5. Schedule via Manager
        let manager = signer.storage.borrow<auth(FlowTransactionSchedulerUtils.Owner) &{FlowTransactionSchedulerUtils.Manager}>(
            from: FlowTransactionSchedulerUtils.managerStoragePath
        ) ?? panic("No Manager")

        let txId = manager.schedule(
            handlerCap: handlerCap,
            data: nil,
            timestamp: timestamp,
            priority: FlowTransactionScheduler.Priority.Medium,
            executionEffort: 2500,
            fees: <-fees
        )

        log("YieldCompounder scheduled (id: ".concat(txId.toString()).concat(") for vault: ").concat(vaultAddress))
    }
}
