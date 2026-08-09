import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base/reset.css';
import './styles/base/layout.css';
import './styles/base/orientation-guard.css';
import './styles/base/asset-boot-screen.css';
import './styles/base/components.css';
import './styles/screens/screens.desktop.css';
import './styles/screens/screens.mobile.css';
import './styles/screens/screens.portrait.css';
import './styles/screens/screens.shared.css';
import './styles/screens/screens.controls.css';

import './styles/gameplay/gameplay.variables.css';
import './styles/gameplay/gameplay.shared.css';
import './styles/gameplay/gameplay.landscape.css';
import './styles/gameplay/gameplay.portrait.css';
import './styles/gameplay/gameplay.states.css';
import './styles/gameplay/gameplay.controls.css';
import './styles/gameplay/opening-coin-flip.css';
import './styles/gameplay/slam-animation.css';
import './styles/gameplay/call-liar-animation.css';
import './styles/gameplay/zai-animation.css';
import './styles/gameplay/fei-animation.css';
import './styles/base/language.css';
import './styles/screens/tutorial.css';

const cleanPath = window.location.pathname.replace(/\/+$/, '') || '/';
const isDirectTutorialRoute = cleanPath.toLowerCase() === '/tutorial';

const root = createRoot(document.getElementById('root'));
const rootModule = isDirectTutorialRoute
  ? import('./TutorialStandaloneApp.jsx')
  : import('./App.jsx');

rootModule
  .then(({ default: RootComponent }) => {
    root.render(
      <React.StrictMode>
        <RootComponent />
      </React.StrictMode>,
    );
  })
  .catch((error) => {
    console.error('Application bootstrap failed', error);
    root.render(
      <div style={{ color: '#fff', background: '#050200', minHeight: '100vh', padding: '32px', fontFamily: 'Arial, sans-serif' }}>
        The application could not be loaded. Open the browser console for details.
      </div>,
    );
  });
