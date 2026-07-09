# Backend Integration Notes

## Environment

```env
VITE_API_BASE_URL=https://liars-dice-backend.onrender.com
VITE_USE_MOCK_BACKEND=false
```

## Integration surface

- `src/config/apiConfig.js` now contains the full Liar's Dice backend contract from the latest API PDF.
- `src/api/client.js` keeps the shared fetch client, Bearer token header, cookie credentials, timeout handling, and 401 refresh retry.
- `src/api/*Api.js` contains endpoint-specific functions for Health, Auth, Tables, Economy, Profile, Rewards, Rooms, Matchmaking, Match, Tournaments, Lucky Pass, and Events.
- `src/services/backendBridge.js` is the UI-safe bridge. Screens call bridge actions instead of raw endpoints.
- `src/App.jsx` normalizes backend payloads into UI state so backend field-name changes do not break screens.

## API groups wired

- Health: `/health`, `/api/health`
- Auth: register, login, guest, refresh, logout, logout-all, profile, session, me, public profile, update profile
- Tables: list, default, play-now, single table details
- Economy: balance, transactions, validate transaction
- Profile: stats, summary, public stats, wallet, transactions
- Daily Rewards: state and claim `day1` to `day7`
- Rooms: list, active, my room, details, create public/private, join by roomCode/roomId/tableId, join by URL param, leave, start match
- Matchmaking: start, current status, queue status, cancel
- Match / Gameplay: state, action, result load/finalize, leave, clear match
- Tournaments: list, details, leaderboard, enter, claim prize, legacy pass compatibility
- Lucky Pass: pass state, upgrade, free reward claim, premium reward claim
- Special Events: list, all missions, event details, event missions, play event, claim event mission

## Recommended frontend call order now implemented

- App startup/session resume: profile, wallet, transactions, tables, rewards, profile summary/stats, rooms, tournaments, pass, events, matchmaking status.
- Main menu data comes from profile summary, wallet, daily rewards, tournaments, pass, and events.
- Room Select uses `/api/tables` instead of old room-tier mocks.
- Play Now posts an empty `{}` body to `/api/matchmaking/start`.
- Table selection posts `{ tableId }` to `/api/matchmaking/start`.
- Matchmaking polls `/api/matchmaking/:queueId/status` when the backend returns a `queueId`.
- Gameplay uses match-specific endpoints when `matchId` exists.
- Win screen uses `/api/match/:matchId/result` when `matchId` exists.
- Create/Join Room uses the new room bodies exactly: `{ name, tableId, maxPlayers }` and `{ roomCode }` / `{ roomId }` / `{ tableId }`.

## Main button handlers

- Login: `backendActions.login`
- Register: `backendActions.register`
- Guest login: `backendActions.loginAsGuest`
- Logout: `backendActions.logout`
- Join room: `backendActions.joinRoom`
- Create room: `backendActions.createRoom`
- Start room match: `backendActions.startRoomMatch`
- Start matchmaking: `backendActions.startMatchmaking`
- Queue status: `backendActions.getQueueStatus`
- Cancel matchmaking: `backendActions.cancelMatchmaking`
- Submit gameplay action: `backendActions.submitGameAction`
- Match result: `backendActions.loadMatchResult` / `backendActions.finalizeMatchResult`
- Daily reward claim: `backendActions.claimDailyReward`
- Tournament enter/details/leaderboard/claim: `backendActions.enterTournament`, `backendActions.getTournament`, `backendActions.getTournamentLeaderboard`, `backendActions.claimTournamentPrize`
- Lucky Pass upgrade/claim: `backendActions.upgradePass`, `backendActions.claimPassReward`
- Special event play/details/missions/claim: `backendActions.playSpecialEvent`, `backendActions.getSpecialEvent`, `backendActions.getEventMissionsByEvent`, `backendActions.claimEventMission`

## Notes

The frontend still keeps all visual assets and layout logic unchanged. This patch is API wiring and payload normalization only.
