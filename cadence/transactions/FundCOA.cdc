import "EVM"
import "FungibleToken"
import "FlowToken"

/// Fund the COA's EVM address with FLOW for gas.
/// The COA needs FLOW to deploy contracts and execute transactions on Flow EVM.
transaction(amount: UFix64) {
    let coa: auth(EVM.Call) &EVM.CadenceOwnedAccount
    let sentVault: @FlowToken.Vault

    prepare(signer: auth(BorrowValue) &Account) {
        self.coa = signer.storage.borrow<auth(EVM.Call) &EVM.CadenceOwnedAccount>(from: /storage/evm)
            ?? panic("No COA found")

        let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
            from: /storage/flowTokenVault
        ) ?? panic("No FlowToken vault found")

        self.sentVault <- vaultRef.withdraw(amount: amount) as! @FlowToken.Vault
    }

    execute {
        self.coa.deposit(from: <-self.sentVault)
        log("Funded COA with ".concat(amount.toString()).concat(" FLOW"))
    }
}
