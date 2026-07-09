import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

import './styles/base/reset.css';
import './styles/base/layout.css';
import './styles/base/orientation-guard.css';
import './styles/base/asset-boot-screen.css';
import './styles/base/components.css';
import './styles/desktop/starter-screen.css';
import './styles/desktop/login-screen.css';
import './styles/desktop/loading-screen.css';
import './styles/mobile/starter-screen.mobile.css';
import './styles/mobile/login-screen.mobile.css';
import './styles/mobile/loading-screen.mobile.css';

import './styles/desktop/main-menu.css';
import './styles/desktop/create-room.css';
import './styles/desktop/join-room.css';
import './styles/desktop/room-lobby.css';
import './styles/desktop/gameplay.css';
import './styles/desktop/matchmaking.css';
import './styles/desktop/room-select.css';
import './styles/desktop/win-screen.css';
import './styles/desktop/help-screen.css';
import './styles/base/help-poster.css';
import './styles/desktop/profile-screen.css';
import './styles/desktop/special-event.css';
import './styles/desktop/daily-reward.css';
import './styles/desktop/tournament-pass.css';
import './styles/mobile/main-menu.mobile.css';
import './styles/mobile/create-room.mobile.css';
import './styles/mobile/join-room.mobile.css';
import './styles/mobile/room-lobby.mobile.css';
import './styles/mobile/gameplay.mobile.css';
import './styles/mobile/matchmaking.mobile.css';
import './styles/mobile/room-select.mobile.css';
import './styles/mobile/win-screen.mobile.css';
import './styles/mobile/help-screen.mobile.css';
import './styles/mobile/profile-screen.mobile.css';
import './styles/mobile/special-event.mobile.css';
import './styles/mobile/daily-reward.mobile.css';
import './styles/mobile/tournament-pass.mobile.css';
import './styles/mobile/portrait-main.mobile.css';
import './styles/mobile/portrait-loading.mobile.css';
import './styles/mobile/portrait-rooms.mobile.css';
import './styles/mobile/portrait-gameplay.mobile.css';
import './styles/mobile/portrait-gameplay-layout-correction.mobile.css';
import './styles/mobile/portrait-gameplay-player-tuning.mobile.css';
import './styles/mobile/portrait-mainmenu-reference.mobile.css';
import './styles/mobile/portrait-backgrounds.mobile.css';
import './styles/mobile/portrait-chrome-starter.mobile.css';
import './styles/mobile/portrait-chrome-mainmenu.mobile.css';
import './styles/mobile/portrait-login-no-avatar.mobile.css';
import './styles/mobile/portrait-secondary-pages-fix.mobile.css';
import './styles/mobile/portrait-daily-reward-uncompressed.mobile.css';
import './styles/mobile/portrait-matchmaking-fix.mobile.css';
import './styles/mobile/portrait-win-screen-fix.mobile.css';
import './styles/mobile/portrait-tournament-pass-fix.mobile.css';

import './styles/mobile/mobile-landscape-browser-fix.css';
import './styles/base/gameplay-chat.css';
import './styles/base/gameplay-music-control.css';
import './styles/base/bots-mode.css';
import './styles/base/create-room-responsive-layout.css';
import './styles/mobile/portrait-gameplay-final-reference.mobile.css';
import './styles/base/gameplay-turn-intro.css';
import './styles/mobile/portrait-gameplay-actions-manual.mobile.css';

import './styles/base/gameplay-chinese-layout-fix.css';
import './styles/mobile/gameplay-round-result-manual.mobile.css';
import './styles/base/gameplay-zai-timer-patch.css';
import './styles/mobile/portrait-gameplay-manual-controls.mobile.css';
import './styles/mobile/portrait-gameplay-background-blur.mobile.css';
import './styles/base/current-bid-time-reminder-style.css';
import './styles/base/bid-selector-transparency-controls.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
