import React from "react";
import { Img, staticFile, useCurrentFrame, interpolate } from "remotion";
import { INTER } from "../fonts";
import { COLORS } from "../constants";

export const LogoWatermark: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 0.7], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 30,
        left: 36,
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity,
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      <Img
        src={staticFile("logo.jpg")}
        style={{ width: 32, height: 32, borderRadius: 8 }}
      />
      <span
        style={{
          fontFamily: INTER,
          fontSize: 18,
          fontWeight: 700,
          color: COLORS.white,
          letterSpacing: -0.5,
        }}
      >
        Float
      </span>
    </div>
  );
};
