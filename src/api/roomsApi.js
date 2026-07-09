import { API_ENDPOINTS } from '../config/apiConfig.js';
import { apiRequest } from './client.js';

function withQuery(endpoint, query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const queryString = params.toString();
  return `${endpoint}${queryString ? `?${queryString}` : ''}`;
}

function getRoomIdentifier(room) {
  if (typeof room === 'string') return room;
  return room?.roomId || room?.id || room?.roomCode || room?.code || room?.key || room?.tierId || room?.tableId || null;
}

function looksLikeRoomCode(value) {
  const text = String(value || '').trim();
  return /^LD[-A-Z0-9]*\d/i.test(text) || /^[A-Z0-9]{4,10}$/.test(text);
}

const MIN_BUY_IN = 5;
const MIN_RANGE_PER_GAME_BASE = 5;
const MIN_STATIC_PER_GAME = 5;
const PEK_PERCENTAGE_OPTIONS = [0, 25, 50, 100];

function numericSetting(settings = {}, keys = [], fallback = undefined) {
  for (const key of keys) {
    const value = settings[key];
    if (value === undefined || value === null || value === '') continue;
    const numeric = Number(String(value).replace(/,/g, '').trim());
    if (Number.isFinite(numeric)) return Math.max(0, Math.trunc(numeric));
  }
  return fallback;
}

function cleanCoinBetOptions(options = [], min = 0, max = Infinity) {
  if (!Array.isArray(options)) return [];
  return Array.from(new Set(options
    .map((value) => Number(String(value).replace(/,/g, '').trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.trunc(value))))
    .filter((value) => value >= min && value <= max)
    .sort((left, right) => left - right);
}

function normalizePerGameMode(value) {
  const normalized = String(value || 'static').trim().toLowerCase();
  return normalized === 'range' ? 'range' : 'static';
}

function buildRangeCoinBetOptions(baseAmount) {
  const base = Math.max(MIN_RANGE_PER_GAME_BASE, Number(baseAmount) || MIN_RANGE_PER_GAME_BASE);
  const low = Math.max(MIN_STATIC_PER_GAME, Math.floor(base * 0.2));
  const mid = Math.max(low, Math.floor(base * 0.4));
  return Array.from(new Set([low, mid, base])).sort((left, right) => left - right);
}

function normalizePekPercentage(value, fallback = 25) {
  const number = Number(String(value || '').replace(/[^0-9]/g, '').trim());
  return PEK_PERCENTAGE_OPTIONS.includes(number) ? number : fallback;
}

function booleanSetting(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 1 || value === '1') return true;
  const normalized = String(value).trim().toLowerCase();
  if (['true', 'on', 'yes', 'enabled'].includes(normalized)) return true;
  if (['false', 'off', 'no', 'disabled', '0'].includes(normalized)) return false;
  return fallback;
}

const BOT_MODE_ALIASES = new Set(['bot', 'bots', 'pve', 'ai', 'cpu', 'computer', 'solo', 'singleplayer', 'single-player', 'vs-bot', 'vs-bots']);

function normalizeModeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function isBotsModeValue(value) {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeModeText(value);
  if (!normalized) return false;
  if (BOT_MODE_ALIASES.has(normalized)) return true;
  return normalized.split('-').some((part) => BOT_MODE_ALIASES.has(part));
}

function isBotsModeSettings(settings = {}) {
  if (!settings || typeof settings !== 'object') return false;

  const botFlags = [
    settings.botsEnabled,
    settings.playWithBots,
    settings.withBots,
    settings.hasBots,
    settings.useBots,
    settings.isBotMatch,
    settings.isBotsMatch,
  ];
  if (botFlags.some((value) => value === true || value === 1 || value === '1' || String(value).trim().toLowerCase() === 'true')) return true;

  return [
    settings.roomMode,
    settings.gameMode,
    settings.playMode,
    settings.selectedRoomMode,
    settings.mode,
    settings.selectedMode,
    settings.roomType,
    settings.type,
    settings.matchType,
    settings.queueType,
    settings.tableId,
    settings.tierId,
    settings.key,
    settings.slug,
    settings.title,
    settings.name,
    settings.label,
  ].some(isBotsModeValue);
}

function normalizeCreateRoomPayload(settings = {}) {
  const name = settings.name || settings.roomName || settings.title || 'Private Room';
  const isPrivate = settings.isPrivate !== false && String(settings.isPrivate).toLowerCase() !== 'false';
  // Create Room is a custom-room flow. The private toggle controls visibility only;
  // the custom players/timer/buy-in rules should stay custom whether the room is public or private.
  const roomMode = isBotsModeSettings(settings) ? 'bots' : 'normal';
  const tableId = settings.tableId || settings.selectedTableId || settings.tierId || 'private';
  const maxPlayers = Number(settings.maxPlayers || settings.selectedPlayers || settings.playersCount || 4);
  const safeMaxPlayers = Number.isFinite(maxPlayers) ? Math.min(Math.max(maxPlayers, 2), 4) : 4;

  const rawBuyInAmount = numericSetting(settings, ['buyInAmount', 'buyInCoins', 'customBuyIn', 'customStake', 'stakeAmount', 'stake', 'entryFee'], MIN_BUY_IN);
  const buyInAmount = Math.max(MIN_BUY_IN, rawBuyInAmount);
  const perGameMode = normalizePerGameMode(settings.perGameMode || settings.coinBetMode || settings.betMode);
  const pekEnabled = true;
  const pekPercentage = normalizePekPercentage(settings.pekPercentage ?? settings.slamPercentage ?? settings.pekPercent ?? settings.slamPercent, 25);
  const bidCoinStep = numericSetting(settings, ['bidCoinStep', 'coinBidStep']);

  let perGameBase = numericSetting(settings, ['perGameBase', 'rangeBase', 'maxCoinBet', 'maxBidCoins'], buyInAmount);
  perGameBase = Math.min(buyInAmount, Math.max(MIN_RANGE_PER_GAME_BASE, perGameBase));

  let coinBetOptions;
  let selectedPerGame;

  if (perGameMode === 'range') {
    const providedOptions = cleanCoinBetOptions(settings.coinBetOptions, MIN_STATIC_PER_GAME, buyInAmount);
    coinBetOptions = providedOptions.length ? providedOptions.slice(0, 3) : buildRangeCoinBetOptions(perGameBase);
    perGameBase = Math.max(...coinBetOptions);
    selectedPerGame = numericSetting(settings, ['selectedPerGame', 'perGameAmount', 'perGameCoins', 'roundStake', 'roundStakeAmount', 'defaultCoinBet', 'defaultBidCoins'], coinBetOptions[0]);
    if (!coinBetOptions.includes(selectedPerGame)) selectedPerGame = coinBetOptions[0];
  } else {
    selectedPerGame = numericSetting(settings, ['selectedPerGame', 'perGameAmount', 'perGameCoins', 'roundStake', 'roundStakeAmount', 'baseStake', 'baseBet', 'gameAmount', 'gameStake', 'defaultCoinBet', 'defaultBidCoins', 'minCoinBet', 'minBidCoins', 'minBet', 'minimumBet'], MIN_STATIC_PER_GAME);
    selectedPerGame = Math.min(buyInAmount, Math.max(MIN_STATIC_PER_GAME, selectedPerGame));
    perGameBase = selectedPerGame;
    coinBetOptions = [selectedPerGame];
  }

  const minCoinBet = coinBetOptions[0];
  const maxCoinBet = coinBetOptions[coinBetOptions.length - 1];
  const defaultCoinBet = selectedPerGame;
  const finalPekAmount = selectedPerGame + Math.floor((selectedPerGame * pekPercentage) / 100);

  const payload = {
    name,
    tableId,
    isPrivate,
    visibility: isPrivate ? 'private' : 'public',
    maxPlayers: safeMaxPlayers,
    selectedPlayers: safeMaxPlayers,
    requiredPlayers: safeMaxPlayers,
    playersCount: safeMaxPlayers,
    roomMode,
    gameMode: roomMode,
    playMode: roomMode,
    selectedRoomMode: roomMode,
    mode: roomMode === 'bots' ? 'bots' : 'normal',
    selectedMode: roomMode === 'bots' ? 'bots' : 'normal',
    roomType: roomMode === 'bots' ? 'pve' : 'normal',
    directStart: roomMode === 'bots',
    startImmediately: roomMode === 'bots',
    shouldEnterGame: roomMode === 'bots',
    botsEnabled: roomMode === 'bots',
    playWithBots: roomMode === 'bots',
    withBots: roomMode === 'bots',
    startingCups: 5,
    startingDice: 5,
    dicePerPlayer: 5,
    dicePerRound: 5,
    turnTimer: Number(settings.turnTimer || String(settings.selectedTimer || '').replace(/[^0-9]/g, '') || 30) || 30,
    bidStyle: 'Official Rules',
    buyInAmount,
    buyInCoins: buyInAmount,
    customBuyIn: buyInAmount,
    customStake: buyInAmount,
    entryFee: buyInAmount,
    perGameMode,
    coinBetMode: perGameMode,
    perGameBase,
    selectedPerGame,
    perGameAmount: selectedPerGame,
    perGameCoins: selectedPerGame,
    roundStake: selectedPerGame,
    minCoinBet,
    minBidCoins: minCoinBet,
    maxCoinBet,
    maxBidCoins: maxCoinBet,
    defaultCoinBet,
    defaultBidCoins: defaultCoinBet,
    coinBetOptions,
    pekEnabled,
    slamEnabled: pekEnabled,
    pekPercentage,
    slamPercentage: pekPercentage,
    finalPekAmount,
    finalSlamAmount: finalPekAmount,
    requiredPekCoverAmount: pekEnabled ? finalPekAmount : selectedPerGame,
    maxChallengeAmount: pekEnabled ? finalPekAmount : selectedPerGame,
  };

  payload.pricing = {
    buyInAmount,
    buyInCoins: buyInAmount,
    entryFee: buyInAmount,
    startingStack: buyInAmount,
    minBuyIn: MIN_BUY_IN,
    maxBuyIn: 0,
    perGameMode,
    coinBetMode: perGameMode,
    perGameBase,
    perGameOptions: coinBetOptions,
    selectedPerGame,
    selectedPerGameAmount: selectedPerGame,
    perGameAmount: selectedPerGame,
    perGameCoins: selectedPerGame,
    roundStake: selectedPerGame,
    minCoinBet,
    minBidCoins: minCoinBet,
    maxCoinBet,
    maxBidCoins: maxCoinBet,
    defaultCoinBet,
    defaultBidCoins: defaultCoinBet,
    bidCoinStep: bidCoinStep ?? payload.bidCoinStep,
    coinBetOptions,
    pekEnabled,
    slamEnabled: pekEnabled,
    pekPercentage,
    slamPercentage: pekPercentage,
    finalPekAmount,
    finalSlamAmount: finalPekAmount,
    requiredPekCoverAmount: pekEnabled ? finalPekAmount : selectedPerGame,
    maxChallengeAmount: pekEnabled ? finalPekAmount : selectedPerGame,
    pekMultiplier: 1 + (pekPercentage / 100),
  };

  payload.stakeValidationClient = {
    validated: true,
    source: 'frontend_create_room',
    buyInAmount,
    perGameMode,
    perGameBase,
    coinBetOptions,
    selectedPerGame,
    perGameAmount: selectedPerGame,
    pekEnabled,
    pekPercentage,
    finalPekAmount,
  };

  if (bidCoinStep !== undefined) payload.bidCoinStep = bidCoinStep;

  return payload;
}

function normalizeJoinPayload(room = {}) {
  if (typeof room === 'string') {
    return looksLikeRoomCode(room) ? { roomCode: room } : { roomId: room };
  }

  if (room?.roomCode || room?.code) return { roomCode: room.roomCode || room.code };
  if (room?.roomId || room?.id) return { roomId: room.roomId || room.id };
  if (room?.tableId || room?.tierId || room?.key) return { tableId: room.tableId || room.tierId || room.key };

  throw new Error('roomCode, roomId, or tableId is required');
}

export const getRooms = () => apiRequest(API_ENDPOINTS.rooms.list);
export const getRoomTiers = ({ includePrivate = true } = {}) => apiRequest(
  withQuery(API_ENDPOINTS.rooms.tiers, { includePrivate }),
);
export const getActiveRooms = ({ limit } = {}) => apiRequest(withQuery(API_ENDPOINTS.rooms.active, { limit }));
export const getMyRoom = () => apiRequest(API_ENDPOINTS.rooms.my);

export const getRoom = (room) => {
  const roomId = getRoomIdentifier(room);
  if (!roomId) throw new Error('roomId is required');
  return apiRequest(API_ENDPOINTS.rooms.details(roomId));
};

async function requestFirstSupportedEndpoint(requests = []) {
  let lastError = null;

  for (const request of requests) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
      if (![404, 405].includes(Number(error?.status))) throw error;
    }
  }

  throw lastError || new Error('No supported bots endpoint is available');
}

export const startBotsMatch = (settings = {}) => {
  const payload = normalizeCreateRoomPayload({
    ...settings,
    roomMode: 'bots',
    gameMode: 'bots',
    playMode: 'bots',
    selectedRoomMode: 'bots',
    mode: 'bots',
    selectedMode: 'bots',
    roomType: 'pve',
    botsEnabled: true,
    playWithBots: true,
    withBots: true,
    directStart: true,
    startImmediately: true,
    shouldEnterGame: true,
  });

  return requestFirstSupportedEndpoint([
    () => apiRequest(API_ENDPOINTS.rooms.bots, { method: 'POST', body: payload }),
    () => apiRequest(API_ENDPOINTS.rooms.bot, { method: 'POST', body: payload }),
    () => apiRequest(API_ENDPOINTS.matchmaking.startBots, { method: 'POST', body: payload }),
    () => apiRequest(API_ENDPOINTS.matchmaking.start, { method: 'POST', body: payload }),
    () => apiRequest(API_ENDPOINTS.rooms.createPrivate, { method: 'POST', body: payload }),
  ]);
};

export const createRoom = (settings = {}) => {
  const payload = normalizeCreateRoomPayload(settings);
  if (payload.roomMode === 'bots') return startBotsMatch(payload);

  const endpoint = payload.isPrivate === false ? API_ENDPOINTS.rooms.create : API_ENDPOINTS.rooms.createPrivate;
  return apiRequest(endpoint, {
    method: 'POST',
    body: payload,
  });
};

export const joinRoom = (room) => apiRequest(API_ENDPOINTS.rooms.join, {
  method: 'POST',
  body: normalizeJoinPayload(room),
});

export const joinRoomById = (room) => {
  const roomId = getRoomIdentifier(room);
  if (!roomId) throw new Error('roomId is required');
  return apiRequest(API_ENDPOINTS.rooms.joinById(roomId), {
    method: 'POST',
    body: {},
  });
};

export const leaveRoom = (room) => {
  const roomId = getRoomIdentifier(room);
  if (!roomId) throw new Error('roomId is required');
  return apiRequest(API_ENDPOINTS.rooms.leave(roomId), {
    method: 'POST',
    body: {},
  });
};


export const setRoomReady = (room, ready = true) => {
  const roomId = getRoomIdentifier(room);
  if (!roomId) throw new Error('roomId is required');
  return apiRequest(API_ENDPOINTS.rooms.ready(roomId), {
    method: 'POST',
    body: { ready: Boolean(ready) },
  });
};

export const startRoom = (room, payload = {}) => {
  const roomId = getRoomIdentifier(room);
  if (!roomId) throw new Error('roomId is required');
  return apiRequest(API_ENDPOINTS.rooms.start(roomId), {
    method: 'POST',
    body: payload && Object.keys(payload).length ? payload : {},
  });
};
