import "FlowTransactionScheduler"
import "FlowTransactionSchedulerUtils"

/// Create a handler resource, save it to storage, and register it with the scheduler.
/// handlerStoragePath: Storage path string (e.g., "/storage/YieldCompounder")
/// handlerPublicPath: Public path string (e.g., "/public/YieldCompounder")
transaction(handlerStoragePath: StoragePath, handlerPublicPath: PublicPath) {
    prepare(signer: auth(SaveValue, BorrowValue, IssueStorageCapabilityController, PublishCapability) &Account) {
        // Get the scheduler manager
        let manager = FlowTransactionSchedulerUtils.Manager(account: signer)

        // Create and save the handler (this must be done per-contract)
        // The handler should already be saved by the contract deployment
        // Just register it with the scheduler

        // Issue capability for the handler
        let cap = signer.capabilities.storage.issue<&{FlowTransactionScheduler.TransactionHandler}>(handlerStoragePath)
        signer.capabilities.publish(cap, at: handlerPublicPath)

        log("Handler registered at ".concat(handlerStoragePath.toString()))
    }
}
