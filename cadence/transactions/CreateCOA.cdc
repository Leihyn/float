import "EVM"

/// Creates a Cadence-Owned Account (COA) for the signer.
/// The COA bridges Cadence and EVM — it controls an EVM address
/// that can deploy and interact with Solidity contracts.
transaction() {
    prepare(signer: auth(SaveValue, BorrowValue) &Account) {
        if signer.storage.borrow<&EVM.CadenceOwnedAccount>(from: /storage/evm) == nil {
            let coa <- EVM.createCadenceOwnedAccount()
            signer.storage.save(<-coa, to: /storage/evm)
            log("COA created")
        } else {
            log("COA already exists")
        }
    }
}
