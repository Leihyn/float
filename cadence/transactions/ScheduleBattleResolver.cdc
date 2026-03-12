import "FlowTransactionScheduler"
import "FlowTransactionSchedulerUtils"
import "FlowToken"
import "FungibleToken"
import "BattleResolver"

/// Schedule the BattleResolver to run at a specific timestamp.
/// Pass battleId and actualPrice as data for resolution.
transaction(battlePoolAddress: String, timestamp: UFix64, battleId: UInt256, actualPrice: UInt256) {
    prepare(signer: auth(SaveValue, BorrowValue, IssueStorageCapabilityController, PublishCapability) &Account) {
        // 1. Create and save Manager if not exists
        if signer.storage.borrow<&{FlowTransactionSchedulerUtils.Manager}>(
            from: FlowTransactionSchedulerUtils.managerStoragePath
        ) == nil {
            let manager <- FlowTransactionSchedulerUtils.createManager()
            signer.storage.save(<-manager, to: FlowTransactionSchedulerUtils.managerStoragePath)
        }

        // 2. Create and save handler if not exists
        if signer.storage.borrow<&BattleResolver.Handler>(from: /storage/BattleResolver) == nil {
            let handler <- BattleResolver.createHandler()
            signer.storage.save(<-handler, to: /storage/BattleResolver)
        }

        // 3. Issue auth capability
        let handlerCap = signer.capabilities.storage
            .issue<auth(FlowTransactionScheduler.Execute) &{FlowTransactionScheduler.TransactionHandler}>(
                /storage/BattleResolver
            )

        // 4. Calculate fee and withdraw FLOW
        let fee = FlowTransactionScheduler.calculateFee(
            executionEffort: 2500,
            priority: FlowTransactionScheduler.Priority.Medium,
            dataSizeMB: 0.001
        )

        let flowVault = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
            from: /storage/flowTokenVault
        ) ?? panic("No FlowToken vault")

        let fees <- flowVault.withdraw(amount: fee) as! @FlowToken.Vault

        // 5. Schedule with battle data
        let manager = signer.storage.borrow<auth(FlowTransactionSchedulerUtils.Owner) &{FlowTransactionSchedulerUtils.Manager}>(
            from: FlowTransactionSchedulerUtils.managerStoragePath
        ) ?? panic("No Manager")

        let data: [UInt256] = [battleId, actualPrice]

        let txId = manager.schedule(
            handlerCap: handlerCap,
            data: data,
            timestamp: timestamp,
            priority: FlowTransactionScheduler.Priority.Medium,
            executionEffort: 2500,
            fees: <-fees
        )

        log("BattleResolver scheduled (id: ".concat(txId.toString()).concat(") for pool: ").concat(battlePoolAddress))
    }
}
