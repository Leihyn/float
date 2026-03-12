import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../constants";
import { INTER, MONO } from "../fonts";

/**
 * How It Works — 15s (450 frames)
 * Step-by-step user flow with animated connections
 */
export const HowItWorks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title
  const titleProg = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 155 } });
  const titleOp = interpolate(titleProg, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });

  const steps = [
    { num: "1", title: "Deposit USDC", desc: "One-tap deposit via Flow Wallet", color: COLORS.accent },
    { num: "2", title: "Earn Yield", desc: "Auto-compounded via lending markets", color: COLORS.accentBright },
    { num: "3", title: "Battle", desc: "Wager yield on daily predictions", color: COLORS.amber },
    { num: "4", title: "Win or Lose", desc: "Only yield at stake. Principal safe", color: COLORS.blue },
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
        background: COLORS.bg,
        fontFamily: INTER,
      }}
    >
      {/* Title */}
      <div style={{ opacity: titleOp, fontSize: 14, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: COLORS.muted, marginBottom: 60 }}>
        How Float Works
      </div>

      {/* Steps in a row */}
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {steps.map((step, i) => {
          const enter = 30 + i * 60;
          const prog = spring({ frame: frame - enter, fps, config: { damping: 16, stiffness: 140 } });
          const op = interpolate(prog, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
          const scale = interpolate(prog, [0, 1], [0.93, 1], { extrapolateRight: "clamp" });

          // Arrow between steps
          const arrowEnter = enter + 30;
          const arrowOp = interpolate(frame, [arrowEnter, arrowEnter + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const arrowWidth = interpolate(frame, [arrowEnter, arrowEnter + 20], [0, 60], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

          return (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  opacity: op,
                  transform: `scale(${scale})`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: 260,
                }}
              >
                {/* Number circle */}
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `3px solid ${step.color}`,
                    marginBottom: 20,
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, color: step.color }}>
                    {step.num}
                  </span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.white, marginBottom: 8 }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 16, color: COLORS.offWhite, textAlign: "center", maxWidth: 200 }}>
                  {step.desc}
                </div>
              </div>

              {/* Arrow */}
              {i < steps.length - 1 && (
                <div
                  style={{
                    opacity: arrowOp,
                    width: arrowWidth,
                    height: 2,
                    background: `linear-gradient(90deg, ${step.color}, ${steps[i + 1].color})`,
                    marginBottom: 60,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom note */}
      {(() => {
        const noteProg = spring({ frame: frame - 320, fps, config: { damping: 16, stiffness: 140 } });
        const noteOp = interpolate(noteProg, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
        return (
          <div
            style={{
              opacity: noteOp,
              marginTop: 80,
              padding: "16px 32px",
              borderRadius: 12,
              border: `1px solid ${COLORS.accent}`,
              background: "rgba(34, 197, 94, 0.08)",
            }}
          >
            <span style={{ fontSize: 18, color: COLORS.accentBright, fontWeight: 600 }}>
              Principal is always withdrawable. Only earned yield enters battles.
            </span>
          </div>
        );
      })()}
    </div>
  );
};
