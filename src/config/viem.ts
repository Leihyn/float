import { createPublicClient, http } from 'viem'
import { flowEvmRpc } from './flow'

// Flow EVM chain definition
export const flowEvm = {
  id: 545,
  name: 'Flow EVM',
  nativeCurrency: { name: 'Flow', symbol: 'FLOW', decimals: 18 },
  rpcUrls: {
    default: { http: [flowEvmRpc] },
  },
} as const

// Read-only client for Flow EVM (no signing needed)
export const publicClient = createPublicClient({
  chain: flowEvm,
  transport: http(flowEvmRpc),
})
