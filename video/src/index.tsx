import { Composition, registerRoot } from "remotion";
import { FloatDemo } from "./FloatDemo";
import { FPS, W, H } from "./constants";

const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="FloatDemo"
      component={FloatDemo}
      durationInFrames={3270}
      fps={FPS}
      width={W}
      height={H}
    />
  </>
);

registerRoot(RemotionRoot);
