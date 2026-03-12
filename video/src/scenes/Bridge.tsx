import { useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from "remotion";
import { COLORS } from "../constants";
import { INTER, MONO } from "../fonts";

/**
 * Bridge / Product Pitch — 12s (360 frames)
 * Logo + 3 value props staggered
 */
export const Bridge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo entrance
  const logoProg = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 160 } });
  const logoOp = interpolate(logoProg, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
  const logoScale = interpolate(logoProg, [0, 1], [0.93, 1], { extrapolateRight: "clamp" });

  // Title
  const titleProg = spring({ frame: frame - 20, fps, config: { damping: 16, stiffness: 140 } });
  const titleOp = interpolate(titleProg, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });

  // Tagline
  const tagProg = spring({ frame: frame - 35, fps, config: { damping: 16, stiffness: 140 } });
  const tagOp = interpolate(tagProg, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });

  const props = [
    {
      track: "CONSUMER DEFI",
      text: "One-tap deposit into yield-bearing vaults.",
      accent: "Passkey login. No wallet needed.",
    },
    {
      track: "GAMIFIED YIELD",
      text: "Wager earned yield on daily prediction battles.",
      accent: "Principal never at risk.",
    },
    {
      track: "FLOW NATIVE",
      text: "Cadence scheduled transactions auto-compound yield.",
      accent: "Cross-VM: Cadence orchestrates EVM contracts.",
    },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(ellipse at 50% 30%, #0a1a0a 0%, ${COLORS.bg} 65%)`,
        fontFamily: INTER,
      }}
    >
      {/* Logo */}
      <div style={{ opacity: logoOp, transform: `scale(${logoScale})`, marginBottom: 16 }}>
        <Img src={staticFile("logo.jpg")} style={{ width: 80, height: 80, borderRadius: 16 }} />
      </div>

      {/* Title */}
      <div style={{ opacity: titleOp, fontSize: 56, fontWeight: 800, color: COLORS.white, letterSpacing: -2, marginBottom: 8 }}>
        Float
      </div>

      {/* Tagline */}
      <div style={{ opacity: tagOp, fontSize: 22, color: COLORS.offWhite, marginBottom: 60, fontWeight: 500 }}>
        Your deposit earns. Your yield plays.
      </div>

      {/* Value props */}
      <div style={{ display: "flex", gap: 40 }}>
        {props.map((p, i) => {
          const enter = 70 + i * 50;
          const prog = spring({ frame: frame - enter, fps, config: { damping: 16, stiffness: 140 } });
          const op = interpolate(prog, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
          const scale = interpolate(prog, [0, 1], [0.93, 1], { extrapolateRight: "clamp" });

          return (
            <div
              key={i}
              style={{
                opacity: op,
                transform: `scale(${scale})`,
                width: 400,
                padding: "32px 28px",
                borderRadius: 16,
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: COLORS.accent, marginBottom: 12 }}>
                {p.track}
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: COLORS.white, lineHeight: 1.4, marginBottom: 8 }}>
                {p.text}
              </div>
              <div style={{ fontSize: 16, color: COLORS.accentBright, fontWeight: 500 }}>
                {p.accent}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
