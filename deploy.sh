#!/bin/bash
# Float — Full Deployment Script
# Deploys Cadence handlers + EVM contracts to Flow testnet (or emulator)
#
# Usage:
#   ./deploy.sh              # Deploy to emulator (default)
#   ./deploy.sh testnet      # Deploy to testnet
#
# Prerequisites:
#   - Flow CLI installed
#   - Foundry installed
#   - flow.json configured with accounts for target network
#   - For testnet: account funded with FLOW via faucet

set -e

NETWORK=${1:-emulator}
SIGNER="emulator-account"

if [ "$NETWORK" = "testnet" ]; then
  SIGNER="testnet-deployer"
  echo "=== Deploying to Flow TESTNET ==="
else
  echo "=== Deploying to Flow EMULATOR ==="
fi

echo ""
echo "Step 1: Deploy Cadence contracts..."
flow project deploy --network "$NETWORK" --update
echo "✓ Cadence contracts deployed"

echo ""
echo "Step 2: Create COA (Cadence-Owned Account)..."
flow transactions send cadence/transactions/CreateCOA.cdc \
  --network "$NETWORK" --signer "$SIGNER"
echo "✓ COA created"

echo ""
echo "Step 3: Fund COA with FLOW for EVM gas..."
flow transactions send cadence/transactions/FundCOA.cdc \
  --args-json '[{"type": "UFix64", "value": "10.0"}]' \
  --network "$NETWORK" --signer "$SIGNER"
echo "✓ COA funded with 10 FLOW"

echo ""
echo "Step 4: Get COA EVM address..."
FLOW_ADDRESS=$(flow accounts list --network "$NETWORK" --output json | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['address'])" 2>/dev/null || echo "")
if [ -z "$FLOW_ADDRESS" ]; then
  echo "Getting address from signer..."
  FLOW_ADDRESS=$(flow config get accounts."$SIGNER".address 2>/dev/null || echo "f8d6e0586b0a20c7")
fi
echo "Flow address: $FLOW_ADDRESS"

echo ""
echo "Step 5: Compile Solidity contracts..."
cd contracts
forge build
echo "✓ Contracts compiled"

echo ""
echo "Step 6: Deploy EVM contracts via Forge..."
if [ "$NETWORK" = "emulator" ]; then
  RPC_URL="http://localhost:8545"
else
  RPC_URL="https://testnet.evm.nodes.onflow.org"
fi

# For testnet with mock tokens
echo "Deploying mock tokens + FloatVault + BattlePool..."
DEPLOY_OUTPUT=$(forge script script/Deploy.s.sol:DeployTestnetScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "${PRIVATE_KEY:-}" \
  2>&1)

echo "$DEPLOY_OUTPUT"

# Extract deployed addresses from output
MOCK_USDC=$(echo "$DEPLOY_OUTPUT" | grep "Mock USDC deployed:" | awk '{print $NF}')
FLOAT_VAULT=$(echo "$DEPLOY_OUTPUT" | grep "FloatVault deployed:" | awk '{print $NF}')
BATTLE_POOL=$(echo "$DEPLOY_OUTPUT" | grep "BattlePool deployed:" | awk '{print $NF}')

echo ""
echo "=== Deployed Addresses ==="
echo "Mock USDC:   $MOCK_USDC"
echo "FloatVault:  $FLOAT_VAULT"
echo "BattlePool:  $BATTLE_POOL"

cd ..

echo ""
echo "Step 7: Schedule YieldCompounder..."
flow transactions send cadence/transactions/ScheduleYieldCompound.cdc \
  --args-json "[{\"type\": \"String\", \"value\": \"$FLOAT_VAULT\"}]" \
  --network "$NETWORK" --signer "$SIGNER"
echo "✓ YieldCompounder scheduled"

echo ""
echo "Step 8: Schedule BattleResolver..."
flow transactions send cadence/transactions/ScheduleBattleResolver.cdc \
  --args-json "[{\"type\": \"String\", \"value\": \"$BATTLE_POOL\"}]" \
  --network "$NETWORK" --signer "$SIGNER"
echo "✓ BattleResolver scheduled"

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Update your .env file:"
echo "  VITE_FLOAT_VAULT=$FLOAT_VAULT"
echo "  VITE_BATTLE_POOL=$BATTLE_POOL"
echo "  VITE_MOCK_USDC=$MOCK_USDC"
echo ""
echo "Start the frontend:"
echo "  npm run dev"
