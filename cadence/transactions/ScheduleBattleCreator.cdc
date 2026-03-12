import "FlowTransactionScheduler"
import "FlowTransactionSchedulerUtils"
import "FlowToken"
import "FungibleToken"
import "BattleCreator"
import "EVM"

/// Schedule the BattleCreator to create a new battle at a given time.
/// The calldata is pre-encoded ABI for BattlePool.createBattle().
transaction(battlePoolAddress: String, timestamp: UFix64, calldataHex: String) {
    prepare(signer: auth(SaveValue, BorrowValue, IssueStorageCapabilityController, PublishCapability) &Account) {
        // 1. Create and save Manager if not exists
        if signer.storage.borrow<&{FlowTransactionSchedulerUtils.Manager}>(
            from: FlowTransactionSchedulerUtils.managerStoragePath
        ) == nil {
            let manager <- FlowTransactionSchedulerUtils.createManager()
            signer.storage.save(<-manager, to: FlowTransactionSchedulerUtils.managerStoragePath)
        }

        // 2. Create and save handler if not exists
        if signer.storage.borrow<&BattleCreator.Handler>(from: /storage/BattleCreator) == nil {
            let handler <- BattleCreator.createHandler()
            signer.storage.save(<-handler, to: /storage/BattleCreator)
        }

        // 3. Issue auth capability
        let handlerCap = signer.capabilities.storage
            .issue<auth(FlowTransactionScheduler.Execute) &{FlowTransactionScheduler.TransactionHandler}>(
                /storage/BattleCreator
            )

        // 4. Convert hex calldata to [UInt8]
        let calldata: [UInt8] = []
        var i = 0
        while i < calldataHex.length {
            let byteStr = calldataHex.slice(from: i, upTo: i + 2)
            let byte = UInt8.fromString(byteStr, radix: 16) ?? panic("Invalid hex byte: ".concat(byteStr))
            calldata.append(byte)
            i = i + 2
        }

        // 5. Calculate fee and withdraw FLOW
        let fee = FlowTransactionScheduler.calculateFee(
            executionEffort: 2500,
            priority: FlowTransactionScheduler.Priority.Medium,
            dataSizeMB: 0.01
        )

        let flowVault = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
            from: /storage/flowTokenVault
        ) ?? panic("No FlowToken vault")

        let fees <- flowVault.withdraw(amount: fee) as! @FlowToken.Vault

        // 6. Schedule via Manager
        let manager = signer.storage.borrow<auth(FlowTransactionSchedulerUtils.Owner) &{FlowTransactionSchedulerUtils.Manager}>(
            from: FlowTransactionSchedulerUtils.managerStoragePath
        ) ?? panic("No Manager")

        let txId = manager.schedule(
            handlerCap: handlerCap,
            data: calldata,
            timestamp: timestamp,
            priority: FlowTransactionScheduler.Priority.Medium,
            executionEffort: 2500,
            fees: <-fees
        )

        log("BattleCreator scheduled (id: ".concat(txId.toString()).concat(") for pool: ").concat(battlePoolAddress))
    }
}
