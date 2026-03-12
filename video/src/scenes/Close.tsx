import { useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from "remotion";
import { COLORS } from "../constants";
import { INTER, MONO } from "../fonts";

/**
 * Close — 20s (600 frames)
 * Phase 1 (0-350): Logo + live stats + momentum
 * Phase 2 (350-600): CTA + summary
 */
export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1
  const p1Op = interpolate(frame, [0, 15, 310, 350], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const logoProg = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 160 } });
  const logoScale = interpolate(logoProg, [0, 1], [0.93, 1], { extrapolateRight: "clamp" });

  // Stats counter
  const tvl = interpolate(frame, [40, 120], [0, 12500], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const battles = interpolate(frame, [60, 120], [0, 4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const users = interpolate(frame, [80, 120], [0, 3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Phase 2
  const p2Op = interpolate(frame, [350, 390], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaProg = spring({ frame: frame - 370, fps, config: { damping: 16, stiffness: 140 } });
  const ctaScale = interpolate(ctaProg, [0, 1], [0.93, 1], { extrapolateRight: "clamp" });

  // Corner brackets
  const cornerOp = interpolate(frame, [380, 420], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Separator line
  const lineWidth = interpolate(frame, [400, 460], [0, 300], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(ellipse at 50% 40%, #0a1a0a 0%, ${COLORS.bg} 65%)`,
        fontFamily: INTER,
        position: "relative",
      }}
    >
      {/* Phase 1: Live stats */}
      <div
        style={{
          position: "absolute",
          opacity: p1Op,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ transform: `scale(${logoScale})`, marginBottom: 24 }}>
          <Img src={staticFile("logo.jpg")} style={{ width: 80, height: 80, borderRadius: 16 }} />
        </div>
        <div style={{ fontSize: 48, fontWeight: 800, color: COLORS.white, letterSpacing: -2, marginBottom: 12 }}>
          Float
        </div>
        <div style={{ fontSize: 20, color: COLORS.offWhite, marginBottom: 50 }}>
          Live on Flow Testnet
        </div>

        <div style={{ display: "flex", gap: 60 }}>
          {[
            { label: "Vault APY", value: "~4%" },
            { label: "Principal Risk", value: "$0" },
            { label: "Protocol Fee", value: "5%" },
          ].map((stat, i) => {
            const sProg = spring({ frame: frame - (50 + i * 15), fps, config: { damping: 18, stiffness: 155 } });
            const sOp = interpolate(sProg, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div key={i} style={{ opacity: sOp, textAlign: "center" }}>
                <div style={{ fontFamily: MONO, fontSize: 36, fontWeight: 700, color: COLORS.accent }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 13, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 2, marginTop: 4 }}>
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Momentum text */}
        {(() => {
          const momProg = spring({ frame: frame - 160, fps, config: { damping: 16, stiffness: 140 } });
          const momOp = interpolate(momProg, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div style={{ opacity: momOp, marginTop: 50, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 16, color: COLORS.offWhite }}>
                19/19 Foundry tests passing
              </div>
              <div style={{ fontSize: 16, color: COLORS.offWhite }}>
                Cadence + EVM contracts deployed
              </div>
              <div style={{ fontSize: 16, color: COLORS.offWhite }}>
                Full React frontend with live wallet integration
              </div>
            </div>
          );
        })()}
      </div>

      {/* Phase 2: CTA */}
      <div
        style={{
          position: "absolute",
          opacity: p2Op,
          transform: `scale(${ctaScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 800, color: COLORS.white, letterSpacing: -2, textAlign: "center", lineHeight: 1.15, marginBottom: 20 }}>
          Your deposit earns.
          <br />
          <span style={{ color: COLORS.accent }}>Your yield plays.</span>
        </div>

        {/* Separator */}
        <div
          style={{
            width: lineWidth,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${COLORS.accent}, transparent)`,
            marginBottom: 30,
          }}
        />

        <div style={{ fontSize: 22, color: COLORS.offWhite, marginBottom: 40, textAlign: "center", maxWidth: 600 }}>
          Consumer DeFi on Flow. No principal risk. Just yield, battles, and fun.
        </div>

        {/* Team / links */}
        <div style={{ display: "flex", gap: 40, fontSize: 15, color: COLORS.muted }}>
          <span>Built for Protocol Labs Hackathon</span>
          <span style={{ color: COLORS.border }}>|</span>
          <span>Flow Testnet</span>
          <span style={{ color: COLORS.border }}>|</span>
          <span>github.com/Leihyn/float</span>
        </div>
      </div>

      {/* Corner brackets (Phase 2) */}
      <div style={{ position: "absolute", top: 50, left: 50, width: 50, height: 50, opacity: cornerOp, borderTop: `3px solid ${COLORS.accent}`, borderLeft: `3px solid ${COLORS.accent}` }} />
      <div style={{ position: "absolute", top: 50, right: 50, width: 50, height: 50, opacity: cornerOp, borderTop: `3px solid ${COLORS.accent}`, borderRight: `3px solid ${COLORS.accent}` }} />
      <div style={{ position: "absolute", bottom: 50, left: 50, width: 50, height: 50, opacity: cornerOp, borderBottom: `3px solid ${COLORS.accent}`, borderLeft: `3px solid ${COLORS.accent}` }} />
      <div style={{ position: "absolute", bottom: 50, right: 50, width: 50, height: 50, opacity: cornerOp, borderBottom: `3px solid ${COLORS.accent}`, borderRight: `3px solid ${COLORS.accent}` }} />
    </div>
  );
};
