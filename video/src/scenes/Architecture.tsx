import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../constants";
import { INTER, MONO } from "../fonts";

/**
 * Architecture Flash — 12s (360 frames)
 * Shows the cross-VM stack: User → Cadence → COA → EVM contracts
 */
export const Architecture: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProg = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 155 } });
  const titleOp = interpolate(titleProg, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });

  // Left column: User-facing
  const leftItems = [
    { name: "Flow Wallet", desc: "One-tap auth + signing", icon: "W" },
    { name: "Cadence Transactions", desc: "Orchestrates all EVM calls", icon: "C" },
    { name: "COA (Cadence Owned Account)", desc: "Bridge between VMs", icon: "B" },
  ];

  // Right column: EVM contracts
  const rightItems = [
    { name: "FloatVault.sol", desc: "Deposits, withdrawals, yield accounting", icon: "V" },
    { name: "BattlePool.sol", desc: "Prediction markets, wagers, payouts", icon: "P" },
    { name: "MockUSDC.sol", desc: "Stablecoin (stgUSDC on mainnet)", icon: "$" },
  ];

  // Arrow between columns
  const arrowOp = interpolate(frame, [120, 150], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const arrowWidth = interpolate(frame, [120, 160], [0, 120], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Bottom: Flow-native features
  const bottomProg = spring({ frame: frame - 230, fps, config: { damping: 16, stiffness: 140 } });
  const bottomOp = interpolate(bottomProg, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: COLORS.bg,
        fontFamily: INTER,
      }}
    >
      <div style={{ opacity: titleOp, fontSize: 14, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: COLORS.muted, marginBottom: 50 }}>
        Architecture
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {/* Left: Cadence Layer */}
        <div style={{ width: 450 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 2, color: COLORS.blue, textTransform: "uppercase", marginBottom: 20, textAlign: "center" }}>
            Cadence Layer
          </div>
          {leftItems.map((item, i) => {
            const enter = 20 + i * 30;
            const prog = spring({ frame: frame - enter, fps, config: { damping: 18, stiffness: 155 } });
            const op = interpolate(prog, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div
                key={i}
                style={{
                  opacity: op,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 20px",
                  marginBottom: 12,
                  borderRadius: 12,
                  background: COLORS.bgCard,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(59, 130, 246, 0.15)",
                    fontSize: 20,
                    fontFamily: MONO,
                    fontWeight: 700,
                    color: COLORS.blue,
                  }}
                >
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: COLORS.white }}>{item.name}</div>
                  <div style={{ fontSize: 14, color: COLORS.muted, marginTop: 2 }}>{item.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Arrow */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "0 20px" }}>
          <div
            style={{
              opacity: arrowOp,
              width: arrowWidth,
              height: 3,
              background: `linear-gradient(90deg, ${COLORS.blue}, ${COLORS.accent})`,
              borderRadius: 2,
            }}
          />
          <div style={{ opacity: arrowOp, fontSize: 12, color: COLORS.muted, marginTop: 8, fontFamily: MONO }}>
            coa.call()
          </div>
        </div>

        {/* Right: EVM Layer */}
        <div style={{ width: 450 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 2, color: COLORS.accent, textTransform: "uppercase", marginBottom: 20, textAlign: "center" }}>
            EVM Layer
          </div>
          {rightItems.map((item, i) => {
            const enter = 80 + i * 30;
            const prog = spring({ frame: frame - enter, fps, config: { damping: 18, stiffness: 155 } });
            const op = interpolate(prog, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div
                key={i}
                style={{
                  opacity: op,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 20px",
                  marginBottom: 12,
                  borderRadius: 12,
                  background: COLORS.bgCard,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(34, 197, 94, 0.15)",
                    fontSize: 20,
                    fontFamily: MONO,
                    fontWeight: 700,
                    color: COLORS.accent,
                  }}
                >
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: COLORS.white }}>{item.name}</div>
                  <div style={{ fontSize: 14, color: COLORS.muted, marginTop: 2 }}>{item.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom: Flow features */}
      <div
        style={{
          opacity: bottomOp,
          display: "flex",
          gap: 40,
          marginTop: 50,
        }}
      >
        {[
          "Scheduled Transactions (auto-compound)",
          "Gas Sponsorship (free for users)",
          "Passkey Auth (Face ID / fingerprint)",
        ].map((feat, i) => {
          const fProg = spring({ frame: frame - (240 + i * 20), fps, config: { damping: 18, stiffness: 155 } });
          const fOp = interpolate(fProg, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                opacity: fOp,
                fontSize: 14,
                color: COLORS.offWhite,
                padding: "10px 20px",
                borderRadius: 8,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.surface,
              }}
            >
              {feat}
            </div>
          );
        })}
      </div>
    </div>
  );
};
