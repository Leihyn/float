/**
 * FCL Custom Authorization using local P256 signing key.
 *
 * Replaces Blocto/Discovery wallet with local key signing.
 * The signing key is generated via Web Crypto API during passkey onboarding.
 * Flow's FLIP-264 supports P256 keys natively.
 */
import * as fcl from '@onflow/fcl'
import { getStoredPasskey, signWithPasskey, clearPasskey } from './passkey'

/**
 * Custom FCL authorization function that signs with the stored P256 key.
 * Used as proposer/payer/authorizations for all transactions.
 */
export function passkeyAuthz(account: any) {
  const stored = getStoredPasskey()
  if (!stored) throw new Error('No passkey session')

  return {
    ...account,
    addr: stored.flowAddress,
    keyId: 0,
    signingFunction: async (signable: { message: string }) => {
      const messageBytes = hexToBytes(signable.message)
      const { signature } = await signWithPasskey(messageBytes)

      return {
        addr: stored.flowAddress,
        keyId: 0,
        signature,
      }
    },
  }
}

/**
 * Sign out: clear passkey and FCL state.
 */
export function passkeySignOut(): void {
  clearPasskey()
  fcl.unauthenticate()
}

// --- Helper ---
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
