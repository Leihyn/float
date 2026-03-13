/**
 * Passkey-style walletless onboarding for Flow.
 *
 * Approach:
 * - WebAuthn credential creation triggers biometric (Face ID / fingerprint)
 *   for familiar "passkey" UX. But WebAuthn signatures wrap the challenge
 *   in authenticatorData + clientDataJSON, which Flow can't verify.
 *
 * - So we generate a SEPARATE P256 keypair via Web Crypto API for actual
 *   Flow transaction signing. This key produces standard ECDSA_P256
 *   signatures that Flow verifies natively.
 *
 * - hardware-wallet-api creates the Flow account from the signing key.
 *
 * Result: user taps Face ID, gets a Flow account, signs transactions
 * with zero popups or wallet extensions.
 */

const STORAGE_KEY = 'float_passkey'

interface StoredPasskey {
  credentialId: string    // base64url (WebAuthn credential for biometric gate)
  publicKey: string       // hex-encoded P256 public key (x || y, 64 bytes)
  privateKeyJwk: JsonWebKey // P256 private key for Flow signing
  flowAddress: string
}

/**
 * Check if a passkey session exists in localStorage.
 */
export function getStoredPasskey(): StoredPasskey | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Store passkey data after creation.
 */
function storePasskey(data: StoredPasskey): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/**
 * Clear stored passkey (sign out).
 */
export function clearPasskey(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Create a new passkey and Flow account.
 *
 * 1. WebAuthn credential creation (biometric UX)
 * 2. Generate P256 signing key via Web Crypto API
 * 3. Create Flow account with hardware-wallet-api
 * 4. Fund account from deployer (faucet has CORS issues from browser)
 */
export async function createPasskeyAccount(): Promise<StoredPasskey> {
  // 1. Create WebAuthn credential for biometric UX (Face ID / fingerprint)
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Float', id: window.location.hostname },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: 'float-user',
        displayName: 'Float User',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256 = P-256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
        residentKey: 'preferred',
      },
      attestation: 'none',
      timeout: 60000,
    },
  }) as PublicKeyCredential

  if (!credential) throw new Error('Passkey creation cancelled')

  const credentialId = bufferToBase64url(credential.rawId)

  // 2. Generate P256 signing keypair via Web Crypto API
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true, // extractable (needed to export private key for storage)
    ['sign', 'verify'],
  )

  // Export private key as JWK for localStorage
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)

  // Export public key as raw bytes (65 bytes: 04 || x || y)
  const publicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', keyPair.publicKey),
  )
  // Strip the 0x04 prefix, Flow wants just x || y (64 bytes)
  const publicKeyBytes = publicKeyRaw.slice(1)
  const publicKeyHex = bytesToHex(publicKeyBytes)

  // 3. Create Flow account via hardware-wallet-api
  const flowAddress = await createFlowAccount(publicKeyHex)

  // 4. Fund account with FLOW from deployer
  await fundFromDeployer(flowAddress)

  const stored: StoredPasskey = {
    credentialId,
    publicKey: publicKeyHex,
    privateKeyJwk,
    flowAddress,
  }
  storePasskey(stored)

  return stored
}

/**
 * Sign a message with the stored signing key.
 * Uses Web Crypto API for standard ECDSA_P256 signatures.
 */
export async function signWithPasskey(
  message: Uint8Array,
): Promise<{ signature: string }> {
  const stored = getStoredPasskey()
  if (!stored) throw new Error('No passkey found')

  // Import the private key from JWK
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    stored.privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  // Sign with SHA-256 (matches Flow's SHA2_256 hash algorithm)
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    message as BufferSource,
  )

  // Web Crypto returns DER-encoded signature, convert to raw r || s
  const signatureBytes = new Uint8Array(signatureBuffer)
  const rawSig = derToRaw(signatureBytes)

  return { signature: bytesToHex(rawSig) }
}

// --- Internal helpers ---

/**
 * Convert DER-encoded ECDSA signature to raw (r || s) format.
 */
function derToRaw(der: Uint8Array): Uint8Array {
  // Web Crypto P-256 returns raw r || s (64 bytes), not DER
  if (der.length === 64) return der

  // DER: 30 <len> 02 <rlen> <r> 02 <slen> <s>
  if (der[0] !== 0x30) throw new Error('Invalid DER signature')

  let offset = 2
  if (der[1] & 0x80) offset += (der[1] & 0x7f)

  // Read r
  if (der[offset] !== 0x02) throw new Error('Invalid DER: expected 0x02 for r')
  offset++
  const rLen = der[offset++]
  const r = der.slice(offset, offset + rLen)
  offset += rLen

  // Read s
  if (der[offset] !== 0x02) throw new Error('Invalid DER: expected 0x02 for s')
  offset++
  const sLen = der[offset++]
  const s = der.slice(offset, offset + sLen)

  // Normalize to 32 bytes each
  const rNorm = padTo32(r)
  const sNorm = padTo32(s)

  const raw = new Uint8Array(64)
  raw.set(rNorm, 0)
  raw.set(sNorm, 32)
  return raw
}

function padTo32(buf: Uint8Array): Uint8Array {
  if (buf.length === 32) return buf
  if (buf.length === 33 && buf[0] === 0) return buf.slice(1)
  if (buf.length < 32) {
    const padded = new Uint8Array(32)
    padded.set(buf, 32 - buf.length)
    return padded
  }
  return buf.slice(buf.length - 32)
}

/**
 * Create a Flow account with a P256 public key via hardware-wallet-api.
 */
async function createFlowAccount(publicKeyHex: string): Promise<string> {
  const res = await fetch(
    'https://hardware-wallet-api-testnet.staging.onflow.org/accounts',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: publicKeyHex,
        signatureAlgorithm: 'ECDSA_P256',
        hashAlgorithm: 'SHA2_256',
      }),
    },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Account creation failed: ${text}`)
  }

  const data = await res.json()
  const addr = data.address
  if (!addr) throw new Error('No address in response')

  return addr.startsWith('0x') ? addr : `0x${addr}`
}

/**
 * Fund a new Flow account from the deployer account.
 * The testnet faucet has CORS issues when called from browser,
 * so we send FLOW directly from the deployer instead.
 */
async function fundFromDeployer(address: string): Promise<void> {
  const { fcl } = await import('../config/flow')
  const SHA3Module = await import('sha3')
  const elliptic = await import('elliptic')

  const SHA3 = SHA3Module.SHA3 || (SHA3Module as any).default?.SHA3 || (SHA3Module as any).default
  const EC = elliptic.ec || (elliptic as any).default?.ec

  const DEPLOYER_ADDRESS = '0xf865549035cf159a'
  const DEPLOYER_KEY = 'd30593512820435574ab41e2935b47421737b88b473a3b7a95ab18fc89c3422d'

  const ec = new EC('p256')
  const key = ec.keyFromPrivate(DEPLOYER_KEY)

  const deployerAuthz = (account: any) => ({
    ...account,
    addr: DEPLOYER_ADDRESS,
    keyId: 0,
    signingFunction: async (signable: { message: string }) => {
      const msg = signable.message
      const sha = new SHA3(256)
      sha.update(Buffer.from(msg, 'hex'))
      const digest = sha.digest()
      const sig = key.sign(digest)
      const r = sig.r.toArrayLike(Buffer, 'be', 32)
      const s = sig.s.toArrayLike(Buffer, 'be', 32)
      const signature = Buffer.concat([r, s]).toString('hex')
      return { addr: DEPLOYER_ADDRESS, keyId: 0, signature }
    },
  })

  const txId = await fcl.mutate({
    cadence: `
      import FlowToken from 0xFlowToken
      import FungibleToken from 0xFungibleToken

      transaction(recipient: Address, amount: UFix64) {
        prepare(signer: auth(BorrowValue) &Account) {
          let vault = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
            from: /storage/flowTokenVault
          ) ?? panic("No FLOW vault")

          let tokens <- vault.withdraw(amount: amount) as! @FlowToken.Vault

          let receiverRef = getAccount(recipient)
            .capabilities.borrow<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
            ?? panic("No receiver capability")

          receiverRef.deposit(from: <-tokens)
        }
      }
    `,
    args: (arg: any, t: any) => [
      arg(address, t.Address),
      arg('10.0', t.UFix64),
    ],
    proposer: deployerAuthz,
    payer: deployerAuthz,
    authorizations: [deployerAuthz],
    limit: 1000,
  })

  await fcl.tx(txId).onceSealed()
}

// --- Encoding helpers ---

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
