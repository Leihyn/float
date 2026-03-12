import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../constants";
import { INTER, MONO } from "../fonts";

/**
 * Contrast scene — 10s (300 frames)
 * Left: "Traditional DeFi Yield" (boring, passive)
 * Right: "Float" (active, gamified)
 */
export const Contrast: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Left side enters first
  const leftProg = spring({ frame: frame - 10, fps, config: { damping: 18, stiffness: 150 } });
  const leftOp = interpolate(leftProg, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
  const leftScale = interpolate(leftProg, [0, 1], [0.93, 1], { extrapolateRight: "clamp" });

  // Divider
  const dividerOp = interpolate(frame, [40, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dividerHeight = interpolate(frame, [40, 80], [0, 400], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Right side enters
  const rightProg = spring({ frame: frame - 50, fps, config: { damping: 18, stiffness: 150 } });
  const rightOp = interpolate(rightProg, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
  const rightScale = interpolate(rightProg, [0, 1], [0.93, 1], { extrapolateRight: "clamp" });

  // Bottom tagline
  const bottomProg = spring({ frame: frame - 150, fps, config: { damping: 16, stiffness: 140 } });
  const bottomOp = interpolate(bottomProg, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });

  const leftItems = [
    { label: "Deposit", detail: "Sit and wait" },
    { label: "Yield", detail: "1-5% APY (variable)" },
    { label: "Risk", detail: "IL, smart contract, rate drops" },
    { label: "Fun", detail: "..." },
  ];

  const rightItems = [
    { label: "Deposit", detail: "Protected, always withdrawable" },
    { label: "Yield", detail: "Compounded via lending markets" },
    { label: "Risk", detail: "Only yield at stake, never principal" },
    { label: "Fun", detail: "Daily prediction battles" },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: COLORS.bg,
        fontFamily: INTER,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 80 }}>
        {/* Left — Traditional */}
        <div style={{ opacity: leftOp, transform: `scale(${leftScale})`, width: 500 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", color: COLORS.muted, marginBottom: 20 }}>
            Traditional DeFi
          </div>
          {leftItems.map((item, i) => {
            const itemProg = spring({ frame: frame - (20 + i * 15), fps, config: { damping: 20, stiffness: 160 } });
            const itemOp = interpolate(itemProg, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div key={i} style={{ opacity: itemOp, marginBottom: 24, borderLeft: `3px solid ${COLORS.border}`, paddingLeft: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.offWhite }}>{item.label}</div>
                <div style={{ fontSize: 20, color: COLORS.muted, marginTop: 4 }}>{item.detail}</div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div
          style={{
            width: 2,
            height: dividerHeight,
            opacity: dividerOp,
            background: `linear-gradient(180deg, transparent, ${COLORS.accent}, transparent)`,
            marginTop: 30,
          }}
        />

        {/* Right — Float */}
        <div style={{ opacity: rightOp, transform: `scale(${rightScale})`, width: 500 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", color: COLORS.accent, marginBottom: 20 }}>
            Float
          </div>
          {rightItems.map((item, i) => {
            const itemProg = spring({ frame: frame - (60 + i * 15), fps, config: { damping: 20, stiffness: 160 } });
            const itemOp = interpolate(itemProg, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div key={i} style={{ opacity: itemOp, marginBottom: 24, borderLeft: `3px solid ${COLORS.accent}`, paddingLeft: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.white }}>{item.label}</div>
                <div style={{ fontSize: 20, color: COLORS.accentBright, marginTop: 4 }}>{item.detail}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom tagline */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          opacity: bottomOp,
          fontSize: 28,
          fontWeight: 700,
          color: COLORS.white,
          textAlign: "center",
        }}
      >
        Same deposit. <span style={{ color: COLORS.accent }}>10x more fun.</span>
      </div>
    </div>
  );
};
