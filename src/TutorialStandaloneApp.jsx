import { useEffect, useMemo } from 'react';
import { useFixedViewport } from './hooks.js';
import TutorialScreen from './screens/TutorialScreen.jsx';

export default function TutorialStandaloneApp() {
  const layout = useFixedViewport();

  useEffect(() => {
    document.documentElement.dataset.device = layout.mode;
    document.documentElement.dataset.physicalDevice = layout.deviceMode || layout.mode;
    document.documentElement.dataset.orientation = layout.orientation;
  }, [layout.mode, layout.deviceMode, layout.orientation]);

  const appStyle = useMemo(() => ({
    '--design-width': `${layout.resolution.width}px`,
    '--design-height': `${layout.resolution.height}px`,
    '--ui-scale': layout.scale,
  }), [layout]);

  const navigation = useMemo(() => ({
    goMainMenu: () => window.location.assign('/main-menu'),
  }), []);

  return (
    <main
      className={`app-shell app-shell--${layout.mode} app-shell--tutorial`}
      style={appStyle}
    >
      <div className="game-frame">
        <TutorialScreen navigation={navigation} orientation={layout.orientation} />
      </div>
    </main>
  );
}
