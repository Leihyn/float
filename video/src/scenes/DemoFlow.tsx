import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  OffthreadVideo,
  staticFile,
  Series,
} from "remotion";
import { COLORS } from "../constants";
import { INTER, MONO } from "../fonts";

/**
 * Demo Flow — 25s (750 frames)
 * Uses actual screen recordings in a browser-frame mockup.
 *
 * Phase 1: Passkey Login     (0–190)   ~6.3s   passkey.mp4 trimmed
 * Phase 2: Dashboard         (190–380) ~6.3s   dashboard.mp4
 * Phase 3: Battle Wager      (380–620) ~8s     battle.mp4 trimmed
 * Phase 4: Claim Winnings    (620–750) ~4.3s   claim.mp4
 */

/* ── Browser frame wrapper ── */
function BrowserFrame({
  children,
  opacity,
  scale,
}: {
  children: React.ReactNode;
  opacity: number;
  scale: number;
}) {
  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        width: 1100,
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
        background: COLORS.bg,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: 6, background: "#ff5f57" }} />
        <div style={{ width: 12, height: 12, borderRadius: 6, background: "#febc2e" }} />
        <div style={{ width: 12, height: 12, borderRadius: 6, background: "#28c840" }} />
        <div
          style={{
            marginLeft: 16,
            padding: "4px 24px",
            borderRadius: 6,
            background: COLORS.bgCard,
            fontSize: 12,
            color: COLORS.muted,
            fontFamily: MONO,
          }}
        >
          localhost:5175
        </div>
      </div>
      {/* Content */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "16/9.5", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

/* ── Phase label ── */
function PhaseLabel({ text, frame }: { text: string; frame: number }) {
  const { fps } = useVideoConfig();
  const prog = spring({ frame, fps, config: { damping: 20, stiffness: 160 } });
  const op = interpolate(prog, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        left: "50%",
        transform: "translateX(-50%)",
        opacity: op,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 3,
        color: COLORS.muted,
        textTransform: "uppercase" as const,
        fontFamily: INTER,
        zIndex: 10,
      }}
    >
      {text}
    </div>
  );
}

export const DemoFlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase transitions
  const p1Op = interpolate(frame, [0, 15, 170, 195], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const p1Scale = interpolate(frame, [0, 15], [0.96, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const p2Op = interpolate(frame, [190, 210, 360, 385], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const p2Scale = interpolate(frame, [190, 210], [0.96, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const p3Op = interpolate(frame, [380, 400, 600, 625], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const p3Scale = interpolate(frame, [380, 400], [0.96, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const p4Prog = spring({ frame: frame - 630, fps, config: { damping: 16, stiffness: 140 } });
  const p4Op = interpolate(p4Prog, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
  const p4Scale = interpolate(p4Prog, [0, 1], [0.93, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(ellipse at 50% 40%, #0a1a0a 0%, ${COLORS.bg} 65%)`,
        fontFamily: INTER,
        position: "relative",
      }}
    >
      {/* Phase 1: Connect Wallet */}
      {frame < 200 && (
        <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <PhaseLabel text="Step 1: Passkey Login" frame={frame} />
          <div style={{ marginTop: 70 }}>
            <BrowserFrame opacity={p1Op} scale={p1Scale}>
              <OffthreadVideo
                src={staticFile("passkey.mp4")}
                startFrom={90}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                volume={0}
              />
            </BrowserFrame>
          </div>
        </div>
      )}

      {/* Phase 2: Dashboard — deposit + yield */}
      {frame >= 185 && frame < 390 && (
        <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <PhaseLabel text="Step 2: Deposit & Earn Yield" frame={frame - 190} />
          <div style={{ marginTop: 70 }}>
            <BrowserFrame opacity={p2Op} scale={p2Scale}>
              <OffthreadVideo
                src={staticFile("dashboard.mp4")}
                startFrom={0}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                volume={0}
              />
            </BrowserFrame>
          </div>
        </div>
      )}

      {/* Phase 3: Battle wager */}
      {frame >= 375 && frame < 630 && (
        <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <PhaseLabel text="Step 3: Wager Yield on Battle" frame={frame - 380} />
          <div style={{ marginTop: 70 }}>
            <BrowserFrame opacity={p3Op} scale={p3Scale}>
              <OffthreadVideo
                src={staticFile("battle.mp4")}
                startFrom={120}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                volume={0}
              />
            </BrowserFrame>
          </div>
        </div>
      )}

      {/* Phase 4: Claim Winnings */}
      {frame >= 620 && (
        <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <PhaseLabel text="Step 4: Claim Winnings" frame={frame - 630} />
          <div style={{ marginTop: 70 }}>
            <BrowserFrame opacity={p4Op} scale={p4Scale}>
              <OffthreadVideo
                src={staticFile("claim.mp4")}
                startFrom={0}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                volume={0}
              />
            </BrowserFrame>
          </div>
        </div>
      )}
    </div>
  );
};
