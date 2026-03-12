import "EVM"

/// Deploy a compiled Solidity contract to Flow EVM via COA.
/// bytecode: The compiled contract bytecode (hex string without 0x prefix)
/// gasLimit: Gas limit for the deployment transaction
transaction(bytecode: String, gasLimit: UInt64) {
    let coa: auth(EVM.Call, EVM.Deploy) &EVM.CadenceOwnedAccount

    prepare(signer: auth(BorrowValue) &Account) {
        self.coa = signer.storage.borrow<auth(EVM.Call, EVM.Deploy) &EVM.CadenceOwnedAccount>(from: /storage/evm)
            ?? panic("No COA found")
    }

    execute {
        let result = self.coa.deploy(
            code: bytecode.decodeHex(),
            gasLimit: gasLimit,
            value: EVM.Balance(attoflow: UInt(0))
        )

        assert(result.status == EVM.Status.successful,
            message: "Deploy failed: ".concat(result.errorMessage))

        log("Contract deployed at: ".concat(result.deployedContract!.toString()))
    }
}
