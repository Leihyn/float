import "YieldCompounder"
import "BattleResolver"
import "BattleCreator"

/// Set EVM contract addresses on all handlers.
/// Must be sent by the account that deployed the contracts (access(account)).
transaction(vaultAddress: String, battlePoolAddress: String) {
    prepare(signer: auth(BorrowValue) &Account) {
        // These functions are access(account) — only callable by the deploying account
        YieldCompounder.setVaultAddress(vaultAddress)
        BattleResolver.setBattlePoolAddress(battlePoolAddress)
        BattleCreator.setBattlePoolAddress(battlePoolAddress)

        log("EVM addresses set: vault=".concat(vaultAddress).concat(", battlePool=").concat(battlePoolAddress))
    }
}
