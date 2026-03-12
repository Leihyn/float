import "EVM"

/// Get the EVM address controlled by a Flow account's COA.
access(all) fun main(flowAddress: Address): String {
    let account = getAuthAccount<auth(BorrowValue) &Account>(flowAddress)
    let coa = account.storage.borrow<&EVM.CadenceOwnedAccount>(from: /storage/evm)
        ?? panic("No COA found")
    return coa.address().toString()
}
