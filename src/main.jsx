import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

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
import './styles/base/language.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
