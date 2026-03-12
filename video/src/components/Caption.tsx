import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../constants";
import { INTER } from "../fonts";

interface CaptionEntry {
  text: string;
  start: number;
  end: number;
}

export const CaptionTrack: React.FC<{ captions: CaptionEntry[] }> = ({ captions }) => {
  const frame = useCurrentFrame();

  const active = captions.find((c) => frame >= c.start - 5 && frame <= c.end + 3);
  if (!active) return null;

  const fadeIn = interpolate(frame, [active.start - 5, active.start + 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [active.end - 5, active.end + 3], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity: fadeIn * fadeOut,
        zIndex: 100,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: INTER,
          fontSize: 28,
          fontWeight: 600,
          color: COLORS.white,
          textAlign: "center",
          padding: "12px 32px",
          background: "rgba(0, 0, 0, 0.75)",
          borderRadius: 10,
          maxWidth: 900,
          lineHeight: 1.4,
          textShadow: "0 2px 8px rgba(0,0,0,0.8)",
          backdropFilter: "blur(4px)",
        }}
      >
        {active.text}
      </div>
    </div>
  );
};
