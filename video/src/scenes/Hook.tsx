import { useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from "remotion";
import { COLORS } from "../constants";
import { INTER, MONO } from "../fonts";

/**
 * Hook scene — 15s (450 frames)
 * Phase 1 (0-200): "You deposit $50,000. You expect 5% APY."
 * Phase 2 (200-320): "Two months later... 1.2%. Your yield barely covers gas."
 * Phase 3 (320-450): "What if you could make your yield work harder?"
 */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: Optimistic deposit
  const p1Prog = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 160 } });
  const p1Op = interpolate(p1Prog, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
  const p1Scale = interpolate(p1Prog, [0, 1], [0.93, 1], { extrapolateRight: "clamp" });
  const p1Exit = interpolate(frame, [180, 210], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Amount counter animation
  const depositAmount = interpolate(frame, [30, 90], [0, 50000], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const apyAmount = interpolate(frame, [60, 100], [0, 5.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Phase 2: Reality hits
  const p2Prog = spring({ frame: frame - 210, fps, config: { damping: 18, stiffness: 150 } });
  const p2Op = interpolate(p2Prog, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
  const p2Scale = interpolate(p2Prog, [0, 1], [0.93, 1], { extrapolateRight: "clamp" });
  const p2Exit = interpolate(frame, [300, 330], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const dropApy = interpolate(frame, [230, 280], [5.0, 1.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Phase 3: Transition question
  const p3Prog = spring({ frame: frame - 340, fps, config: { damping: 16, stiffness: 140 } });
  const p3Op = interpolate(p3Prog, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
  const p3Scale = interpolate(p3Prog, [0, 1], [0.93, 1], { extrapolateRight: "clamp" });

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
      }}
    >
      {/* Phase 1: Deposit */}
      <div
        style={{
          position: "absolute",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: p1Op * p1Exit,
          transform: `scale(${p1Scale})`,
        }}
      >
        <div style={{ fontSize: 22, color: COLORS.muted, fontWeight: 500, marginBottom: 24, letterSpacing: 2, textTransform: "uppercase" }}>
          You deposit
        </div>
        <div style={{ fontFamily: MONO, fontSize: 96, fontWeight: 700, color: COLORS.accent, letterSpacing: -2 }}>
          ${Math.floor(depositAmount).toLocaleString()}
        </div>
        <div style={{ fontSize: 28, color: COLORS.offWhite, marginTop: 20, fontWeight: 500 }}>
          expecting <span style={{ color: COLORS.accentBright, fontFamily: MONO, fontWeight: 700 }}>{apyAmount.toFixed(1)}% APY</span>
        </div>
      </div>

      {/* Phase 2: Crash */}
      <div
        style={{
          position: "absolute",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: p2Op * p2Exit,
          transform: `scale(${p2Scale})`,
        }}
      >
        <div style={{ fontSize: 22, color: COLORS.muted, fontWeight: 500, marginBottom: 16, letterSpacing: 2, textTransform: "uppercase" }}>
          Two months later
        </div>
        <div style={{ fontFamily: MONO, fontSize: 96, fontWeight: 700, color: COLORS.red, letterSpacing: -2 }}>
          {dropApy.toFixed(1)}%
        </div>
        <div style={{ fontSize: 28, color: COLORS.offWhite, marginTop: 20, fontWeight: 500, textAlign: "center", maxWidth: 600 }}>
          Your yield barely covers gas fees.
        </div>
        <div style={{ fontSize: 20, color: COLORS.muted, marginTop: 12 }}>
          Months of expected earnings, gone.
        </div>
      </div>

      {/* Phase 3: Bridge */}
      <div
        style={{
          position: "absolute",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: p3Op,
          transform: `scale(${p3Scale})`,
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 800, color: COLORS.white, textAlign: "center", maxWidth: 800, lineHeight: 1.2, letterSpacing: -1 }}>
          What if your yield could
          <br />
          <span style={{ color: COLORS.accent }}>fight back?</span>
        </div>
      </div>
    </div>
  );
};
