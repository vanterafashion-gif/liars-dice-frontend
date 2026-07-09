import { API_ENDPOINTS } from '../config/apiConfig.js';
import { apiRequest } from './client.js';

const BOT_MODE_ALIASES = new Set(['bot', 'bots', 'pve', 'ai', 'cpu', 'computer', 'solo', 'singleplayer', 'single-player', 'vs-bot', 'vs-bots']);

function isBotsModeValue(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!normalized) return false;
  return BOT_MODE_ALIASES.has(normalized) || normalized.split('-').some((part) => BOT_MODE_ALIASES.has(part));
}

function isBotsPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') return false;
  return Boolean(
    payload.botsEnabled ||
    payload.playWithBots ||
    payload.withBots ||
    [payload.roomMode, payload.gameMode, payload.playMode, payload.selectedRoomMode, payload.mode, payload.selectedMode, payload.roomType, payload.type, payload.tableId, payload.tierId, payload.key, payload.title].some(isBotsModeValue)
  );
}

function normalizeStartPayload(payload = {}) {
  const tableId = payload.tableId || payload.selectedTableId || payload.tierId || null;
  const normalized = tableId ? { tableId } : {};
  if (isBotsPayload(payload)) {
    return {
      ...payload,
      ...normalized,
      tableId: tableId || payload.key || 'bots',
      mode: 'bots',
      selectedMode: 'bots',
      roomMode: 'bots',
      gameMode: 'bots',
      playMode: 'bots',
      roomType: 'pve',
      botsEnabled: true,
      playWithBots: true,
      withBots: true,
      directStart: true,
      startImmediately: true,
      shouldEnterGame: true,
    };
  }
  return normalized;
}

export const startMatchmaking = (payload = {}) => apiRequest(
  isBotsPayload(payload) ? API_ENDPOINTS.matchmaking.startBots : API_ENDPOINTS.matchmaking.start,
  {
    method: 'POST',
    body: normalizeStartPayload(payload),
  },
);

export const startBotsMatchmaking = (payload = {}) => apiRequest(API_ENDPOINTS.matchmaking.startBots, {
  method: 'POST',
  body: normalizeStartPayload({ ...payload, roomMode: 'bots', botsEnabled: true }),
});

export const getMatchmakingStatus = () => apiRequest(API_ENDPOINTS.matchmaking.status);

export const getQueueStatus = (queueId) => {
  if (!queueId) throw new Error('queueId is required');
  return apiRequest(API_ENDPOINTS.matchmaking.queueStatus(queueId));
};

export const cancelMatchmaking = () => apiRequest(API_ENDPOINTS.matchmaking.cancel, { method: 'POST', body: {} });
