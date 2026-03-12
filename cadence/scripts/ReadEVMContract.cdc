import "EVM"

/// Read data from an EVM contract via COA.
access(all) fun main(flowAddress: Address, targetAddress: String, calldata: String): [UInt8] {
    let account = getAuthAccount<auth(BorrowValue) &Account>(flowAddress)
    let coa = account.storage.borrow<auth(EVM.Call) &EVM.CadenceOwnedAccount>(from: /storage/evm)
        ?? panic("No COA found")

    let target = EVM.addressFromString(targetAddress)
    let data = calldata.decodeHex()

    let result = coa.call(
        to: target,
        data: data,
        gasLimit: 100_000,
        value: EVM.Balance(attoflow: UInt(0))
    )

    return result.data
}
