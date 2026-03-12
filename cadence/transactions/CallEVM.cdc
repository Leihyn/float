import "EVM"

/// Generic transaction to call any EVM contract function via COA.
/// targetAddress: The EVM contract address (hex string)
/// calldata: ABI-encoded function call (hex string without 0x)
/// gasLimit: Gas limit for the call
transaction(targetAddress: String, calldata: String, gasLimit: UInt64) {
    let coa: auth(EVM.Call) &EVM.CadenceOwnedAccount

    prepare(signer: auth(BorrowValue) &Account) {
        self.coa = signer.storage.borrow<auth(EVM.Call) &EVM.CadenceOwnedAccount>(from: /storage/evm)
            ?? panic("No COA found")
    }

    execute {
        let target = EVM.addressFromString(targetAddress)
        let data = calldata.decodeHex()

        let result = self.coa.call(
            to: target,
            data: data,
            gasLimit: gasLimit,
            value: EVM.Balance(attoflow: UInt(0))
        )

        assert(result.status == EVM.Status.successful,
            message: "EVM call failed: ".concat(result.errorMessage))

        log("EVM call successful")
    }
}
