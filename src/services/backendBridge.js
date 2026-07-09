import {
  authApi,
  profileApi,
  roomsApi,
  matchmakingApi,
  rewardsApi,
  achievementsApi,
  economyApi,
  tournamentsApi,
  passApi,
  eventsApi,
  matchApi,
  tablesApi,
  healthApi,
} from '../api/index.js';
import { hasAccessToken } from '../api/client.js';

function emptySessionResponse(payload = {}) {
  return Promise.resolve({ ok: true, ...payload });
}

async function collectSettledPayloads(tasks) {
  const results = await Promise.allSettled(tasks.map((task) => task()));
  return results
    .filter((result) => result.status === 'fulfilled' && result.value)
    .map((result) => result.value);
}

function getEntityId(entity, keys = ['id', '_id', 'key']) {
  if (typeof entity === 'string' || typeof entity === 'number') return entity;
  for (const key of keys) {
    if (entity?.[key]) return entity[key];
  }
  return null;
}


function asCatalogTablePayload(payload = {}, targetKey = 'defaultTable') {
  if (!payload || typeof payload !== 'object') return payload;
  const { selectedTable, table, ...rest } = payload;
  return {
    ...rest,
    [targetKey]: selectedTable || table || payload,
  };
}

async function loadPublicBackendState() {
  return collectSettledPayloads([
    () => healthApi.getApiHealth(),
    () => healthApi.getServerHealth(),
  ]);
}

async function loadGameData() {
  return collectSettledPayloads([
    () => profileApi.getProfile(),
    () => authApi.getSession(),
    () => authApi.getMe(),
    () => profileApi.getSummary(),
    () => profileApi.getStats(),
    () => profileApi.getWallet(),
    () => profileApi.getTransactions({ limit: 20 }),
    () => economyApi.getBalance(),
    () => economyApi.getTransactions({ limit: 20 }),
    () => roomsApi.getRoomTiers({ includePrivate: true }),
    () => tablesApi.getTables({ includePrivate: true }),
    () => tablesApi.getDefaultTable().then((payload) => asCatalogTablePayload(payload, 'defaultTable')),
    () => tablesApi.getPlayNowTable().then((payload) => asCatalogTablePayload(payload, 'playNowTable')),
    () => roomsApi.getRooms(),
    () => roomsApi.getActiveRooms(),
    () => roomsApi.getMyRoom(),
    () => rewardsApi.getDailyRewards(),
    () => achievementsApi.getAchievements(),
    () => tournamentsApi.getTournaments(),
    () => passApi.getPass(),
    () => tournamentsApi.getTournamentPass(),
    () => eventsApi.getSpecialEvents(),
    () => eventsApi.getEventMissions(),
    () => matchmakingApi.getMatchmakingStatus(),
  ]);
}

async function withFreshGameData(action) {
  const result = await action();
  const gameDataPayloads = [result, ...(await loadGameData())];
  return { ...result, gameDataPayloads };
}

async function withFallback(primaryAction, fallbackAction) {
  try {
    return await primaryAction();
  } catch (error) {
    if (!fallbackAction) throw error;
    return fallbackAction(error);
  }
}

export const backendBridge = {
  isLiveBackend: true,
  loadPublicBackendState,
  loadGameData,

  refreshGameData: () => loadGameData().then((gameDataPayloads) => ({ success: true, gameDataPayloads })),

  refreshRooms: () => collectSettledPayloads([
    () => roomsApi.getRooms(),
    () => roomsApi.getActiveRooms(),
    () => roomsApi.getMyRoom(),
  ]).then((gameDataPayloads) => ({ success: true, gameDataPayloads })),

  resumeSession: () => {
    if (!hasAccessToken()) return emptySessionResponse({ noSession: true });
    return withFreshGameData(() => profileApi.getProfile());
  },

  login: (credentials) => withFreshGameData(() => authApi.loginUser(credentials)),

  register: (payload) => withFreshGameData(() => authApi.registerUser(payload)),

  loginAsGuest: () => withFreshGameData(() => authApi.loginAsGuest()),

  logout: () => authApi.logoutUser(),

  logoutAll: () => authApi.logoutAllSessions(),

  getSession: () => withFreshGameData(() => authApi.getSession()),

  updateProfile: (payload) => withFreshGameData(() => profileApi.updateProfile(payload)),

  getProfileStats: (userId) => withFreshGameData(() => (userId ? profileApi.getPublicStats(userId) : profileApi.getStats())),

  getProfileSummary: () => withFreshGameData(() => profileApi.getSummary()),

  getTables: () => withFreshGameData(() => tablesApi.getTables({ includePrivate: true })),

  getDefaultTable: () => withFreshGameData(() => tablesApi.getDefaultTable()),

  getPlayNowTable: () => withFreshGameData(() => tablesApi.getPlayNowTable()),

  getTable: (table) => {
    const tableId = getEntityId(table, ['tableId', 'tierId', 'id', 'key']);
    return withFreshGameData(() => tablesApi.getTable(tableId));
  },

  joinRoom: (room) => withFreshGameData(() => roomsApi.joinRoom(room)),

  joinRoomById: (room) => withFreshGameData(() => roomsApi.joinRoomById(room)),

  createRoom: (settings) => withFreshGameData(() => roomsApi.createRoom(settings)),

  startBotsMatch: (settings) => withFreshGameData(() => roomsApi.startBotsMatch(settings)),

  getRoom: (room) => withFreshGameData(() => roomsApi.getRoom(room)),

  getMyRoom: () => withFreshGameData(() => roomsApi.getMyRoom()),

  leaveRoom: (room) => withFreshGameData(() => roomsApi.leaveRoom(room)),

  setRoomReady: (room, ready = true) => withFreshGameData(() => roomsApi.setRoomReady(room, ready)),

  startRoomMatch: (room, payload) => withFreshGameData(() => roomsApi.startRoom(room, payload)),

  startMatchmaking: (payload) => withFreshGameData(() => matchmakingApi.startMatchmaking(payload)),

  getMatchmakingStatus: () => withFreshGameData(() => matchmakingApi.getMatchmakingStatus()),

  getQueueStatus: (queueId) => withFreshGameData(() => matchmakingApi.getQueueStatus(queueId)),

  cancelMatchmaking: () => withFreshGameData(() => matchmakingApi.cancelMatchmaking()),

  getAchievements: () => withFreshGameData(() => achievementsApi.getAchievements()),

  claimAchievement: (achievement) => {
    const achievementId = getEntityId(achievement, ['achievementId', 'id', '_id', 'key']);
    return withFreshGameData(() => achievementsApi.claimAchievement(achievementId));
  },

  claimDailyReward: (reward) => {
    const rewardId = getEntityId(reward, ['id', 'key', 'rewardId']);
    return withFreshGameData(() => rewardsApi.claimDailyReward(rewardId));
  },

  refreshEconomy: () => withFreshGameData(() => economyApi.getBalance()),

  getTransactions: (options) => economyApi.getTransactions(options),

  validateTransaction: (payload) => economyApi.validateTransaction(payload),

  enterTournament: (tournament) => {
    const tournamentId = getEntityId(tournament, ['tournamentId', 'id', 'key']);
    return withFreshGameData(() => tournamentsApi.enterTournament(tournamentId));
  },

  getTournament: (tournament) => {
    const tournamentId = getEntityId(tournament, ['tournamentId', 'id', 'key']);
    return withFreshGameData(() => tournamentsApi.getTournament(tournamentId));
  },

  getTournamentLeaderboard: (tournament) => {
    const tournamentId = getEntityId(tournament, ['tournamentId', 'id', 'key']);
    return withFreshGameData(() => tournamentsApi.getTournamentLeaderboard(tournamentId));
  },

  claimTournamentPrize: (tournament) => {
    const tournamentId = getEntityId(tournament, ['tournamentId', 'id', 'key']);
    return withFreshGameData(() => tournamentsApi.claimTournamentPrize(tournamentId));
  },

  upgradePass: () => withFreshGameData(() => withFallback(
    () => passApi.upgradePass(),
    () => tournamentsApi.upgradePass(),
  )),

  claimPassReward: ({ level, type = 'free' } = {}) => withFreshGameData(() => {
    if (type === 'premium') return passApi.claimPremiumReward(level);
    return passApi.claimFreeReward(level);
  }),

  playSpecialEvent: (event) => {
    const eventId = getEntityId(event, ['eventId', 'id', 'key']);
    return withFreshGameData(() => eventsApi.playSpecialEvent(eventId));
  },

  getSpecialEvent: (event) => {
    const eventId = getEntityId(event, ['eventId', 'id', 'key']);
    return withFreshGameData(() => eventsApi.getSpecialEvent(eventId));
  },

  getEventMissionsByEvent: (event) => {
    const eventId = getEntityId(event, ['eventId', 'id', 'key']);
    return withFreshGameData(() => eventsApi.getEventMissionsByEvent(eventId));
  },

  claimEventMission: (event, mission) => {
    const eventId = getEntityId(event, ['eventId', 'id', 'key']);
    const missionId = getEntityId(mission, ['missionId', 'id', 'key']);
    return withFreshGameData(() => eventsApi.claimEventMission(eventId, missionId));
  },

  getMatchState: (matchId) => withFreshGameData(() => matchApi.getMatchState(matchId)),

  submitGameAction: (action) => withFreshGameData(() => matchApi.submitMatchAction(action, action?.matchId)),

  getMatchResult: (matchId, query) => withFreshGameData(() => matchApi.getMatchResult(matchId, query)),

  submitMatchResult: (payload = {}) => withFreshGameData(() => matchApi.submitMatchResult(payload, payload?.matchId)),

  leaveMatch: (matchId) => withFreshGameData(() => matchApi.leaveMatch(matchId)),

  clearMatch: (matchId) => withFreshGameData(() => matchApi.clearMatch(matchId)),
};
