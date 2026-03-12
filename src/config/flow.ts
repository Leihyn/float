import * as fcl from '@onflow/fcl'

// Flow network configuration
const NETWORK = import.meta.env.VITE_FLOW_NETWORK || 'testnet'

const configs: Record<string, Record<string, string>> = {
  testnet: {
    'accessNode.api': 'https://rest-testnet.onflow.org',
    'discovery.wallet': 'https://fcl-discovery.onflow.org/testnet/authn',
    'discovery.wallet.method': 'IFRAME/RPC',
    'flow.network': 'testnet',
    '0xFlowToken': '0x7e60df042a9c0868',
    '0xFungibleToken': '0x9a0766d93b6608b7',
    '0xEVM': '0x8c5303eaa26202d6',
    '0xFlowTransactionScheduler': '0x8c5303eaa26202d6',
    '0xBandOracle': '0x9fb6606c300b5051',
  },
  mainnet: {
    'accessNode.api': 'https://rest-mainnet.onflow.org',
    'discovery.wallet': 'https://fcl-discovery.onflow.org/authn',
    'flow.network': 'mainnet',
    '0xFlowToken': '0x1654653399040a61',
    '0xFungibleToken': '0xf233dcee88fe0abe',
    '0xEVM': '0xe467b9dd11fa00df',
    '0xFlowTransactionScheduler': '0xe467b9dd11fa00df',
    '0xBandOracle': '0x6801a6222ebf784a',
  },
  emulator: {
    'accessNode.api': 'http://localhost:8888',
    'discovery.wallet': 'http://localhost:8701/fcl/authn',
    'flow.network': 'emulator',
    '0xFlowToken': '0x0ae53cb6e3f42a79',
    '0xFungibleToken': '0xee82856bf20e2aa6',
    '0xEVM': '0xf8d6e0586b0a20c7',
    '0xFlowTransactionScheduler': '0xf8d6e0586b0a20c7',
  },
}

fcl.config(configs[NETWORK] || configs.testnet)

// Flow EVM RPC endpoints
export const FLOW_EVM_RPC: Record<string, string> = {
  testnet: 'https://testnet.evm.nodes.onflow.org',
  mainnet: 'https://mainnet.evm.nodes.onflow.org',
  emulator: 'http://localhost:8545',
}

export const flowEvmRpc = FLOW_EVM_RPC[NETWORK] || FLOW_EVM_RPC.testnet

// Contract addresses on Flow EVM
export const CONTRACTS = {
  // MORE Markets (Aave V3 fork) — mainnet addresses (used when NETWORK=mainnet)
  MORE_POOL: '0xbC92aaC2DBBF42215248B5688eB3D3d2b32F2c8d' as `0x${string}`,

  // USDC token — use mock on testnet, real stgUSDC on mainnet
  STG_USDC: (import.meta.env.VITE_MOCK_USDC || '0xF1815bd50389c46847f0Bda824eC8da914045D14') as `0x${string}`,
  A_TOKEN_USDC: '0x49c6b2799aF2Db7404b930F24471dD961CFE18b7' as `0x${string}`,

  // Float contracts — set via env after deployment
  FLOAT_VAULT: (import.meta.env.VITE_FLOAT_VAULT || '0x0000000000000000000000000000000000000000') as `0x${string}`,
  BATTLE_POOL: (import.meta.env.VITE_BATTLE_POOL || '0x0000000000000000000000000000000000000000') as `0x${string}`,
} as const

export { fcl, NETWORK }
