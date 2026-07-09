export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://liars-dice-backend.onrender.com').replace(/\/$/, '');

export const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);

const encodePath = (value) => encodeURIComponent(String(value));

export const API_ENDPOINTS = {
  health: {
    server: '/health',
    api: '/api/health',
  },
  auth: {
    register: '/api/auth/register',
    login: '/api/auth/login',
    guest: '/api/auth/guest',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
    logoutAll: '/api/auth/logout-all',
    profile: '/api/auth/profile',
    session: '/api/auth/session',
    me: '/api/auth/me',
    publicProfile: (userId) => `/api/auth/profile/${encodePath(userId)}`,
    updateProfile: '/api/auth/profile',
  },
  tables: {
    list: '/api/tables',
    default: '/api/tables/default',
    playNow: '/api/tables/play-now',
    details: (tableId) => `/api/tables/${encodePath(tableId)}`,
  },
  economy: {
    balance: '/api/economy/balance',
    transactions: '/api/economy/transactions',
    validateTransaction: '/api/economy/validate-transaction',
  },
  profile: {
    me: '/api/auth/profile',
    update: '/api/auth/profile',
    public: (userId) => `/api/auth/profile/${encodePath(userId)}`,
    stats: '/api/profile/stats',
    summary: '/api/profile/summary',
    publicStats: (userId) => `/api/profile/stats/${encodePath(userId)}`,
    wallet: '/api/profile/wallet',
    transactions: '/api/profile/transactions',
  },
  rewards: {
    daily: '/api/rewards/daily',
    claimDaily: (rewardId) => `/api/rewards/daily/${encodePath(rewardId)}/claim`,
  },
  achievements: {
    list: '/api/achievements',
    claim: (achievementId) => `/api/achievements/claim/${encodePath(achievementId)}`,
  },
  rooms: {
    list: '/api/rooms',
    active: '/api/rooms/active',
    my: '/api/rooms/my',
    details: (roomId) => `/api/rooms/${encodePath(roomId)}`,
    create: '/api/rooms',
    createPrivate: '/api/rooms/private',
    bots: '/api/rooms/bots',
    bot: '/api/rooms/bot',
    join: '/api/rooms/join',
    joinById: (roomId) => `/api/rooms/${encodePath(roomId)}/join`,
    leave: (roomId) => `/api/rooms/${encodePath(roomId)}/leave`,
    ready: (roomId) => `/api/rooms/${encodePath(roomId)}/ready`,
    start: (roomId) => `/api/rooms/${encodePath(roomId)}/start`,
    // Backward compatibility with older frontend patches. New table data comes from /api/tables.
    tiers: '/api/rooms/tiers',
  },
  matchmaking: {
    start: '/api/matchmaking/start',
    startBots: '/api/matchmaking/bots/start',
    status: '/api/matchmaking/status',
    queueStatus: (queueId) => `/api/matchmaking/${encodePath(queueId)}/status`,
    cancel: '/api/matchmaking/cancel',
  },
  match: {
    state: '/api/match/state',
    stateById: (matchId) => `/api/match/${encodePath(matchId)}/state`,
    action: '/api/match/action',
    actionById: (matchId) => `/api/match/${encodePath(matchId)}/action`,
    result: '/api/match/result',
    resultById: (matchId) => `/api/match/${encodePath(matchId)}/result`,
    leave: '/api/match/leave',
    leaveById: (matchId) => `/api/match/${encodePath(matchId)}/leave`,
    clearById: (matchId) => `/api/match/${encodePath(matchId)}`,
  },
  tournaments: {
    list: '/api/tournaments',
    details: (tournamentId) => `/api/tournaments/${encodePath(tournamentId)}`,
    leaderboard: (tournamentId) => `/api/tournaments/${encodePath(tournamentId)}/leaderboard`,
    enter: (tournamentId) => `/api/tournaments/${encodePath(tournamentId)}/enter`,
    claim: (tournamentId) => `/api/tournaments/${encodePath(tournamentId)}/claim`,
    legacyPass: '/api/tournaments/pass',
    legacyUpgradePass: '/api/tournaments/pass/upgrade',
  },
  pass: {
    state: '/api/pass',
    upgrade: '/api/pass/upgrade',
    claimFree: (level) => `/api/pass/rewards/${encodePath(level)}/free/claim`,
    claimPremium: (level) => `/api/pass/rewards/${encodePath(level)}/premium/claim`,
  },
  events: {
    list: '/api/events',
    missions: '/api/events/missions',
    details: (eventId) => `/api/events/${encodePath(eventId)}`,
    eventMissions: (eventId) => `/api/events/${encodePath(eventId)}/missions`,
    play: (eventId) => `/api/events/${encodePath(eventId)}/play`,
    claimMission: (eventId, missionId) => `/api/events/${encodePath(eventId)}/missions/${encodePath(missionId)}/claim`,
  },
};
