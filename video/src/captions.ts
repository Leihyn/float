/**
 * Caption data for Float demo video.
 * Each entry has text, start frame, and end frame.
 *
 * Scene timeline (frames @ 30fps):
 *    0 –  450  Hook           | "You deposit... rates crash"
 *  450 –  750  Contrast       | Traditional vs Float
 *  750 – 1110  Bridge         | Logo + 3 value props
 * 1110 – 1560  How It Works   | 4 steps
 * 1560 – 2310  Demo Flow      | Screen recordings
 * 2310 – 2670  Architecture   | Cross-VM stack
 * 2670 – 3270  Close          | Stats + CTA
 */

export const CAPTIONS = [
  // HOOK (0-450)
  { text: "You deposit fifty thousand dollars.", start: 30, end: 100 },
  { text: "Expecting five percent APY.", start: 110, end: 170 },
  { text: "Two months later, rates crash to one point two percent.", start: 215, end: 310 },
  { text: "Months of expected earnings, gone.", start: 320, end: 390 },
  { text: "What if your yield could fight back?", start: 400, end: 445 },

  // CONTRAST (450-750)
  { text: "Traditional DeFi: yield sits idle.", start: 465, end: 540 },
  { text: "Float: your yield enters prediction battles.", start: 555, end: 640 },
  { text: "Win, and it compounds. Lose, and only yield is gone.", start: 655, end: 745 },

  // BRIDGE (750-1110)
  { text: "One-tap deposit into yield-bearing vaults.", start: 790, end: 870 },
  { text: "Wager earned yield on daily predictions.", start: 890, end: 970 },
  { text: "Principal never at risk.", start: 990, end: 1050 },
  { text: "Built on Flow.", start: 1060, end: 1105 },

  // HOW IT WORKS (1110-1560)
  { text: "Step one: deposit USDC.", start: 1130, end: 1200 },
  { text: "Step two: earn yield automatically via lending markets.", start: 1220, end: 1310 },
  { text: "Step three: wager yield on daily prediction battles.", start: 1330, end: 1420 },
  { text: "Step four: win or lose. Only yield at stake. Principal stays safe.", start: 1440, end: 1555 },

  // DEMO FLOW (1560-2310)
  { text: "Create an account with Face ID. No wallet needed.", start: 1575, end: 1660 },
  { text: "Your dashboard shows deposits, yield, and active battles.", start: 1760, end: 1870 },
  { text: "Pick a side. Wager your yield.", start: 1960, end: 2040 },
  { text: "Battle resolves. Claim your winnings.", start: 2190, end: 2300 },

  // ARCHITECTURE (2310-2670)
  { text: "Cadence orchestrates. EVM executes.", start: 2330, end: 2410 },
  { text: "FloatVault handles deposits and yield tracking.", start: 2430, end: 2520 },
  { text: "BattlePool manages predictions, wagers, and payouts.", start: 2540, end: 2640 },

  // CLOSE (2670-3270)
  { text: "Four percent APY. Zero principal risk. Five percent protocol fee.", start: 2700, end: 2810 },
  { text: "Nineteen out of nineteen Foundry tests passing.", start: 2830, end: 2920 },
  { text: "Your deposit earns.", start: 2960, end: 3020 },
  { text: "Your yield plays.", start: 3030, end: 3100 },
  { text: "Float. Consumer DeFi on Flow.", start: 3140, end: 3260 },
];
