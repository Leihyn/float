// FloatVault ABI (relevant functions only)
export const floatVaultAbi = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'withdrawYield',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'principalOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'yieldOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalValueOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'yieldLockedOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// BattlePool ABI (relevant functions only)
export const battlePoolAbi = [
  {
    name: 'enter',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'battleId', type: 'uint256' },
      { name: 'side', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'getBattle',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'question', type: 'string' },
          { name: 'battleType', type: 'uint8' },
          { name: 'status', type: 'uint8' },
          { name: 'resolveTimestamp', type: 'uint256' },
          { name: 'referencePrice', type: 'uint256' },
          { name: 'targetPrice', type: 'uint256' },
          { name: 'targetPercent', type: 'uint256' },
          { name: 'oracleSymbol', type: 'string' },
          { name: 'yesPool', type: 'uint256' },
          { name: 'noPool', type: 'uint256' },
          { name: 'winningSide', type: 'uint8' },
          { name: 'isEventBattle', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'getEntry',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'battleId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'side', type: 'uint8' },
          { name: 'amount', type: 'uint256' },
          { name: 'claimed', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'getCurrentBattleId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getParticipantCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'nextBattleId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const
