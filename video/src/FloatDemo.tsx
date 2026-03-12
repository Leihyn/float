import { AbsoluteFill, Audio, Sequence, Series, staticFile } from "remotion";
import { COLORS } from "./constants";
import { Hook } from "./scenes/Hook";
import { Contrast } from "./scenes/Contrast";
import { Bridge } from "./scenes/Bridge";
import { HowItWorks } from "./scenes/HowItWorks";
import { DemoFlow } from "./scenes/DemoFlow";
import { Architecture } from "./scenes/Architecture";
import { Close } from "./scenes/Close";
import { LogoWatermark } from "./components/LogoWatermark";
import { CaptionTrack } from "./components/Caption";
import { CAPTIONS } from "./captions";

/**
 * Float Demo Video — ~110s (3270 frames @ 30fps)
 *
 * Timeline:
 *    0 –  450 ( 0:00 – 0:15)  Hook
 *  450 –  750 ( 0:15 – 0:25)  Contrast
 *  750 – 1110 ( 0:25 – 0:37)  Bridge
 * 1110 – 1560 ( 0:37 – 0:52)  How It Works
 * 1560 – 2310 ( 0:52 – 1:17)  Demo Flow
 * 2310 – 2670 ( 1:17 – 1:29)  Architecture
 * 2670 – 3270 ( 1:29 – 1:49)  Close
 */
export const FloatDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <Series>
        <Series.Sequence durationInFrames={450}>
          <Hook />
        </Series.Sequence>
        <Series.Sequence durationInFrames={300}>
          <Contrast />
        </Series.Sequence>
        <Series.Sequence durationInFrames={360}>
          <Bridge />
        </Series.Sequence>
        <Series.Sequence durationInFrames={450}>
          <HowItWorks />
        </Series.Sequence>
        <Series.Sequence durationInFrames={750}>
          <DemoFlow />
        </Series.Sequence>
        <Series.Sequence durationInFrames={360}>
          <Architecture />
        </Series.Sequence>
        <Series.Sequence durationInFrames={600}>
          <Close />
        </Series.Sequence>
      </Series>

      {/* Logo watermark (top-left, all scenes) */}
      <LogoWatermark />

      {/* Captions (bottom-center, timed) */}
      <CaptionTrack captions={CAPTIONS} />

      {/* Voiceover audio segments */}
      <Sequence from={0}><Audio src={staticFile("vo/01-hook.mp3")} volume={1.8} /></Sequence>
      <Sequence from={450}><Audio src={staticFile("vo/02-contrast.mp3")} volume={1.8} /></Sequence>
      <Sequence from={750}><Audio src={staticFile("vo/03-bridge.mp3")} volume={1.8} /></Sequence>
      <Sequence from={1110}><Audio src={staticFile("vo/04-howitworks.mp3")} volume={1.8} /></Sequence>
      <Sequence from={1560}><Audio src={staticFile("vo/05-demo.mp3")} volume={1.8} /></Sequence>
      <Sequence from={2310}><Audio src={staticFile("vo/06-architecture.mp3")} volume={1.8} /></Sequence>
      <Sequence from={2670}><Audio src={staticFile("vo/07-close.mp3")} volume={1.8} /></Sequence>
    </AbsoluteFill>
  );
};
