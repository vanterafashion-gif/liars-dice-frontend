import { io } from 'socket.io-client';
import { getAccessToken } from '../api/client.js';
import { API_BASE_URL, API_TIMEOUT_MS } from '../config/apiConfig.js';

const DEFAULT_ACK_TIMEOUT_MS = Math.max(8000, Number(API_TIMEOUT_MS || 15000));

let gameSocket = null;
let matchmakingCleanup = null;
let gameplayCleanup = null;

function normalizeSocketError(error) {
  if (!error) return new Error('Socket error');
  if (typeof error === 'string') return new Error(error);

  const message = error.message
    || error.reason
    || error.description
    || error.data?.message
    || error.payload?.message
    || 'Socket error';

  if (error instanceof Error) {
    error.message = error.message || message;
    return error;
  }

  const normalizedError = new Error(message);
  normalizedError.data = error.data || error.payload || error.details || null;
  normalizedError.payload = error.payload || error.data || null;
  normalizedError.details = error.details || error.data?.details || error.payload?.details || null;
  normalizedError.code = error.code || error.reason || error.details?.code || error.data?.code || error.payload?.code || error.status || null;
  normalizedError.reason = error.reason || error.details?.reason || error.data?.reason || error.payload?.reason || null;
  normalizedError.status = error.status || error.data?.status || error.payload?.status || null;
  return normalizedError;
}

function isGameStartedPayload(payload = {}) {
  const status = String(payload.status || payload.matchStatus || payload.match?.status || '').toLowerCase();
  const stage = String(payload.stage || payload.matchmaking?.stage || '').toLowerCase();
  const nextScreen = String(payload.nextScreen || payload.navigationTarget || payload.nextRoute || '').toLowerCase();

  return Boolean(
    payload.shouldEnterGame
    || payload.directStart
    || payload.startImmediately
    || payload.botsMatchStarted
    || stage === 'game_started'
    || stage === 'bots_match_started'
    || nextScreen === 'gameplay'
    || status === 'active'
    || status === 'in_progress'
    || status === 'started'
    || status === 'in_match'
  );
}

function routeMatchmakingResponse(response = {}, handlers = {}) {
  if (isGameStartedPayload(response)) {
    handlers.onGameStarted?.(response);
    return;
  }

  if (response?.matchId || response?.match?.id || response?.match?.matchId) {
    handlers.onMatchFound?.(response);
    return;
  }

  handlers.onQueueUpdate?.(response || { success: true });
}

function getSocket() {
  const token = getAccessToken();
  if (!token) throw new Error('Missing access token');

  if (gameSocket) {
    gameSocket.auth = { ...(gameSocket.auth || {}), token };
    if (!gameSocket.connected) gameSocket.connect();
    return gameSocket;
  }

  gameSocket = io(API_BASE_URL, {
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 6,
    reconnectionDelay: 800,
    timeout: DEFAULT_ACK_TIMEOUT_MS,
  });

  gameSocket.connect();
  return gameSocket;
}

function emitWithAck(eventName, payload = {}) {
  const socket = getSocket();

  return new Promise((resolve, reject) => {
    socket.timeout(DEFAULT_ACK_TIMEOUT_MS).emit(eventName, payload, (error, response) => {
      if (error) {
        reject(normalizeSocketError(error));
        return;
      }

      if (response && response.success === false) {
        reject(normalizeSocketError(response));
        return;
      }

      resolve(response || { success: true });
    });
  });
}

function clearMatchmakingListeners() {
  if (typeof matchmakingCleanup === 'function') matchmakingCleanup();
  matchmakingCleanup = null;
}

function clearGameplayListeners() {
  if (typeof gameplayCleanup === 'function') gameplayCleanup();
  gameplayCleanup = null;
}

function bindGameplayListeners(handlers = {}) {
  const socket = getSocket();
  clearMatchmakingListeners();
  clearGameplayListeners();

  const listenerPairs = [
    ['server:game_state', handlers.onGameState],
    ['server:game_started', handlers.onGameStarted],
    ['server:round_result', handlers.onRoundResult],
    ['server:game_finished', handlers.onGameFinished],
    ['chat:message', handlers.onChatMessage],
    ['chat:history', handlers.onChatHistory],
    ['chat:error', handlers.onChatError || handlers.onError],
    ['server:error', handlers.onError],
    ['connect_error', handlers.onError],
    ['disconnect', handlers.onDisconnect],
  ].filter(([, handler]) => typeof handler === 'function');

  for (const [eventName, handler] of listenerPairs) {
    socket.on(eventName, handler);
  }

  gameplayCleanup = () => {
    for (const [eventName, handler] of listenerPairs) {
      socket.off(eventName, handler);
    }
  };

  return gameplayCleanup;
}

function bindMatchmakingListeners(handlers = {}) {
  const socket = getSocket();
  clearGameplayListeners();
  clearMatchmakingListeners();

  const listenerPairs = [
    ['server:queue_update', handlers.onQueueUpdate],
    ['server:match_found', handlers.onMatchFound],
    ['server:match_countdown', handlers.onMatchCountdown],
    ['server:game_started', handlers.onGameStarted],
    ['server:queue_cancelled', handlers.onQueueCancelled],
    ['server:error', handlers.onError],
    ['connect_error', handlers.onError],
    ['disconnect', handlers.onDisconnect],
  ].filter(([, handler]) => typeof handler === 'function');

  for (const [eventName, handler] of listenerPairs) {
    socket.on(eventName, handler);
  }

  matchmakingCleanup = () => {
    for (const [eventName, handler] of listenerPairs) {
      socket.off(eventName, handler);
    }
  };

  return matchmakingCleanup;
}


export function getConnectedGameSocket() {
  return getSocket();
}

export function emitSocketEventWithAck(eventName, payload = {}) {
  return emitWithAck(eventName, payload);
}

export function startSocketMatchmaking(payload = {}, handlers = {}) {
  const socket = getSocket();
  bindMatchmakingListeners(handlers);

  let hasJoinedQueue = false;
  let isRejoiningQueue = false;

  const rejoinQueueAfterReconnect = () => {
    if (!hasJoinedQueue || isRejoiningQueue) return;

    isRejoiningQueue = true;
    socket.timeout(DEFAULT_ACK_TIMEOUT_MS).emit('client:join_queue', payload, (error, response) => {
      isRejoiningQueue = false;

      if (error) {
        handlers.onError?.(normalizeSocketError(error));
        return;
      }

      if (response && response.success === false) {
        handlers.onError?.(normalizeSocketError(response));
        return;
      }

      routeMatchmakingResponse(response, handlers);
    });
  };

  socket.on('connect', rejoinQueueAfterReconnect);

  const previousCleanup = matchmakingCleanup;
  matchmakingCleanup = () => {
    socket.off('connect', rejoinQueueAfterReconnect);
    previousCleanup?.();
  };

  return emitWithAck('client:join_queue', payload)
    .then((response) => {
      hasJoinedQueue = true;
      return response;
    })
    .catch((error) => {
      clearMatchmakingListeners();
      throw error;
    });
}

export function cancelSocketMatchmaking(payload = {}) {
  return emitWithAck('client:cancel_queue', payload)
    .finally(() => clearMatchmakingListeners());
}

export function joinSocketMatch(payload = {}, handlers = {}) {
  bindGameplayListeners(handlers);
  return emitWithAck('client:join_match', payload)
    .catch((error) => {
      clearGameplayListeners();
      throw error;
    });
}

export function sendSocketMatchAction(payload = {}) {
  return emitWithAck('client:match_action', payload);
}

export function sendSocketChatMessage(payload = {}) {
  return emitWithAck('chat:send', payload);
}

export function loadSocketChatHistory(payload = {}) {
  return emitWithAck('client:chat_history', payload);
}

export function leaveSocketMatch(payload = {}) {
  return emitWithAck('client:leave_match', payload);
}

export function finishSocketMatch(payload = {}) {
  return emitWithAck('client:finish_match', payload);
}

export function clearSocketGameplayListeners() {
  clearGameplayListeners();
}

export function disconnectGameSocket() {
  clearMatchmakingListeners();
  clearGameplayListeners();
  if (gameSocket) {
    gameSocket.disconnect();
    gameSocket = null;
  }
}

export function isGameSocketConnected() {
  return Boolean(gameSocket?.connected);
}
