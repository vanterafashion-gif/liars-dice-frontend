import { useEffect, useMemo, useRef, useState } from 'react';
import { useFixedViewport } from './hooks.js';
import { useLanguage } from './i18n/useLanguage.js';
import { initialGameData } from './data/initialGameData.js';
import { createMockBackendActions, mockGameData } from './data/mockGameData.js';
import { getAssetsForPhase, getAssetsForScreen } from './config/assetsManifest.js';
import { resolveCreateRoomMusicKeyFromSettings, resolveTableMusicTrack } from './config/tableMusic.js';
import {
  resolveCreateRoomBackgroundContract,
  resolveCreateRoomScreenBackgroundContract,
  resolveGameDataBackground,
  resolveGameplayBackgroundContract,
  resolveRoomLobbyBackgroundContract,
  toCssBackgroundImageValue,
} from './utils/gameplayBackgrounds.js';
import { preloadAssets, preloadAssetsInBackground } from './services/assetPreloader.js';
import { syncTableMusic, stopTableMusic } from './services/tableMusicPlayer.js';
import { backendBridge } from './services/backendBridge.js';
import {
  cancelSocketMatchmaking,
  clearSocketGameplayListeners,
  disconnectGameSocket,
  isGameSocketConnected,
  joinSocketMatch,
  leaveSocketMatch,
  loadSocketChatHistory,
  sendSocketChatMessage,
  sendSocketMatchAction,
  startSocketMatchmaking,
} from './services/socketService.js';
import { hasAccessToken } from './api/client.js';
import StarterScreen from './screens/StarterScreen.jsx';
import LoginScreen from './screens/LoginScreen.jsx';
import LoadingScreen from './screens/LoadingScreen.jsx';
import AssetBootScreen from './screens/AssetBootScreen.jsx';
import MainMenu from './screens/MainMenu.jsx';
import RoomSelect from './screens/RoomSelect.jsx';
import HelpScreen from './screens/HelpScreen.jsx';
import Matchmaking from './screens/Matchmaking.jsx';
import Gameplay from './screens/Gameplay.jsx';
import WinScreen from './screens/WinScreen.jsx';
import CreateRoom from './screens/CreateRoom.jsx';
import JoinRoom from './screens/JoinRoom.jsx';
import RoomLobby from './screens/RoomLobby.jsx';
import ProfileScreen from './screens/ProfileScreen.jsx';
import PlaceholderScreen from './screens/PlaceholderScreen.jsx';
import SpecialEvent from './screens/SpecialEvent.jsx';
import DailyReward from './screens/DailyReward.jsx';
import TournamentPass from './screens/TournamentPass.jsx';

const SCREENS = {
  starter: StarterScreen,
  login: LoginScreen,
  loading: LoadingScreen,
  mainmenu: MainMenu,
  roomselect: RoomSelect,
  createroom: CreateRoom,
  joinroom: JoinRoom,
  roomlobby: RoomLobby,
  profile: ProfileScreen,
  matchmaking: Matchmaking,
  gameplay: Gameplay,
  mockgame: Gameplay,
  win: WinScreen,
  help: HelpScreen,
  specialevent: SpecialEvent,
  dailyreward: DailyReward,
  tournamentpass: TournamentPass,
};

const SCREEN_TO_PATH = {
  starter: '/',
  login: '/login',
  loading: '/loading',
  mainmenu: '/main-menu',
  roomselect: '/room-select',
  createroom: '/create-room',
  joinroom: '/join-room',
  roomlobby: '/room-lobby',
  profile: '/profile',
  matchmaking: '/matchmaking',
  gameplay: '/gameplay',
  mockgame: '/mock-game',
  win: '/win',
  help: '/help',
  specialevent: '/special-event',
  dailyreward: '/daily-reward',
  tournamentpass: '/tournament-pass',
};

const PATH_TO_SCREEN = Object.entries(SCREEN_TO_PATH).reduce((routes, [screenName, path]) => {
  routes[path] = screenName;
  return routes;
}, {
  '/mainmenu': 'mainmenu',
  '/rooms': 'roomselect',
  '/game': 'gameplay',
  '/mockgame': 'mockgame',
  '/gameplay-mock': 'mockgame',
  '/result': 'win',
  '/create': 'createroom',
  '/join': 'joinroom',
  '/lobby': 'roomlobby',
});

const PROTECTED_SCREENS = new Set([
  'loading',
  'mainmenu',
  'roomselect',
  'createroom',
  'joinroom',
  'roomlobby',
  'profile',
  'matchmaking',
  'gameplay',
  'win',
  'specialevent',
  'dailyreward',
  'tournamentpass',
]);

function isProtectedScreen(screenName) {
  return PROTECTED_SCREENS.has(screenName);
}

function normalizePathname(pathname = '/') {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  return cleanPath.toLowerCase();
}

function getScreenFromPathname(pathname) {
  const cleanPath = normalizePathname(pathname);
  if (cleanPath.startsWith('/game/')) return 'gameplay';
  if (cleanPath.startsWith('/result/')) return 'win';
  return PATH_TO_SCREEN[cleanPath] || 'starter';
}

function getPathForScreen(screenName) {
  return SCREEN_TO_PATH[screenName] || '/';
}

const PRELOAD_SCREEN_LABELS = {
  starter: 'start screen',
  login: 'login screen',
  mainmenu: 'game assets',
  roomselect: 'room select',
  loading: 'loading screen',
  matchmaking: 'matchmaking',
  gameplay: 'gameplay',
  win: 'result screen',
};

const BOOT_PRELOAD_PHASE = 'starterShell';
const PLAY_FLOW_PRELOAD_PHASE = 'playFlow';
const BACKGROUND_PRELOAD_PHASE = 'secondaryScreens';
const preloadedCriticalScreens = new Set();
const preloadedPhases = new Set();



const ROOM_SELECT_ALLOWED_KEYS = ['beginner', 'high-roller', 'private'];
const ROOM_SELECT_KEY_ALIASES = {
  highroller: 'high-roller',
  high_roller: 'high-roller',
  'high-rollers': 'high-roller',
  'private-room': 'private',
  privet: 'private',
  'privet-room': 'private',
};

const ROOM_SELECT_DECOR = [
  { key: 'beginner', card: 'card-1.png', tableArt: '213.png', button: '15.png' },
  { key: 'high-roller', card: 'card-3.png', tableArt: '3323423.png', button: '12.png' },
  { key: 'private', card: 'card-5.png', tableArt: '1232131.png', button: 'back-button.png' },
];

const ROOM_SELECT_DECOR_BY_KEY = ROOM_SELECT_DECOR.reduce((map, item) => {
  map[item.key] = item;
  return map;
}, {});

function slugifyRoomKey(value, fallback = 'table') {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function normalizeSelectableRoomKey(value, fallback = 'table') {
  const slug = slugifyRoomKey(value, fallback);
  return ROOM_SELECT_KEY_ALIASES[slug] || slug;
}

function normalizeRoomSelectRow(row = {}, index = 0) {
  if (typeof row === 'string') return { icon: `IC${Math.min(index + 1, 7)}.png`, text: row };
  const text = row.text || row.label || row.name || row.title || row.value;
  if (!text) return null;
  return {
    icon: row.icon || row.iconFile || `IC${Math.min(index + 1, 7)}.png`,
    text,
  };
}

function normalizeRoomSelectRows(room = {}) {
  const rawRows = room.rows || room.rules || room.features || room.tags || [];
  if (Array.isArray(rawRows) && rawRows.length) {
    return rawRows
      .map(normalizeRoomSelectRow)
      .filter((row) => row && String(row.text || '').trim().toLowerCase() !== 'official rules')
      .slice(0, 3);
  }

  const derivedRows = [];
  const minPlayers = room.minPlayers || room.minimumPlayers;
  const maxPlayers = room.maxPlayers || room.playerLimit;
  if (minPlayers || maxPlayers) derivedRows.push({ icon: 'IC1.png', text: `${minPlayers || 2} - ${maxPlayers || 4} Players` });
  if (room.rewardLabel || room.rewardType) derivedRows.push({ icon: 'IC5.png', text: room.rewardLabel || room.rewardType });
  return derivedRows.slice(0, 3);
}

function hasBackendValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function formatBackendAmount(value) {
  if (!hasBackendValue(value)) return '';
  if (typeof value === 'string' && /[a-z]/i.test(value)) return value;
  return formatShortCurrency(value);
}

function formatBackendRange(min, max) {
  const minText = formatBackendAmount(min);
  const maxText = formatBackendAmount(max);

  if (minText && maxText) return `${minText} / ${maxText}`;
  return minText || maxText || '';
}

function normalizeBackendPricing(room = {}) {
  const pricing = room.pricing && typeof room.pricing === 'object' ? room.pricing : {};
  const rewards = room.rewards && typeof room.rewards === 'object' ? room.rewards : {};
  const pot = room.pot && typeof room.pot === 'object' ? room.pot : {};

  const minBuyIn = getFirstValue(pricing, ['minBuyIn', 'buyInMin']) ?? getFirstValue(room, ['minBuyIn', 'buyInMin']);
  const maxBuyIn = getFirstValue(pricing, ['maxBuyIn', 'buyInMax']) ?? getFirstValue(room, ['maxBuyIn', 'buyInMax']);
  const entryFee = getFirstValue(pricing, ['entryFee', 'fee', 'buyInAmount', 'buyInCoins'])
    ?? getFirstValue(room, ['entryFee', 'fee', 'buyInAmount', 'buyInCoins']);

  const buyIn = getFirstValue(pricing, ['buyIn', 'buyInRange', 'buyInLabel', 'entryFeeLabel'])
    || getFirstValue(room, ['buyIn', 'buyInRange', 'buyInLabel', 'entryFeeLabel'])
    || formatBackendRange(minBuyIn, maxBuyIn)
    || formatBackendAmount(entryFee);

  const grossPotPreview = getFirstValue(pricing, ['grossPotPreview', 'grossPot', 'totalPotPreview', 'totalPot'])
    ?? getFirstValue(rewards, ['grossPotPreview', 'grossPot', 'totalPotPreview', 'totalPot'])
    ?? getFirstValue(pot, ['grossPotPreview', 'grossPot', 'totalPotPreview', 'totalPot'])
    ?? getFirstValue(room, ['grossPotPreview', 'grossPot', 'totalPotPreview', 'totalPot']);
  const platformFeePreview = getFirstValue(pricing, ['platformFeePreview', 'platformFee'])
    ?? getFirstValue(rewards, ['platformFeePreview', 'platformFee'])
    ?? getFirstValue(pot, ['platformFeePreview', 'platformFee'])
    ?? getFirstValue(room, ['platformFeePreview', 'platformFee']);
  const netPotPreview = getFirstValue(pricing, ['netPotPreview', 'netPot'])
    ?? getFirstValue(rewards, ['netPotPreview', 'netPot'])
    ?? getFirstValue(pot, ['netPotPreview', 'netPot'])
    ?? getFirstValue(room, ['netPotPreview', 'netPot']);
  const winnerPayoutPreview = getFirstValue(rewards, ['winnerPayoutPreview', 'winnerPayout', 'winnerReward'])
    ?? getFirstValue(pricing, ['winnerPayoutPreview', 'winnerPayout', 'winnerReward'])
    ?? getFirstValue(pot, ['winnerPayoutPreview', 'winnerPayout', 'winnerReward'])
    ?? getFirstValue(room, ['winnerPayoutPreview', 'winnerPayout', 'winnerReward', 'winReward']);

  const minCoinBet = getFirstValue(pricing, ['minCoinBet', 'minBidCoins', 'stakeMin']) ?? getFirstValue(room, ['minCoinBet', 'minBidCoins', 'stakeMin']);
  const maxCoinBet = getFirstValue(pricing, ['maxCoinBet', 'maxBidCoins', 'stakeMax']) ?? getFirstValue(room, ['maxCoinBet', 'maxBidCoins', 'stakeMax']);
  const defaultCoinBet = getFirstValue(pricing, ['defaultCoinBet', 'defaultBidCoins']) ?? getFirstValue(room, ['defaultCoinBet', 'defaultBidCoins']);
  const bidCoinStep = getFirstValue(pricing, ['bidCoinStep', 'coinBetStep']) ?? getFirstValue(room, ['bidCoinStep', 'coinBetStep']);
  const coinBetOptions = Array.isArray(pricing.coinBetOptions) && pricing.coinBetOptions.length
    ? pricing.coinBetOptions
    : Array.isArray(room.coinBetOptions) ? room.coinBetOptions : undefined;
  const perGameMode = getFirstValue(pricing, ['perGameMode', 'coinBetMode'])
    ?? getFirstValue(room, ['perGameMode', 'coinBetMode'])
    ?? 'static';
  const perGameBase = getFirstValue(pricing, ['perGameBase', 'rangeBase'])
    ?? getFirstValue(room, ['perGameBase', 'rangeBase'])
    ?? maxCoinBet
    ?? defaultCoinBet;
  const perGameOptions = Array.isArray(pricing.perGameOptions) && pricing.perGameOptions.length
    ? pricing.perGameOptions
    : (Array.isArray(room.perGameOptions) && room.perGameOptions.length ? room.perGameOptions : coinBetOptions);
  const selectedPerGame = getFirstValue(pricing, ['selectedPerGame', 'selectedPerGameAmount'])
    ?? getFirstValue(room, ['selectedPerGame', 'selectedPerGameAmount'])
    ?? defaultCoinBet;
  const perGameAmount = getFirstValue(pricing, ['perGameAmount', 'roundStake'])
    ?? getFirstValue(room, ['perGameAmount', 'roundStake'])
    ?? selectedPerGame;
  const pekEnabled = getFirstValue(pricing, ['pekEnabled', 'slamEnabled'])
    ?? getFirstValue(room, ['pekEnabled', 'slamEnabled'])
    ?? false;
  const pekPercentage = getFirstValue(pricing, ['pekPercentage', 'slamPercentage'])
    ?? getFirstValue(room, ['pekPercentage', 'slamPercentage'])
    ?? 25;
  const finalPekAmount = getFirstValue(pricing, ['finalPekAmount', 'finalSlamAmount'])
    ?? getFirstValue(room, ['finalPekAmount', 'finalSlamAmount']);
  const requiredPekCoverAmount = getFirstValue(pricing, ['requiredPekCoverAmount', 'maxChallengeAmount'])
    ?? getFirstValue(room, ['requiredPekCoverAmount', 'maxChallengeAmount'])
    ?? finalPekAmount
    ?? perGameAmount;

  return {
    pricing: {
      ...pricing,
      minBuyIn,
      maxBuyIn,
      entryFee,
      buyInAmount: getFirstValue(pricing, ['buyInAmount', 'buyInCoins']) ?? getFirstValue(room, ['buyInAmount', 'buyInCoins']) ?? entryFee,
      buyIn,
      buyInRange: getFirstValue(pricing, ['buyInRange']) || buyIn,
      paidPlayerCountPreview: getFirstValue(pricing, ['paidPlayerCountPreview']) ?? getFirstValue(room, ['paidPlayerCountPreview']),
      grossPotPreview,
      platformFeePreview,
      netPotPreview,
      winnerPayoutPreview,
      winnerPayout: getFirstValue(pricing, ['winnerPayout']) ?? getFirstValue(rewards, ['winnerPayout']) ?? getFirstValue(room, ['winnerPayout']) ?? winnerPayoutPreview,
      winnerReward: getFirstValue(pricing, ['winnerReward']) ?? getFirstValue(rewards, ['winnerReward']) ?? getFirstValue(room, ['winnerReward']) ?? winnerPayoutPreview,
      minCoinBet,
      maxCoinBet,
      defaultCoinBet,
      bidCoinStep,
      coinBetOptions,
      perGameMode,
      coinBetMode: perGameMode,
      perGameBase,
      perGameOptions,
      selectedPerGame,
      selectedPerGameAmount: selectedPerGame,
      perGameAmount,
      roundStake: perGameAmount,
      pekEnabled: Boolean(pekEnabled),
      slamEnabled: Boolean(pekEnabled),
      pekPercentage,
      slamPercentage: pekPercentage,
      finalPekAmount,
      finalSlamAmount: finalPekAmount,
      requiredPekCoverAmount,
      maxChallengeAmount: requiredPekCoverAmount,
      potMode: getFirstValue(pricing, ['potMode']) ?? getFirstValue(room, ['potMode']),
      payoutMode: getFirstValue(pricing, ['payoutMode']) ?? getFirstValue(room, ['payoutMode']),
      winnerRewardMode: getFirstValue(pricing, ['winnerRewardMode']) ?? getFirstValue(rewards, ['winnerRewardMode']) ?? getFirstValue(room, ['winnerRewardMode']) ?? 'pot',
    },
    rewards: {
      ...rewards,
      grossPotPreview,
      platformFeePreview,
      netPotPreview,
      winnerPayoutPreview,
      winnerPayout: getFirstValue(rewards, ['winnerPayout']) ?? getFirstValue(pricing, ['winnerPayout']) ?? getFirstValue(room, ['winnerPayout']) ?? winnerPayoutPreview,
      winnerReward: getFirstValue(rewards, ['winnerReward', 'winReward']) ?? getFirstValue(pricing, ['winnerReward']) ?? getFirstValue(room, ['winnerReward', 'winReward']) ?? winnerPayoutPreview,
      winnerRewardMode: getFirstValue(rewards, ['winnerRewardMode']) ?? getFirstValue(pricing, ['winnerRewardMode']) ?? getFirstValue(room, ['winnerRewardMode']) ?? 'pot',
      xpWin: getFirstValue(rewards, ['xpWin']) ?? getFirstValue(room, ['xpWin']),
      xpLose: getFirstValue(rewards, ['xpLose']) ?? getFirstValue(room, ['xpLose']),
    },
    buyIn,
  };
}

function normalizeSelectableRoom(room = {}, index = 0) {
  if (!room || typeof room !== 'object') return null;

  const id = room.id || room.tierId || room.tableId || room.roomTypeId || room.key || room.slug || room.name || room.title;
  if (!id) return null;

  const rawKey = room.key || room.slug || room.tierKey || room.tierId || room.tableId || room.name || room.title || id;
  const key = normalizeSelectableRoomKey(rawKey, `table-${index + 1}`);
  if (!ROOM_SELECT_ALLOWED_KEYS.includes(key)) return null;
  const decor = ROOM_SELECT_DECOR_BY_KEY[key] || ROOM_SELECT_DECOR[index] || ROOM_SELECT_DECOR[0];
  const title = room.title || room.name || room.label || String(id).replace(/[-_]+/g, ' ').toUpperCase();
  const backendPricing = normalizeBackendPricing(room);
  const backgroundContract = resolveGameplayBackgroundContract([room], {
    fallbackKey: key === 'private' ? 'private_room' : key === 'high-roller' ? 'table_buyin_5000' : 'table_buyin_500',
  });

  return {
    ...room,
    ...backgroundContract,
    id,
    tierId: room.tierId || room.id || id,
    tableId: room.tableId || room.id || id,
    key,
    title,
    card: room.card || room.cardAsset || decor.card,
    tableArt: room.tableArt || room.tableAsset || room.art || decor.tableArt,
    button: room.button || room.buttonAsset || decor.button,
    pricing: backendPricing.pricing,
    rewards: backendPricing.rewards,
    buyIn: backendPricing.buyIn || '',
    entryFee: backendPricing.pricing.entryFee,
    winnerReward: backendPricing.rewards.winnerReward,
    rows: normalizeRoomSelectRows(room),
    maxPlayers: Number(room.maxPlayers || room.playerLimit || 4),
    minPlayers: Number(room.minPlayers || room.minimumPlayers || 2),
  };
}

function looksLikeActiveBackendRooms(rooms = []) {
  return rooms.some((room) => {
    if (!room || typeof room !== 'object') return false;

    return Boolean(
      room.roomId ||
      room.roomCode ||
      room.code ||
      room.ownerId ||
      Array.isArray(room.players) ||
      Array.isArray(room.playerIds) ||
      ['waiting', 'ready', 'in_match', 'finished', 'closed'].includes(String(room.status || '').toLowerCase())
    );
  });
}

function looksLikeSelectableRooms(rooms = []) {
  return rooms.some((room) => {
    if (!room || typeof room !== 'object') return false;
    if (looksLikeActiveBackendRooms([room])) return false;

    const key = normalizeSelectableRoomKey(room.key || room.slug || room.tierKey || room.tierId || room.tableId || room.name || room.title || '');
    return ROOM_SELECT_ALLOWED_KEYS.includes(key) && Boolean(
      room.tierId ||
      room.tableId ||
      room.buyIn ||
      room.entryFee ||
      room.entryFeeLabel ||
      room.pricing ||
      room.cardAsset ||
      room.tableAsset ||
      ROOM_SELECT_DECOR_BY_KEY[key]
    );
  });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return new Intl.NumberFormat('en-US').format(value);

  const numeric = Number(String(value).replace(/,/g, ''));
  if (Number.isFinite(numeric)) return new Intl.NumberFormat('en-US').format(numeric);

  return String(value);
}

function normalizeWallet(wallet = {}) {
  return {
    coins: formatCurrency(wallet.coins ?? wallet.coinBalance) || '0',
    gems: formatCurrency(wallet.gems ?? wallet.diamonds ?? wallet.gemBalance) || '0',
  };
}


function numericWalletAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : 0;
  const normalized = String(value ?? '0').trim().toLowerCase().replace(/,/g, '');
  if (!normalized) return 0;

  const multiplier = normalized.endsWith('m') ? 1000000 : normalized.endsWith('k') ? 1000 : 1;
  const numeric = Number(normalized.replace(/[a-z]+$/i, ''));
  return Number.isFinite(numeric) ? Math.trunc(numeric * multiplier) : 0;
}

function resolveEntryFee(selection = {}) {
  const pricing = selection?.pricing && typeof selection.pricing === 'object' ? selection.pricing : {};
  const value = getFirstValue(pricing, ['entryFee', 'buyInAmount', 'buyInCoins', 'fee'])
    ?? getFirstValue(selection, ['entryFee', 'buyInAmount', 'buyInCoins', 'fee', 'minBuyIn']);

  return Math.max(0, numericWalletAmount(value));
}

function resolveSelectedTableForMatchmaking(payload = {}, state = {}) {
  if (payload && Object.keys(payload).length) return payload;
  return state.playNowTable || state.defaultTable || state.selectedTable || {};
}

function isCreateRoomGameplaySource(source = {}) {
  if (!source || typeof source !== 'object') return false;
  const modeText = String(source.roomMode || source.gameMode || source.playMode || source.selectedRoomMode || source.mode || source.roomType || source.type || '').toLowerCase();
  const keyText = String(source.key || source.id || source.tableId || source.tierId || source.roomTypeId || source.name || source.title || '').toLowerCase();
  return Boolean(
    source.gameplayThemeLocked
    || source.createRoomGameplayTheme
    || source.createRoomBuyInTier
    || source.roomCode
    || source.code
    || source.roomName
    || source.isPrivate
    || source.private
    || source.botsEnabled
    || modeText.includes('bot')
    || modeText.includes('private')
    || keyText.includes('private')
    || keyText.includes('create-room')
  );
}

function normalizeCreateRoomGameplaySelection(settings = {}) {
  const gameplayBackgroundContract = resolveCreateRoomBackgroundContract(settings);
  const createRoomMusicKey = resolveCreateRoomMusicKeyFromSettings(settings);

  return {
    ...settings,
    ...gameplayBackgroundContract,
    gameplayThemeLocked: true,
    createRoomGameplayTheme: true,
    createRoomBuyInTier: gameplayBackgroundContract.backgroundKey,
    createRoomMusicKey,
    musicKey: createRoomMusicKey,
    tableMusicKey: createRoomMusicKey,
  };
}

function withPrivateRoomMusicMetadata(settings = {}) {
  const rawKey = settings.musicKey
    || settings.key
    || settings.slug
    || settings.tierKey
    || settings.tierId
    || settings.tableId
    || settings.id
    || settings.name
    || settings.title
    || settings.type
    || settings.roomType;
  const slug = slugifyRoomKey(rawKey, '');
  const normalizedKey = normalizeSelectableRoomKey(rawKey, '');
  const shouldUsePrivateMusic = Boolean(
    settings.isPrivate
    || settings.private
    || settings.roomCode
    || settings.code
    || settings.roomName
    || !rawKey
    || normalizedKey === 'private'
    || slug === 'create-room'
    || slug === 'createroom'
  );

  if (!shouldUsePrivateMusic) return settings;

  const normalizedSelection = normalizeCreateRoomGameplaySelection(settings);

  return {
    ...normalizedSelection,
    key: settings.key || normalizedSelection.backgroundKey || 'private',
    type: settings.type || 'private',
    roomType: settings.roomType || 'private',
  };
}

function buildInsufficientFundsMessage(requiredCoins = 0, availableCoins = 0) {
  return `Not enough chips. Required: ${formatCurrency(requiredCoins)}. Available: ${formatCurrency(availableCoins)}.`;
}

function getBackendErrorCode(error = {}) {
  return error?.code
    || error?.reason
    || error?.details?.code
    || error?.details?.reason
    || error?.data?.code
    || error?.data?.reason
    || error?.data?.details?.code
    || error?.payload?.code
    || error?.payload?.reason
    || error?.payload?.details?.code
    || null;
}


function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function displayValue(value, fallback = '—') {
  if (!hasValue(value)) return fallback;
  return String(value);
}

function titleFromKey(value) {
  if (!hasValue(value)) return '';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatRange(minValue, maxValue, unit = '') {
  const min = hasValue(minValue) ? formatCurrency(minValue) : null;
  const max = hasValue(maxValue) ? formatCurrency(maxValue) : null;
  if (min && max) return `${min} - ${max}${unit}`;
  if (max) return `${max}${unit}`;
  if (min) return `${min}${unit}`;
  return '—';
}

function getSelectedTableLabel(selection = {}) {
  return displayValue(
    selection.title ||
    selection.name ||
    selection.label ||
    selection.modeName ||
    selection.mode ||
    titleFromKey(selection.tierId || selection.tableId || selection.key),
  );
}


function getPlayersLabel(selection = {}, server = {}, match = null) {
  const matchPlayers = Array.isArray(match?.players) ? match.players.length : null;
  const found = server.playersFound ?? server.playerCount ?? server.currentPlayers ?? matchPlayers;
  const maxPlayers = server.maxPlayers ?? selection.maxPlayers ?? match?.maxPlayers;
  const minPlayers = server.minPlayers ?? selection.minPlayers ?? match?.minPlayers;

  if (hasValue(found) && hasValue(maxPlayers)) return `${found} / ${maxPlayers}`;
  if (hasValue(minPlayers) || hasValue(maxPlayers)) return `${minPlayers || 1} - ${maxPlayers || minPlayers} Players`;
  return '—';
}

function normalizeMatchmakingUi(matchmaking = {}) {
  if (!matchmaking || typeof matchmaking !== 'object') return null;

  const uiSource = matchmaking.ui && typeof matchmaking.ui === 'object'
    ? matchmaking.ui
    : matchmaking;

  const filters = Array.isArray(uiSource.filters) ? uiSource.filters : [];
  const metrics = Array.isArray(uiSource.metrics) ? uiSource.metrics : [];
  const steps = Array.isArray(uiSource.steps) ? uiSource.steps : [];

  const hasRenderableFilters = filters.some((item) => item?.label && hasValue(item?.value));
  const hasRenderableMetrics = metrics.some((item) => item?.label && hasValue(item?.value));
  const hasRenderableSteps = steps.some((item) => item?.icon && (item?.text || item?.label));

  // The backend also returns a technical `steps` array for queue state
  // ({ id, label, status }). That is not the same shape as this screen UI.
  // If we accept it directly, the frontend renders empty panels and broken icons.
  if (!hasRenderableFilters && !hasRenderableMetrics && !hasRenderableSteps) return null;

  return {
    filters: hasRenderableFilters ? filters : [],
    metrics: hasRenderableMetrics ? metrics : [],
    steps: hasRenderableSteps
      ? steps.map((step, index) => ({
        icon: step.icon || `${index + 1}${index + 1}.png`,
        text: step.text || step.label,
        sub: step.sub || step.value || (step.complete ? '✓' : step.active ? '•••' : '...'),
      }))
      : [],
  };
}

function getModeLabel(selection = {}, server = {}) {
  const directMode = server.modeLabel || server.selectedMode || selection.modeLabel || selection.selectedMode;
  if (hasValue(directMode)) return String(directMode).toUpperCase();

  const rawMode = server.mode || selection.mode || '';
  if (String(rawMode).toLowerCase() === 'quick') return 'QUICK MATCH';

  const tableLabel = getSelectedTableLabel(selection);
  return tableLabel === '—' ? 'QUICK MATCH' : tableLabel.toUpperCase();
}

function buildMatchmakingUi(selection = {}, server = {}, match = null, currentMatchId = null) {
  const modeLabel = getModeLabel(selection, server);
  const playersLabel = getPlayersLabel(selection, server, match);
  const regionLabel = displayValue(server.region || selection.region || selection.serverRegion, 'GLOBAL').toUpperCase();
  const waitLabel = displayValue(server.estimatedWait || server.estimatedWaitTime || server.waitTime || selection.estimatedWait, '7s');
  const qualityLabel = displayValue(server.quality || server.matchQuality || selection.quality, 'EXCELLENT').toUpperCase();
  const pingLabel = hasValue(server.ping) ? `${server.ping}ms` : '45ms';
  const fairPlayLabel = displayValue(server.fairPlay || selection.fairPlay, 'Real players only');
  const skillLabel = displayValue(server.skillBalance || selection.skillBalance, 'GREAT MATCH').toUpperCase();
  const matchId = currentMatchId || match?.id || match?.matchId || server.matchId;
  const isCountdown = String(server.matchStatus || server.status || match?.status || '').toLowerCase().includes('starting') || match?.status === 'countdown';
  const remainingMs = hasValue(server.matchStartRemainingMs)
    ? Number(server.matchStartRemainingMs)
    : server.startsAt
      ? Math.max(0, new Date(server.startsAt).getTime() - Date.now())
      : match?.startsAt
        ? Math.max(0, new Date(match.startsAt).getTime() - Date.now())
        : 0;
  const countdownLabel = isCountdown ? `${Math.max(0, Math.ceil(remainingMs / 1000))}s` : null;

  return {
    filters: [
      { icon: '1.png', label: 'SELECTED MODE', value: modeLabel },
      { icon: '5.png', label: 'REGION', value: regionLabel },
      { icon: '5.png', label: 'EST. WAIT TIME', value: countdownLabel || waitLabel },
    ],
    metrics: [
      { type: 'players', icon: null, label: 'PLAYERS FOUND', value: playersLabel },
      { type: 'quality', icon: '8.png', label: 'MATCH QUALITY', value: qualityLabel },
      { type: 'fair', icon: '7.png', label: 'FAIR PLAY', value: fairPlayLabel },
      { type: 'skill', icon: '6.png', label: 'SKILL BALANCE', value: skillLabel },
    ],
    steps: [
      { icon: '1.png', text: 'FINDING TABLE', sub: '✓' },
      { icon: '2.png', text: 'MATCHING PLAYERS', sub: matchId ? '✓' : '••••' },
      { icon: '3.png', text: 'JOINING ROOM', sub: isCountdown ? countdownLabel : matchId ? 'READY' : '•••' },
    ],
  };
}

function normalizeUser(user = {}) {
  const stats = user.stats && typeof user.stats === 'object' ? user.stats : {};

  return {
    ...user,
    stats,
    displayName: user.displayName || user.username || 'Player',
    username: user.username || user.displayName || 'Player',
    level: user.level ?? 1,
    xp: user.xp ?? 0,
    nextLevelXp: user.nextLevelXp ?? 2500,
  };
}

function normalizeDailyRewardSummary(source = {}) {
  const hasDailySummary = [
    'streak',
    'claimedToday',
    'lastClaimAt',
    'nextRewardAt',
    'serverTime',
  ].some((key) => Object.prototype.hasOwnProperty.call(source, key));

  if (!hasDailySummary) return null;

  return {
    streak: Number(source.streak ?? 0),
    claimedToday: Boolean(source.claimedToday),
    lastClaimAt: source.lastClaimAt || null,
    nextRewardAt: source.nextRewardAt || null,
    serverTime: source.serverTime || null,
  };
}


function getFirstValue(source = {}, keys = []) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== '') return source[key];
  }
  return undefined;
}

function numberOrZero(value) {
  const parsed = Number(String(value ?? 0).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatShortCurrency(value) {
  const number = numberOrZero(value);
  if (!number) return formatCurrency(value) || '0';
  if (number >= 1000000) return `${Number((number / 1000000).toFixed(1))}M`;
  if (number >= 1000) return `${Number((number / 1000).toFixed(1))}K`;
  return formatCurrency(number);
}

function formatTimerValue(source = {}) {
  const direct = getFirstValue(source, ['time', 'timeLeft', 'remainingTime', 'durationLabel', 'timerLabel']);
  if (direct) return String(direct);

  const target = getFirstValue(source, ['endsAt', 'endAt', 'endDate', 'expiresAt']);
  if (!target) return '—';

  const diff = new Date(target).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return 'ENDED';

  const hours = Math.floor(diff / 3600000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function normalizeDailyReward(reward = {}, index = 0) {
  const rewardSource = reward.reward && typeof reward.reward === 'object' ? reward.reward : reward;
  const dayNumber = Number(
    reward.dayNumber ||
    reward.day ||
    String(reward.id || reward.key || reward.rewardId || '').match(/\d+/)?.[0] ||
    index + 1,
  );
  const safeDay = Number.isFinite(dayNumber) && dayNumber > 0 ? dayNumber : index + 1;
  const id = reward.id || reward.rewardId || reward.key || `day${safeDay}`;
  const rawStatus = String(reward.state || reward.status || '').toLowerCase();
  const isClaimed = Boolean(reward.claimed || reward.isClaimed || rawStatus.includes('claim') && rawStatus.includes('ed'));
  const isClaimable = Boolean(reward.claimable || reward.canClaim || reward.available || rawStatus === 'claimable' || rawStatus === 'ready' || rawStatus === 'claim');
  const state = isClaimed ? 'claimed' : isClaimable ? 'claimable' : 'locked';

  return {
    ...reward,
    id,
    key: reward.key || id,
    day: reward.dayLabel || `Day ${safeDay}`,
    card: reward.card || reward.cardAsset || reward.image || `d${safeDay}${safeDay}.png`,
    type: getFirstValue(rewardSource, ['type', 'currency', 'rewardType']) || 'coins',
    amount: getFirstValue(rewardSource, ['amount', 'value', 'quantity']) || 0,
    status: state === 'claimed' ? 'Claimed' : state === 'claimable' ? 'Claim' : 'Locked',
    state,
  };
}

function normalizeDailyRewards(list = []) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeDailyReward).slice(0, 7);
}

const TOURNAMENT_DECOR = {
  bronze: { card: 'Card1.png', button: '15.png' },
  royal: { card: 'Card2.png', button: '13.png' },
  grand: { card: 'Card3.png', button: '12.png' },
};
const TOURNAMENT_DECOR_SEQUENCE = ['bronze', 'royal', 'grand'];

function normalizeTournament(tournament = {}, index = 0) {
  const id = tournament.id || tournament.tournamentId || tournament.key || TOURNAMENT_DECOR_SEQUENCE[index] || `tournament-${index + 1}`;
  const key = slugifyRoomKey(tournament.key || id, `tournament-${index + 1}`);
  const decor = TOURNAMENT_DECOR[key] || TOURNAMENT_DECOR[TOURNAMENT_DECOR_SEQUENCE[index]] || TOURNAMENT_DECOR.bronze;
  const playerProgress = tournament.playerProgress && typeof tournament.playerProgress === 'object' ? tournament.playerProgress : {};
  const currentPlayers = getFirstValue(tournament, ['currentPlayers', 'playerCount', 'playersCount', 'participants']) ?? playerProgress.current;
  const maxPlayers = getFirstValue(tournament, ['maxPlayers', 'capacity', 'playerLimit']) ?? playerProgress.max;
  const status = String(tournament.status || '').toLowerCase();
  const entered = Boolean(tournament.entered || tournament.userEntry);
  const isFull = Boolean(tournament.isFull || status === 'full' || (hasValue(currentPlayers) && hasValue(maxPlayers) && Number(currentPlayers) >= Number(maxPlayers)));

  return {
    ...tournament,
    id,
    tournamentId: tournament.tournamentId || id,
    key,
    card: tournament.card || tournament.cardAsset || tournament.image || decor.card,
    button: tournament.button || tournament.buttonAsset || decor.button,
    entry: displayValue(tournament.entry || tournament.entryLabel || formatCurrency(tournament.entryFee ?? tournament.fee), '0'),
    prize: displayValue(tournament.prize || tournament.prizeLabel || formatCurrency(tournament.prizePool ?? tournament.rewardPool ?? tournament.maxPrize), '0'),
    time: formatTimerValue(tournament),
    players: tournament.players || tournament.playersLabel || playerProgress.label || (
      hasValue(currentPlayers) || hasValue(maxPlayers)
        ? `${currentPlayers || 0} / ${maxPlayers || '∞'}`
        : '—'
    ),
    currentPlayers: numberOrZero(currentPlayers),
    maxPlayers: hasValue(maxPlayers) ? numberOrZero(maxPlayers) : undefined,
    entered,
    isFull,
    canEnter: Boolean(tournament.canEnter ?? (!entered && !isFull && status !== 'closed' && status !== 'ended')),
    status: tournament.status || (isFull ? 'full' : 'open'),
  };
}

function normalizeTournaments(list = []) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeTournament).filter(Boolean);
}

function normalizePassReward(reward = {}, index = 0, track = 'free', pass = {}) {
  if (typeof reward === 'string' || typeof reward === 'number') {
    const level = index + 1;
    const unlocked = Number(pass.passLevel || 1) >= level;
    return {
      track,
      level,
      icon: track === 'premium' ? 'ic1.png' : 'ic1.png',
      value: String(reward),
      claimed: false,
      unlocked,
      locked: !unlocked || (track === 'premium' && !pass.premiumUnlocked),
      premiumLocked: track === 'premium' && !pass.premiumUnlocked,
      claimable: track === 'free' && unlocked,
    };
  }

  const rewardSource = reward.reward && typeof reward.reward === 'object' ? reward.reward : reward;
  const type = String(getFirstValue(rewardSource, ['type', 'currency', 'rewardType']) || 'coins').toLowerCase();
  const level = Number(getFirstValue(reward, ['level', 'passLevel', 'requiredLevel']) || index + 1);
  const rawStatus = String(reward.status || reward.state || '').toLowerCase();
  const premiumUnlocked = Boolean(pass.premiumUnlocked);
  const unlocked = Boolean(reward.unlocked ?? reward.available ?? reward.isUnlocked ?? Number(pass.passLevel || 1) >= level);
  const claimed = Boolean(reward.claimed || reward.isClaimed || rawStatus === 'claimed');
  const requiresPremium = Boolean(reward.requiresPremium ?? track === 'premium');
  const premiumLocked = Boolean(reward.premiumLocked ?? (requiresPremium && !premiumUnlocked));
  const locked = Boolean(reward.locked ?? !unlocked ?? false) || premiumLocked;
  const claimable = Boolean(reward.claimable ?? reward.canClaim ?? rawStatus === 'claimable') && !claimed && !locked;
  const iconByType = {
    coins: 'ic1.png',
    coin: 'ic1.png',
    gems: 'ic3.png',
    gem: 'ic3.png',
    diamonds: 'ic3.png',
    diamond: 'ic3.png',
    chest: 'ic2.png',
    box: 'ic2.png',
    dice: 'ic7.png',
  };

  return {
    ...reward,
    track,
    level,
    type,
    icon: reward.icon || reward.iconAsset || iconByType[type] || `ic${Math.min(index + 1, 8)}.png`,
    value: reward.value || reward.label || formatShortCurrency(getFirstValue(rewardSource, ['amount', 'quantity', 'count']) ?? 1),
    claimed,
    unlocked,
    locked,
    requiresPremium,
    premiumLocked,
    claimable,
  };
}

function normalizeTournamentPass(pass = {}) {
  const source = pass.pass && typeof pass.pass === 'object' ? pass.pass : pass;
  const rawLevels = Array.isArray(source.levels) ? source.levels : [];
  const premiumUnlocked = Boolean(source.premiumUnlocked || source.isPremium || source.premium || source.passUpgraded);
  const levelLabels = rawLevels.length
    ? rawLevels.map((level, index) => level.label || level.level || level.number || index + 1)
    : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

  const premiumRewards = Array.isArray(source.premiumRewards)
    ? source.premiumRewards
    : rawLevels.map((level) => level.premiumReward || level.premium).filter(Boolean);
  const freeRewards = Array.isArray(source.freeRewards)
    ? source.freeRewards
    : rawLevels.map((level) => level.freeReward || level.free).filter(Boolean);

  const progress = source.xpProgress || source.progress || {};
  const currentXp = numberOrZero(source.passXp ?? source.xp ?? source.currentXp ?? progress.total);
  const levelProgressXp = numberOrZero(source.levelProgressXp ?? progress.current ?? currentXp);
  const xpForLevel = numberOrZero(source.levelTargetXp ?? source.xpToNextLevel ?? source.levelXpRequired ?? progress.required);
  const xpPercent = hasValue(source.xpPercent)
    ? numberOrZero(source.xpPercent)
    : hasValue(progress.percent)
      ? numberOrZero(progress.percent)
      : xpForLevel > 0
        ? Math.max(0, Math.min(100, (levelProgressXp / xpForLevel) * 100))
        : 0;
  const xpValueLabel = source.xpValueLabel || source.xpText || progress.label || `${levelProgressXp}/${xpForLevel || 0}`;
  const normalizedPass = {
    ...source,
    xpLabel: source.xpLabel || 'PASS XP',
    passXp: currentXp,
    passLevel: Number(source.passLevel || source.level || source.currentLevel || 1),
    premiumUnlocked,
    premiumLocked: Boolean(source.premiumLocked ?? !premiumUnlocked),
    levels: levelLabels.slice(0, 10),
    levelProgressXp,
    levelTargetXp: xpForLevel,
    xpPercent,
    xpValueLabel,
    xpText: xpValueLabel,
    xpProgress: {
      current: levelProgressXp,
      required: xpForLevel || 0,
      total: currentXp,
      percent: xpPercent,
      label: xpValueLabel,
    },
  };

  return {
    ...normalizedPass,
    premiumRewards: premiumRewards.map((reward, index) => normalizePassReward(reward, index, 'premium', normalizedPass)).slice(0, 10),
    freeRewards: freeRewards.map((reward, index) => normalizePassReward(reward, index, 'free', normalizedPass)).slice(0, 10),
  };
}

const EVENT_DECOR = {
  golden: { skin: 'Card1.png', buttonSkin: '15.png', buttonClass: 'special-event-play--green', ribbon: 'LIMITED', ribbonClass: 'special-event-ribbon--limited' },
  dragon: { skin: 'Card2.png', buttonSkin: '12.png', buttonClass: 'special-event-play--red', ribbon: 'HOT', ribbonClass: 'special-event-ribbon--hot' },
  foxfire: { skin: 'Card3.png', buttonSkin: '14.png', buttonClass: 'special-event-play--blue', ribbon: 'NEW', ribbonClass: 'special-event-ribbon--new' },
};
const EVENT_SEQUENCE = ['golden', 'dragon', 'foxfire'];

function normalizeEvent(event = {}, index = 0) {
  const id = event.id || event.eventId || event.key || EVENT_SEQUENCE[index] || `event-${index + 1}`;
  const key = slugifyRoomKey(event.key || id, `event-${index + 1}`);
  const decor = EVENT_DECOR[key] || EVENT_DECOR[EVENT_SEQUENCE[index]] || EVENT_DECOR.golden;
  const reward = event.featuredReward || event.reward || event.rewardPreview || {};
  const rewardSource = reward && typeof reward === 'object' ? reward : { label: reward };

  return {
    ...event,
    id,
    key,
    skin: event.skin || event.card || event.cardAsset || event.image || decor.skin,
    ribbon: event.ribbon || event.tag || decor.ribbon,
    ribbonClass: event.ribbonClass || decor.ribbonClass,
    title: event.title || event.name || titleFromKey(key),
    copy: event.copy || event.description || '',
    time: formatTimerValue(event),
    rewardLabel: event.rewardLabel || 'FEATURED REWARD',
    rewardIcon: event.rewardIcon || rewardSource.icon || rewardSource.iconAsset || 'ic1.png',
    reward: event.rewardText || rewardSource.label || rewardSource.name || formatShortCurrency(getFirstValue(rewardSource, ['amount', 'quantity', 'value']) ?? 0),
    buttonSkin: event.buttonSkin || event.buttonAsset || decor.buttonSkin,
    buttonClass: event.buttonClass || decor.buttonClass,
  };
}

function normalizeEvents(list = []) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeEvent).filter(Boolean);
}

function normalizeEventMission(mission = {}, index = 0) {
  const id = mission.id || mission.missionId || mission.key || `mission-${index + 1}`;
  const target = numberOrZero(mission.target ?? mission.required ?? mission.goal ?? 1) || 1;
  const current = numberOrZero(mission.progress ?? mission.current ?? mission.count ?? 0);
  const reward = mission.reward && typeof mission.reward === 'object' ? mission.reward : mission;
  const rewardAmount = getFirstValue(reward, ['coins', 'amount', 'value', 'quantity']) ?? 0;

  return {
    ...mission,
    id,
    key: mission.key || id,
    icon: mission.icon || mission.iconAsset || `ic${Math.min(index + 1, 7)}.png`,
    label: mission.label || mission.name || mission.title || titleFromKey(id),
    progress: mission.progressLabel || `${current} / ${target}`,
    coins: formatCurrency(rewardAmount),
    fill: hasValue(mission.fill) ? numberOrZero(mission.fill) : Math.max(0, Math.min(100, (current / target) * 100)),
    claimable: Boolean(mission.claimable || mission.canClaim || mission.completed),
    claimed: Boolean(mission.claimed || mission.isClaimed),
  };
}

function normalizeEventMissions(list = []) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeEventMission).filter(Boolean);
}

function normalizeTransaction(transaction = {}) {
  const amount = Number(transaction.amount || 0);
  const currency = transaction.currency || (transaction.coins ? 'coins' : transaction.gems ? 'gems' : 'coins');

  return {
    id: transaction.id || transaction._id || `${transaction.type || 'txn'}-${transaction.createdAt || Date.now()}`,
    type: transaction.type || 'wallet_adjustment',
    currency,
    amount,
    reason: transaction.reason || transaction.label || transaction.type || 'Wallet update',
    referenceId: transaction.referenceId || null,
    metadata: transaction.metadata || {},
    balanceBefore: transaction.balanceBefore || null,
    balanceAfter: transaction.balanceAfter || null,
    createdAt: transaction.createdAt || transaction.date || null,
  };
}

function normalizeMatchResult(source = {}) {
  const match = source.match && typeof source.match === 'object' ? source.match : {};
  const viewerMatchResult = source.viewerMatchResult && typeof source.viewerMatchResult === 'object' ? source.viewerMatchResult : null;
  const rawResult = match.result || (source.matchResult && typeof source.matchResult === 'object' ? source.matchResult : null);
  const viewerResult = typeof source.result === 'string'
    ? source.result
    : viewerMatchResult?.outcome || viewerMatchResult?.result || source.viewerResult || source.outcome || rawResult?.viewerResult || rawResult?.outcome || null;

  if (!rawResult && !viewerMatchResult && !viewerResult && match.status !== 'finished') return null;

  return {
    ...(rawResult || {}),
    viewerResult,
    viewerMatchResult,
    winnerId: rawResult?.winnerId || viewerMatchResult?.winnerId || match.winnerId || source.winnerId || null,
    loserId: rawResult?.loserId || viewerMatchResult?.loserId || match.loserId || source.loserId || null,
    reward: viewerMatchResult?.reward ?? rawResult?.reward ?? source.reward ?? match.winReward ?? 0,
    xpEarned: viewerMatchResult?.xpEarned ?? rawResult?.xpEarned ?? source.xpEarned ?? null,
    rankPoints: viewerMatchResult?.rankPoints ?? rawResult?.rankPoints ?? source.rankPoints ?? null,
    reason: rawResult?.reason || source.reason || match.lastAction?.type || null,
    matchId: source.matchId || match.id || match.matchId || rawResult?.matchId || null,
    status: match.status || source.status || rawResult?.status || null,
    raw: rawResult || null,
  };
}

function unwrapBackendPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') return {};
  const nested = payload.data && typeof payload.data === 'object' ? payload.data : null;
  return nested ? { ...payload, ...nested } : payload;
}

function isActiveMatchStatus(value) {
  const normalized = String(value || '').toLowerCase();
  return ['active', 'in_progress', 'started', 'game_started', 'bots_match_started', 'in_match'].includes(normalized);
}

function isGameStartedPayload(payload = {}) {
  const source = unwrapBackendPayload(payload);
  const match = source.match && typeof source.match === 'object' ? source.match : {};
  const stage = String(source.stage || '').toLowerCase();
  const nextScreen = String(source.nextScreen || source.screen || '').toLowerCase();
  return Boolean(
    source.shouldEnterGame
    || source.directStart
    || source.startImmediately
    || source.botsMatchStarted
    || stage === 'game_started'
    || stage === 'bots_match_started'
    || nextScreen === 'gameplay'
    || isActiveMatchStatus(source.status)
    || isActiveMatchStatus(source.matchStatus)
    || isActiveMatchStatus(match.status)
    || isActiveMatchStatus(match.matchStatus)
  );
}

function mergeSocketMatchmakingState(source = {}, matchmakingSource = null) {
  const merged = { ...(matchmakingSource || {}) };

  [
    'queueId',
    'matchId',
    'roomId',
    'playersFound',
    'requiredPlayers',
    'startsAt',
    'countdownStartedAt',
    'entryFeeCharged',
    'backgroundKey',
    'gameplayBackgroundKey',
    'backgroundAsset',
    'gameplayBackgroundAsset',
    'backgroundUrl',
    'gameplayBackgroundUrl',
    'backgroundImage',
    'tableBackgroundUrl',
    'backgroundSource',
    'backgroundScope',
    'backgroundVariant',
    'backgroundContractVersion',
    'background',
  ].forEach((key) => {
    if (source[key] !== undefined && merged[key] === undefined) merged[key] = source[key];
  });

  if (source.status !== undefined) merged.status = source.status;
  if (source.stage !== undefined) merged.stage = source.stage;
  if (source.matchStatus !== undefined) merged.matchStatus = source.matchStatus;
  if (isGameStartedPayload(source)) merged.shouldEnterGame = true;

  return merged;
}

function getChatMessageId(message = {}) {
  return String(
    message.id ||
    message.messageId ||
    message.chatId ||
    [message.matchId, message.userId || message.playerId, message.createdAt || message.timestamp, message.text || message.message].filter(Boolean).join(':') ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function normalizeChatMessage(message = {}) {
  const source = unwrapBackendPayload(message);
  const text = String(source.text ?? source.message ?? source.body ?? '').trim();
  if (!text) return null;

  return {
    ...source,
    id: getChatMessageId(source),
    messageId: source.messageId || source.id || getChatMessageId(source),
    matchId: source.matchId || source.gameId || source.roomId || null,
    roomId: source.roomId || null,
    userId: source.userId || source.senderId || source.accountId || null,
    playerId: source.playerId || source.userId || source.senderId || null,
    username: source.username || source.displayName || source.senderName || source.name || 'Player',
    displayName: source.displayName || source.username || source.senderName || source.name || 'Player',
    avatar: source.avatar || source.avatarId || source.avatarUrl || null,
    avatarId: source.avatarId || source.avatar || null,
    avatarUrl: source.avatarUrl || null,
    text,
    createdAt: source.createdAt || source.timestamp || new Date().toISOString(),
  };
}

function extractChatMessages(payload = {}) {
  const sources = getBackendPayloadSources(payload);
  const messages = [];

  for (const source of sources) {
    const sourceMessages = source.messages || source.chatMessages || source.history || source.chatHistory;
    if (Array.isArray(sourceMessages)) messages.push(...sourceMessages);
    if (source.message && typeof source.message === 'object') messages.push(source.message);
    if (source.chatMessage && typeof source.chatMessage === 'object') messages.push(source.chatMessage);
    if (source.text || source.body) messages.push(source);
  }

  return messages.map(normalizeChatMessage).filter(Boolean);
}

function mergeChatMessageLists(currentMessages = [], incomingMessages = []) {
  const byId = new Map();
  for (const message of [...currentMessages, ...incomingMessages]) {
    const normalized = normalizeChatMessage(message);
    if (!normalized) continue;
    byId.set(normalized.id, normalized);
  }

  return Array.from(byId.values())
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    .slice(-50);
}

function extractChatError(payload = {}) {
  const source = unwrapBackendPayload(payload);
  return source.reason || source.message || source.error || source.data?.message || 'Chat error';
}

function getBackendPayloadSources(payload = {}) {
  if (Array.isArray(payload)) return payload.flatMap(getBackendPayloadSources);
  if (!payload || typeof payload !== 'object') return [];

  const sources = [unwrapBackendPayload(payload)];
  if (Array.isArray(payload.gameDataPayloads)) sources.push(...payload.gameDataPayloads.flatMap(getBackendPayloadSources));
  if (Array.isArray(payload.payloads)) sources.push(...payload.payloads.flatMap(getBackendPayloadSources));
  if (payload.data && typeof payload.data === 'object' && payload.data !== payload) sources.push(...getBackendPayloadSources(payload.data));
  return sources.filter(Boolean);
}

const BOT_MODE_ALIASES = new Set(['bot', 'bots', 'pve', 'ai', 'cpu', 'computer', 'solo', 'singleplayer', 'single-player', 'vs-bot', 'vs-bots']);

function normalizeModeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

function isBotsDirectStartResult(result = {}, patch = {}, settings = {}) {
  const sources = getBackendPayloadSources(result);
  const explicitDirectStart = sources.some((source) => Boolean(
    source.directStart ||
    source.shouldEnterGame ||
    source.botsMatchStarted ||
    source.startImmediately ||
    String(source.stage || '').toLowerCase() === 'bots_match_started'
  ));
  const hasMatch = Boolean(patch.match || patch.currentMatchId || sources.some((source) => source.match || source.matchId));
  return hasMatch && (explicitDirectStart || isBotsModeSettings(settings));
}

function normalizeRecentRoom(room = {}, roomCode) {
  const code = room.code || room.roomCode || roomCode;
  if (!code) return null;

  const playerCount = room.playerCount || room.players?.length || 1;
  const maxPlayers = room.maxPlayers || 4;

  return {
    code,
    name: room.name || room.title || 'Private Room',
    players: `${playerCount} / ${maxPlayers}`,
  };
}

function normalizeRoom(room = {}) {
  if (!room || typeof room !== 'object') return null;

  const players = Array.isArray(room.players) ? room.players : [];
  const playerIds = Array.isArray(room.playerIds)
    ? room.playerIds
    : players.map((player) => (typeof player === 'string' ? player : (player?.id || player?.userId))).filter(Boolean);

  const id = room.id || room.roomId || room.key || room.code || room.roomCode;
  if (!id) return null;

  const code = room.code || room.roomCode || room.roomCodeText || null;
  const maxPlayers = Number(room.maxPlayers || room.selectedPlayers || 4);
  const playerCount = Number(room.playerCount || playerIds.length || players.length || 0);
  const backendPricing = normalizeBackendPricing(room);
  const backgroundContract = resolveGameplayBackgroundContract([room], {
    fallbackKey: room.isPrivate ? 'private_room' : undefined,
  });

  return {
    ...room,
    ...backgroundContract,
    id,
    roomId: room.roomId || id,
    key: room.key || id,
    code,
    roomCode: code,
    name: room.name || room.title || 'Liar’s Dice Room',
    players,
    playerIds,
    playerCount,
    maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : 4,
    pricing: backendPricing.pricing,
    rewards: backendPricing.rewards,
    buyIn: room.buyIn || backendPricing.buyIn || '',
    buyInAmount: backendPricing.pricing.buyInAmount,
    entryFee: backendPricing.pricing.entryFee,
    perGameMode: backendPricing.pricing.perGameMode,
    coinBetMode: backendPricing.pricing.coinBetMode,
    perGameBase: backendPricing.pricing.perGameBase,
    perGameOptions: backendPricing.pricing.perGameOptions,
    selectedPerGame: backendPricing.pricing.selectedPerGame,
    selectedPerGameAmount: backendPricing.pricing.selectedPerGameAmount,
    perGameAmount: backendPricing.pricing.perGameAmount,
    roundStake: backendPricing.pricing.roundStake,
    coinBetOptions: backendPricing.pricing.coinBetOptions,
    minCoinBet: backendPricing.pricing.minCoinBet,
    maxCoinBet: backendPricing.pricing.maxCoinBet,
    defaultCoinBet: backendPricing.pricing.defaultCoinBet,
    minBidCoins: backendPricing.pricing.minBidCoins,
    maxBidCoins: backendPricing.pricing.maxBidCoins,
    defaultBidCoins: backendPricing.pricing.defaultBidCoins,
    pekEnabled: backendPricing.pricing.pekEnabled,
    slamEnabled: backendPricing.pricing.slamEnabled,
    pekPercentage: backendPricing.pricing.pekPercentage,
    slamPercentage: backendPricing.pricing.slamPercentage,
    finalPekAmount: backendPricing.pricing.finalPekAmount,
    finalSlamAmount: backendPricing.pricing.finalSlamAmount,
    requiredPekCoverAmount: backendPricing.pricing.requiredPekCoverAmount,
    maxChallengeAmount: backendPricing.pricing.maxChallengeAmount,
    roomMode: isBotsModeSettings(room) ? 'bots' : (room.roomMode || room.gameMode || room.playMode || 'normal'),
    isPrivate: Boolean(room.isPrivate),
    visibility: room.isPrivate ? 'private' : (room.visibility || 'public'),
    turnTimer: Number(room.turnTimer || room.selectedTimer || 30),
    isFull: Boolean(room.isFull ?? (playerCount >= maxPlayers)),
    status: room.status || 'waiting',
    matchId: room.matchId || null,
  };
}

function extractGameDataPatch(payload = {}) {
  const source = unwrapBackendPayload(payload);
  const patch = {};

  if (source.user) patch.user = normalizeUser(source.user);
  if (source.profile) patch.user = normalizeUser(source.profile);
  if (source.summary && typeof source.summary === 'object') patch.user = normalizeUser({ ...(patch.user || {}), ...source.summary });
  if (source.profileSummary && typeof source.profileSummary === 'object') patch.user = normalizeUser({ ...(patch.user || {}), ...source.profileSummary });
  if (source.stats && typeof source.stats === 'object' && !Array.isArray(source.stats)) {
    patch.user = normalizeUser({ ...(patch.user || source.user || source.profile || {}), stats: source.stats });
  }

  const walletSource = source.wallet
    || source.viewerWallet
    || source.balance
    || source.user?.wallet
    || source.viewerUser?.wallet
    || source.match?.wallet
    || source.match?.viewerWallet
    || (source.coins !== undefined || source.gems !== undefined || source.diamonds !== undefined ? source : null);
  if (walletSource) patch.wallet = normalizeWallet(walletSource);

  const selectableRooms = source.tiers || source.roomTiers || source.tables || source.lobbies || source.tableTiers || null;
  if (Array.isArray(selectableRooms)) patch.rooms = selectableRooms.map(normalizeSelectableRoom).filter(Boolean);

  if (source.defaultTable) patch.defaultTable = normalizeSelectableRoom(source.defaultTable, 0) || source.defaultTable;
  if (source.playNowTable) patch.playNowTable = normalizeSelectableRoom(source.playNowTable, 0) || source.playNowTable;

  if (Array.isArray(source.rooms)) {
    if (looksLikeActiveBackendRooms(source.rooms)) patch.activeRooms = source.rooms.map(normalizeRoom).filter(Boolean);
    else if (looksLikeSelectableRooms(source.rooms)) patch.rooms = source.rooms.map(normalizeSelectableRoom).filter(Boolean);
    else patch.activeRooms = source.rooms.map(normalizeRoom).filter(Boolean);
  }
  if (Array.isArray(source.activeRooms)) patch.activeRooms = source.activeRooms.map(normalizeRoom).filter(Boolean);
  if (Array.isArray(source.publicRooms)) patch.publicRooms = source.publicRooms.map(normalizeRoom).filter(Boolean);
  if (source.myRoom !== undefined) {
    patch.myRoom = source.myRoom ? normalizeRoom(source.myRoom) : null;
    if (patch.myRoom) {
      patch.currentRoom = patch.myRoom;
      patch.currentRoomId = patch.myRoom.roomId || patch.myRoom.id;
      patch.currentRoomCode = patch.myRoom.roomCode || patch.myRoom.code;
    } else {
      patch.currentRoom = null;
      patch.currentRoomId = null;
      patch.currentRoomCode = null;
    }
  }

  if (source.currentRoom === null || source.room === null) {
    patch.currentRoom = null;
    patch.currentRoomId = null;
    patch.currentRoomCode = null;
    patch.createRoom = { roomCode: null };
  }

  const rewardList = source.rewards || source.dailyRewards || source.daily?.rewards;
  if (Array.isArray(rewardList)) patch.dailyRewards = normalizeDailyRewards(rewardList);

  const dailyRewardSummary = normalizeDailyRewardSummary(source.daily || source);
  if (dailyRewardSummary) patch.dailyRewardSummary = dailyRewardSummary;

  if (Array.isArray(source.tournaments)) patch.tournaments = normalizeTournaments(source.tournaments);
  if (source.tournament) patch.selectedTournament = normalizeTournament(source.tournament);
  if (Array.isArray(source.leaderboard)) patch.tournamentLeaderboard = source.leaderboard;

  const passSource = source.pass || (source.passXp !== undefined || source.passLevel !== undefined || source.premiumUnlocked !== undefined || Array.isArray(source.levels) ? source : null);
  if (passSource) patch.tournamentPass = normalizeTournamentPass(passSource);

  if (Array.isArray(source.events)) patch.specialEvents = normalizeEvents(source.events);
  if (source.event) patch.selectedEvent = normalizeEvent(source.event);

  const missionList = source.missions || source.eventMissions;
  if (Array.isArray(missionList)) patch.eventMissions = normalizeEventMissions(missionList);

  const summarySource = source.summary && typeof source.summary === 'object' ? source.summary : null;
  const profileSummarySource = source.profileSummary && typeof source.profileSummary === 'object' ? source.profileSummary : null;

  if (Array.isArray(source.achievements)) patch.achievements = source.achievements;
  if (!patch.achievements && Array.isArray(summarySource?.achievements)) patch.achievements = summarySource.achievements;
  if (!patch.achievements && Array.isArray(profileSummarySource?.achievements)) patch.achievements = profileSummarySource.achievements;

  if (Array.isArray(source.recentMatches)) patch.recentMatches = source.recentMatches;
  if (Array.isArray(source.matchHistory)) patch.recentMatches = source.matchHistory;
  if (!patch.recentMatches && Array.isArray(summarySource?.recentMatches)) patch.recentMatches = summarySource.recentMatches;
  if (!patch.recentMatches && Array.isArray(summarySource?.matchHistory)) patch.recentMatches = summarySource.matchHistory;
  if (!patch.recentMatches && Array.isArray(profileSummarySource?.recentMatches)) patch.recentMatches = profileSummarySource.recentMatches;
  if (!patch.recentMatches && Array.isArray(profileSummarySource?.matchHistory)) patch.recentMatches = profileSummarySource.matchHistory;

  if (Array.isArray(source.seasons)) patch.seasons = source.seasons;
  if (!patch.seasons && Array.isArray(summarySource?.seasons)) patch.seasons = summarySource.seasons;
  if (!patch.seasons && Array.isArray(profileSummarySource?.seasons)) patch.seasons = profileSummarySource.seasons;

  if (source.favorites && typeof source.favorites === 'object') patch.favorites = source.favorites;
  if (!patch.favorites && summarySource?.favorites && typeof summarySource.favorites === 'object') patch.favorites = summarySource.favorites;
  if (!patch.favorites && profileSummarySource?.favorites && typeof profileSummarySource.favorites === 'object') patch.favorites = profileSummarySource.favorites;
  if (Array.isArray(source.transactions)) patch.transactions = source.transactions.map(normalizeTransaction);
  if (Array.isArray(source.transactionLedger)) patch.transactions = source.transactionLedger.map(normalizeTransaction);

  const matchSource = source.match || source.gameState || source.game || source.activeMatch || null;
  if (matchSource && typeof matchSource === 'object') {
    const matchBackgroundContract = resolveGameplayBackgroundContract([
      matchSource,
      matchSource.table,
      matchSource.selectedTable,
      matchSource.room,
      source,
      source.table,
      source.selectedTable,
      source.room,
    ]);
    patch.match = { ...matchSource, ...matchBackgroundContract };
    if (matchSource.id || matchSource.matchId) patch.currentMatchId = matchSource.id || matchSource.matchId;
    if (Object.prototype.hasOwnProperty.call(matchSource, 'roundResult')) {
      patch.roundResult = matchSource.roundResult || null;
    } else if (Object.prototype.hasOwnProperty.call(matchSource, 'lastRoundResult')) {
      patch.roundResult = matchSource.lastRoundResult || null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(source, 'roundResult')) {
    patch.roundResult = source.roundResult || null;
  } else if (Object.prototype.hasOwnProperty.call(source, 'lastRoundResult')) {
    patch.roundResult = source.lastRoundResult || null;
  }

  const matchResult = normalizeMatchResult(source);
  if (matchResult) patch.matchResult = matchResult;

  const hasTopLevelMatchmaking = [
    'queueId',
    'matchStatus',
    'playersFound',
    'requiredPlayers',
    'matchStartDelayMs',
    'startsAt',
    'countdownStartedAt',
    'entryFeeCharged',
  ].some((key) => Object.prototype.hasOwnProperty.call(source, key));

  const matchmakingSource = source.matchmaking || source.queue || source.queueStatus || (hasTopLevelMatchmaking ? source : null);
  if (matchmakingSource) {
    const mergedMatchmakingSource = mergeSocketMatchmakingState(source, matchmakingSource);
    const matchmakingBackgroundContract = resolveGameplayBackgroundContract([
      mergedMatchmakingSource,
      mergedMatchmakingSource.selectedTable,
      mergedMatchmakingSource.table,
      source,
      source.selectedTable,
      source.table,
    ]);
    patch.serverMatchmaking = { ...mergedMatchmakingSource, ...matchmakingBackgroundContract };
    const serverMatchmakingUi = normalizeMatchmakingUi(mergedMatchmakingSource);
    if (serverMatchmakingUi) patch.matchmaking = serverMatchmakingUi;
    if (mergedMatchmakingSource.selectedTable || mergedMatchmakingSource.table || mergedMatchmakingSource.tier) {
      const selectedTableSource = mergedMatchmakingSource.selectedTable || mergedMatchmakingSource.table || mergedMatchmakingSource.tier;
      patch.selectedTable = normalizeSelectableRoom(selectedTableSource, 0) || selectedTableSource;
    }
  }

  if (source.selectedTable || source.table || source.tier) {
    const selectedTableSource = source.selectedTable || source.table || source.tier;
    patch.selectedTable = normalizeSelectableRoom(selectedTableSource, 0) || selectedTableSource;
  }

  if (source.matchId) patch.currentMatchId = source.matchId;
  if (source.queueId) patch.currentQueueId = source.queueId;
  if (source.roomId) patch.currentRoomId = source.roomId;

  if (source.room || source.roomCode || source.code) {
    const room = normalizeRoom(source.room || {
      id: source.roomId || source.code || source.roomCode,
      roomId: source.roomId,
      code: source.roomCode || source.code,
      roomCode: source.roomCode || source.code,
    });
    const roomCode = source.roomCode || source.code || room?.roomCode || room?.code;

    if (room) {
      patch.currentRoom = room;
      patch.currentRoomId = room.roomId || room.id;
      patch.currentRoomCode = roomCode;
      if (room.matchId && ['countdown', 'in_match'].includes(String(room.status || '').toLowerCase())) {
        patch.currentMatchId = room.matchId;
      }
    }

    patch.createRoom = { roomCode };

    const recentRoom = normalizeRecentRoom(room || {}, roomCode);
    if (recentRoom) patch.recentRoom = recentRoom;
  }

  return patch;
}

function mergeGameData(current, patch) {
  const next = { ...current };

  if (patch.user) next.user = { ...current.user, ...patch.user };
  if (patch.wallet) next.wallet = { ...current.wallet, ...patch.wallet };
  if (patch.rooms) next.rooms = patch.rooms;
  if (patch.defaultTable) next.defaultTable = patch.defaultTable;
  if (patch.playNowTable) next.playNowTable = patch.playNowTable;
  if (patch.dailyRewards) next.dailyRewards = patch.dailyRewards;
  if (patch.dailyRewardSummary) next.dailyRewardSummary = { ...current.dailyRewardSummary, ...patch.dailyRewardSummary };
  if (patch.tournaments) next.tournaments = patch.tournaments;
  if (patch.tournamentPass) next.tournamentPass = { ...current.tournamentPass, ...patch.tournamentPass };
  if (patch.selectedTournament) next.selectedTournament = patch.selectedTournament;
  if (patch.tournamentLeaderboard) next.tournamentLeaderboard = patch.tournamentLeaderboard;
  if (patch.specialEvents) next.specialEvents = patch.specialEvents;
  if (patch.selectedEvent) next.selectedEvent = patch.selectedEvent;
  if (patch.eventMissions) next.eventMissions = patch.eventMissions;
  if (patch.achievements) next.achievements = patch.achievements;
  if (patch.recentMatches) next.recentMatches = patch.recentMatches;
  if (patch.seasons) next.seasons = patch.seasons;
  if (patch.favorites) next.favorites = { ...current.favorites, ...patch.favorites };
  if (Object.prototype.hasOwnProperty.call(patch, 'match')) next.match = patch.match;
  if (Object.prototype.hasOwnProperty.call(patch, 'roundResult')) next.roundResult = patch.roundResult;
  if (patch.matchResult) next.matchResult = { ...current.matchResult, ...patch.matchResult };
  if (Object.prototype.hasOwnProperty.call(patch, 'serverMatchmaking')) next.serverMatchmaking = patch.serverMatchmaking;
  if (patch.selectedTable) {
    const currentSelectionLocked = isCreateRoomGameplaySource(current.selectedTable);
    const incomingSelectionLocked = isCreateRoomGameplaySource(patch.selectedTable);
    const incomingLooksCatalogDefault = !incomingSelectionLocked && ['beginner', 'table_buyin_500', 'table-buyin-500'].includes(String(patch.selectedTable.key || patch.selectedTable.tableId || patch.selectedTable.id || patch.selectedTable.backgroundKey || '').toLowerCase());
    if (!currentSelectionLocked || incomingSelectionLocked || !incomingLooksCatalogDefault) {
      next.selectedTable = patch.selectedTable;
    }
  }
  if (patch.matchmaking) next.matchmaking = patch.matchmaking;
  if (patch.transactions) next.transactions = patch.transactions;
  if (patch.activeRooms) next.activeRooms = patch.activeRooms;
  if (patch.publicRooms) next.publicRooms = patch.publicRooms;
  if (Object.prototype.hasOwnProperty.call(patch, 'myRoom')) next.myRoom = patch.myRoom;
  if (Object.prototype.hasOwnProperty.call(patch, 'currentMatchId')) next.currentMatchId = patch.currentMatchId;
  if (Object.prototype.hasOwnProperty.call(patch, 'currentQueueId')) next.currentQueueId = patch.currentQueueId;
  if (Object.prototype.hasOwnProperty.call(patch, 'currentRoomId')) next.currentRoomId = patch.currentRoomId;
  if (Object.prototype.hasOwnProperty.call(patch, 'currentRoomCode')) next.currentRoomCode = patch.currentRoomCode;
  if (Object.prototype.hasOwnProperty.call(patch, 'currentRoom')) next.currentRoom = patch.currentRoom;
  if (patch.createRoom) next.createRoom = { ...current.createRoom, ...patch.createRoom };

  if (patch.recentRoom) {
    const existingRooms = current.joinRoom?.recentRooms || [];
    const filteredRooms = existingRooms.filter((room) => room.code !== patch.recentRoom.code);
    next.joinRoom = {
      ...current.joinRoom,
      defaultCode: patch.recentRoom.code,
      recentRooms: [patch.recentRoom, ...filteredRooms].slice(0, 6),
    };
  }

  if (!patch.matchmaking && (patch.serverMatchmaking || patch.match || patch.currentMatchId || patch.selectedTable)) {
    next.matchmaking = buildMatchmakingUi(
      next.selectedTable || current.selectedTable || {},
      next.serverMatchmaking || current.serverMatchmaking || {},
      next.match || current.match || null,
      next.currentMatchId || current.currentMatchId || null,
    );
  }

  return next;
}

export default function App() {
  const [screen, setScreen] = useState(() => {
    const initialScreen = getScreenFromPathname(window.location.pathname);
    if (isProtectedScreen(initialScreen) && !hasAccessToken()) {
      window.history.replaceState({ screen: 'starter' }, '', getPathForScreen('starter'));
      return 'starter';
    }
    return initialScreen;
  });
  const [gameData, setGameData] = useState(initialGameData);
  const [mockGameplayData, setMockGameplayData] = useState(mockGameData);
  const [backendStatus, setBackendStatus] = useState({ loading: false, error: null, lastAction: null });
  const [starterAssetsReady, setStarterAssetsReady] = useState(false);
  const [bootAssetLoading, setBootAssetLoading] = useState({
    active: true,
    phase: BOOT_PRELOAD_PHASE,
    destinationLabel: 'start screen',
    progress: 1,
    loaded: 0,
    total: 0,
  });
  const assetNavigationIdRef = useRef(0);
  const layout = useFixedViewport();
  const i18n = useLanguage();
  const ScreenComponent = SCREENS[screen] || StarterScreen;

  useEffect(() => {
    let active = true;
    const starterAssets = getAssetsForPhase(BOOT_PRELOAD_PHASE);
    const startedAt = Date.now();
    const minVisibleMs = 900;

    const finishBoot = async () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed < minVisibleMs) {
        await new Promise((resolve) => window.setTimeout(resolve, minVisibleMs - elapsed));
      }

      if (!active) return;
      preloadedPhases.add(BOOT_PRELOAD_PHASE);
      preloadedCriticalScreens.add('starter');
      setBootAssetLoading((current) => ({
        ...current,
        active: false,
        progress: 100,
        loaded: starterAssets.length,
        total: starterAssets.length,
      }));
      setStarterAssetsReady(true);
    };

    if (!starterAssets.length) {
      finishBoot();
      return () => { active = false; };
    }

    setBootAssetLoading({
      active: true,
      phase: BOOT_PRELOAD_PHASE,
      destinationLabel: 'start screen',
      progress: 1,
      loaded: 0,
      total: starterAssets.length,
    });

    preloadAssets(starterAssets, {
      concurrency: 6,
      timeoutMs: 12000,
      onProgress: ({ loaded, total, percent }) => {
        if (!active) return;
        setBootAssetLoading({
          active: true,
          phase: BOOT_PRELOAD_PHASE,
          destinationLabel: 'start screen',
          progress: Math.max(1, Math.min(100, percent || 1)),
          loaded,
          total,
        });
      },
    })
      .catch(() => {
        // Never trap the player on the boot preloader if an optional image fails.
      })
      .finally(finishBoot);

    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.device = layout.mode;
    document.documentElement.dataset.physicalDevice = layout.deviceMode || layout.mode;
    document.documentElement.dataset.orientation = layout.orientation;
  }, [layout.mode, layout.deviceMode, layout.orientation]);

  useEffect(() => {
    document.documentElement.dataset.language = i18n.language;
  }, [i18n.language]);

  useEffect(() => {
    if (!starterAssetsReady) return;
    if (screen !== 'mainmenu' && screen !== 'roomselect') return;
    if (preloadedPhases.has(BACKGROUND_PRELOAD_PHASE)) return;

    const backgroundAssets = getAssetsForPhase(BACKGROUND_PRELOAD_PHASE);
    if (!backgroundAssets.length) {
      preloadedPhases.add(BACKGROUND_PRELOAD_PHASE);
      return;
    }

    preloadedPhases.add(BACKGROUND_PRELOAD_PHASE);
    const task = preloadAssetsInBackground(backgroundAssets, {
      concurrency: 2,
      timeoutMs: 10000,
      delayMs: 900,
      idleTimeoutMs: 3000,
    });

    task.promise.then(() => {
      ['login', 'createroom', 'joinroom', 'roomlobby', 'profile', 'dailyreward', 'tournamentpass', 'specialevent', 'help'].forEach((screenName) => {
        preloadedCriticalScreens.add(screenName);
      });
    });
  }, [screen, starterAssetsReady]);

  useEffect(() => {
    const handlePopState = () => {
      setScreen(getScreenFromPathname(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const visualViewport = window.visualViewport;

    const isEditableElement = (element) => {
      if (!element) return false;
      const tagName = element.tagName?.toLowerCase();
      return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || element.isContentEditable;
    };

    const clearKeyboardCssVariables = () => {
      root.style.removeProperty('--keyboard-height');
      root.style.removeProperty('--keyboard-visual-width');
      root.style.removeProperty('--keyboard-visual-height');
      root.style.removeProperty('--keyboard-offset-top');
      root.style.removeProperty('--keyboard-offset-left');
    };

    const setKeyboardOpen = (isOpen, metrics = {}) => {
      root.classList.toggle('keyboard-open', isOpen);
      body?.classList.toggle('keyboard-open', isOpen);

      if (!isOpen) {
        clearKeyboardCssVariables();
        return;
      }

      root.style.setProperty('--keyboard-height', `${Math.max(0, Math.round(metrics.keyboardHeight || 0))}px`);
      root.style.setProperty('--keyboard-visual-width', `${Math.max(0, Math.round(metrics.visualWidth || 0))}px`);
      root.style.setProperty('--keyboard-visual-height', `${Math.max(0, Math.round(metrics.visualHeight || 0))}px`);
      root.style.setProperty('--keyboard-offset-top', `${Math.max(0, Math.round(metrics.offsetTop || 0))}px`);
      root.style.setProperty('--keyboard-offset-left', `${Math.max(0, Math.round(metrics.offsetLeft || 0))}px`);
    };

    const refreshKeyboardState = () => {
      const hasFocusedInput = isEditableElement(document.activeElement);
      const viewportHeight = window.innerHeight || root.clientHeight || 0;
      const viewportWidth = window.innerWidth || root.clientWidth || 0;
      const visualHeight = visualViewport?.height || viewportHeight;
      const visualWidth = visualViewport?.width || viewportWidth;
      const offsetTop = visualViewport?.offsetTop || 0;
      const offsetLeft = visualViewport?.offsetLeft || 0;
      const keyboardHeight = Math.max(0, viewportHeight - visualHeight - offsetTop);
      const keyboardConsumesViewport = keyboardHeight > 80;
      const isOpen = layout.deviceMode === 'mobile' && (hasFocusedInput || keyboardConsumesViewport);

      setKeyboardOpen(isOpen, {
        keyboardHeight,
        visualWidth,
        visualHeight,
        offsetTop,
        offsetLeft,
      });

      if (isOpen) {
        window.setTimeout(() => window.scrollTo(0, 0), 0);
        window.setTimeout(() => window.scrollTo(0, 0), 120);
      }
    };

    const handleFocusIn = (event) => {
      if (isEditableElement(event.target)) refreshKeyboardState();
    };

    const handleFocusOut = () => {
      window.setTimeout(refreshKeyboardState, 120);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    visualViewport?.addEventListener('resize', refreshKeyboardState);
    visualViewport?.addEventListener('scroll', refreshKeyboardState);
    refreshKeyboardState();

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      visualViewport?.removeEventListener('resize', refreshKeyboardState);
      visualViewport?.removeEventListener('scroll', refreshKeyboardState);
      setKeyboardOpen(false);
    };
  }, [layout.mode, layout.deviceMode]);

  useEffect(() => {
    let active = true;

    backendBridge.resumeSession()
      .then((result) => {
        if (!active) return;

        if (result?.noSession) {
          setGameData(initialGameData);
          if (isProtectedScreen(screen)) {
            setScreen('starter');
            window.history.replaceState({ screen: 'starter' }, '', getPathForScreen('starter'));
          }
          return;
        }

        const payloads = result?.gameDataPayloads || [result];
        const patches = payloads
          .filter(Boolean)
          .map(extractGameDataPatch)
          .filter((patch) => Object.keys(patch).length > 0);

        if (patches.length) {
          setGameData((current) => patches.reduce((next, patch) => mergeGameData(next, patch), current));
        }
      })
      .catch(() => {
        setGameData(initialGameData);
        if (isProtectedScreen(screen)) {
          setScreen('starter');
          window.history.replaceState({ screen: 'starter' }, '', getPathForScreen('starter'));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const activeBackgroundData = screen === 'mockgame' ? mockGameplayData : gameData;
  const activeTableMusicTrack = useMemo(() => resolveTableMusicTrack(screen, activeBackgroundData), [screen, activeBackgroundData]);
  const gameplayBackground = useMemo(() => resolveGameDataBackground(activeBackgroundData), [activeBackgroundData]);
  const createRoomBackground = useMemo(() => resolveCreateRoomScreenBackgroundContract(), []);
  const roomLobbyBackground = useMemo(() => resolveRoomLobbyBackgroundContract(activeBackgroundData), [activeBackgroundData]);

  useEffect(() => {
    if (!starterAssetsReady) return undefined;
    syncTableMusic(activeTableMusicTrack);
    return () => stopTableMusic();
  }, [starterAssetsReady, activeTableMusicTrack?.id, activeTableMusicTrack?.audioSrc]);

  const appStyle = useMemo(() => {
    const nextStyle = {
      '--design-width': `${layout.resolution.width}px`,
      '--design-height': `${layout.resolution.height}px`,
      '--ui-scale': layout.scale,
      '--gameplay-background-image': toCssBackgroundImageValue(gameplayBackground.backgroundUrl),
      '--gameplay-portrait-background-image': toCssBackgroundImageValue(
        gameplayBackground.gameplayPortraitBackgroundUrl
        || gameplayBackground.portraitUrl
        || gameplayBackground.backgroundPortraitUrl
        || gameplayBackground.backgroundUrl,
      ),
      '--create-room-background-image': toCssBackgroundImageValue(createRoomBackground.backgroundUrl),
    };

    if (roomLobbyBackground?.backgroundUrl) {
      nextStyle['--room-lobby-background-image'] = toCssBackgroundImageValue(roomLobbyBackground.backgroundUrl);
    }

    return nextStyle;
  }, [layout, gameplayBackground, createRoomBackground, roomLobbyBackground]);

  const navigateToScreen = (nextScreen) => {
    const safeScreen = SCREENS[nextScreen] ? nextScreen : 'starter';
    const nextPath = getPathForScreen(safeScreen);
    setScreen(safeScreen);

    if (window.location.pathname !== nextPath) {
      window.history.pushState({ screen: safeScreen }, '', nextPath);
    }
  };

  const setAssetLoadingState = (statePatch) => {
    setGameData((current) => ({
      ...current,
      assetLoading: {
        ...(current.assetLoading || {}),
        ...statePatch,
      },
    }));
  };

  const preloadAndNavigate = async (nextScreen, options = {}) => {
    const safeScreen = SCREENS[nextScreen] ? nextScreen : 'starter';
    const phaseName = options.phaseName || null;
    const preloadKey = options.preloadKey || phaseName || safeScreen;
    const assets = options.assets || (phaseName ? getAssetsForPhase(phaseName) : getAssetsForScreen(safeScreen));
    const alreadyPreloaded = phaseName ? preloadedPhases.has(preloadKey) : preloadedCriticalScreens.has(preloadKey);
    const shouldGate = assets.length > 0 && !alreadyPreloaded;

    if (!shouldGate) {
      navigateToScreen(safeScreen);
      return;
    }

    assetNavigationIdRef.current += 1;
    const navId = assetNavigationIdRef.current;
    const destinationLabel = options.destinationLabel || PRELOAD_SCREEN_LABELS[safeScreen] || 'assets';

    setAssetLoadingState({
      active: true,
      phase: phaseName,
      screen: safeScreen,
      destinationLabel,
      progress: 1,
      loaded: 0,
      total: assets.length,
    });
    navigateToScreen('loading');

    const startedAt = Date.now();

    try {
      await preloadAssets(assets, {
        concurrency: options.concurrency ?? 8,
        timeoutMs: options.timeoutMs ?? 15000,
        onProgress: ({ loaded, total, percent }) => {
          if (navId !== assetNavigationIdRef.current) return;
          setAssetLoadingState({
            active: true,
            phase: phaseName,
            screen: safeScreen,
            destinationLabel,
            progress: Math.max(1, Math.min(100, percent || 1)),
            loaded,
            total,
          });
        },
      });
    } catch {
      // Do not block the player forever if one critical image fails.
    }

    if (navId !== assetNavigationIdRef.current) return;

    const elapsed = Date.now() - startedAt;
    const minVisibleMs = options.minVisibleMs ?? 350;
    if (elapsed < minVisibleMs) {
      await new Promise((resolve) => window.setTimeout(resolve, minVisibleMs - elapsed));
    }

    if (phaseName) {
      preloadedPhases.add(preloadKey);
    } else {
      preloadedCriticalScreens.add(preloadKey);
    }

    if (phaseName === PLAY_FLOW_PRELOAD_PHASE || safeScreen === 'mainmenu') {
      ['mainmenu', 'roomselect', 'matchmaking', 'gameplay', 'win'].forEach((screenName) => {
        preloadedCriticalScreens.add(screenName);
      });
    }

    setAssetLoadingState({
      active: false,
      phase: phaseName,
      screen: safeScreen,
      destinationLabel,
      progress: 100,
      loaded: assets.length,
      total: assets.length,
    });
    navigateToScreen(safeScreen);
  };

  const navigation = {
    goStarter: () => navigateToScreen('starter'),
    goLogin: () => preloadAndNavigate('login', { destinationLabel: 'login screen', minVisibleMs: 250 }),
    goLoading: () => preloadAndNavigate('mainmenu', {
      destinationLabel: 'game assets',
      phaseName: PLAY_FLOW_PRELOAD_PHASE,
      preloadKey: PLAY_FLOW_PRELOAD_PHASE,
      minVisibleMs: 650,
      concurrency: 8,
    }),
    goMainMenu: () => preloadAndNavigate('mainmenu', {
      destinationLabel: 'game assets',
      phaseName: PLAY_FLOW_PRELOAD_PHASE,
      preloadKey: PLAY_FLOW_PRELOAD_PHASE,
      minVisibleMs: 650,
      concurrency: 8,
    }),
    goRoomSelect: () => preloadAndNavigate('roomselect', { destinationLabel: 'room select' }),
    goCreateRoom: () => preloadAndNavigate('createroom', { destinationLabel: 'create room', minVisibleMs: 180, concurrency: 4 }),
    goJoinRoom: () => preloadAndNavigate('joinroom', { destinationLabel: 'join room', minVisibleMs: 180, concurrency: 4 }),
    goRoomLobby: () => preloadAndNavigate('roomlobby', { destinationLabel: 'room lobby', minVisibleMs: 180, concurrency: 4 }),
    goMatchmaking: () => preloadAndNavigate('matchmaking', { destinationLabel: 'matchmaking', minVisibleMs: 180, concurrency: 4 }),
    goGameplay: () => preloadAndNavigate('gameplay', { destinationLabel: 'gameplay', minVisibleMs: 180, concurrency: 4 }),
    goWin: () => preloadAndNavigate('win', { destinationLabel: 'result screen', minVisibleMs: 180, concurrency: 4 }),
    goHelp: () => preloadAndNavigate('help', { destinationLabel: 'help screen', minVisibleMs: 180, concurrency: 4 }),
    goProfile: () => preloadAndNavigate('profile', { destinationLabel: 'profile', minVisibleMs: 180, concurrency: 4 }),
    goSpecialEvent: () => preloadAndNavigate('specialevent', { destinationLabel: 'special event', minVisibleMs: 180, concurrency: 4 }),
    goDailyReward: () => preloadAndNavigate('dailyreward', { destinationLabel: 'daily rewards', minVisibleMs: 180, concurrency: 4 }),
    goTournamentPass: () => preloadAndNavigate('tournamentpass', { destinationLabel: 'tournament pass', minVisibleMs: 180, concurrency: 4 }),
  };

  useEffect(() => {
    if (!isProtectedScreen(screen)) return;
    if (hasAccessToken()) return;
    navigateToScreen('starter');
  }, [screen]);

  const applyBackendPayloads = (result) => {
    const payloads = result?.gameDataPayloads || (Array.isArray(result) ? result : [result]);
    const patches = payloads
      .filter(Boolean)
      .map(extractGameDataPatch)
      .filter((patch) => Object.keys(patch).length > 0);

    if (!patches.length) return;

    setGameData((current) => patches.reduce((next, patch) => mergeGameData(next, patch), current));
  };

  const runBackendAction = async (actionName, callback, fallbackNavigation) => {
    setBackendStatus({ loading: true, error: null, lastAction: actionName });
    try {
      const result = callback ? await callback() : null;
      applyBackendPayloads(result);
      setBackendStatus({ loading: false, error: null, lastAction: actionName });
      if (fallbackNavigation) fallbackNavigation(result);
      return result;
    } catch (error) {
      setBackendStatus({ loading: false, error: error.message || 'Backend request failed', lastAction: actionName });
      return null;
    }
  };

  const getErrorMessage = (error) => {
    const code = getBackendErrorCode(error);
    const details = error?.details || error?.data?.details || error?.payload?.details || null;
    if (code === 'INSUFFICIENT_FUNDS') {
      const requiredCoins = details?.requiredCoins ?? error?.requiredCoins;
      const availableCoins = details?.availableCoins ?? error?.availableCoins;
      if (requiredCoins !== undefined && availableCoins !== undefined) {
        return buildInsufficientFundsMessage(requiredCoins, availableCoins);
      }
      return 'Not enough chips to enter this table.';
    }

    return error?.message
      || error?.reason
      || error?.description
      || error?.data?.message
      || error?.payload?.message
      || 'Realtime connection failed';
  };

  const setChatStatus = (patch) => {
    setGameData((current) => ({
      ...current,
      chatStatus: {
        ...(current.chatStatus || {}),
        ...patch,
      },
    }));
  };

  const applyChatPayload = (payload, { replace = false } = {}) => {
    const incomingMessages = extractChatMessages(payload);
    const chatError = payload?.success === false ? extractChatError(payload) : null;

    setGameData((current) => ({
      ...current,
      chatMessages: replace
        ? mergeChatMessageLists([], incomingMessages)
        : mergeChatMessageLists(current.chatMessages || [], incomingMessages),
      chatStatus: {
        ...(current.chatStatus || {}),
        loading: false,
        sending: false,
        error: chatError,
      },
    }));

    return incomingMessages;
  };

  const clearChatForMatch = () => {
    setGameData((current) => ({
      ...current,
      chatMessages: [],
      chatStatus: { loading: false, sending: false, error: null },
    }));
  };

  const applySocketMatchmakingPayload = (payload, actionName = 'matchmaking.socket', options = {}) => {
    applyBackendPayloads(payload);
    setBackendStatus({ loading: false, error: null, lastAction: actionName });

    if (options.navigate !== false) {
      if (isGameStartedPayload(payload)) navigation.goGameplay();
      else navigation.goMatchmaking();
    }

    return payload;
  };

  const clearSocketMatchmakingState = () => {
    setGameData((current) => ({
      ...current,
      currentQueueId: null,
      serverMatchmaking: null,
      matchmaking: buildMatchmakingUi(
        current.selectedTable || current.playNowTable || current.defaultTable || {},
        {},
        current.match || null,
        current.currentMatchId || null,
      ),
    }));
  };

  const isFinishedMatchPayload = (payload = {}) => {
    const source = unwrapBackendPayload(payload);
    const match = source.match || payload.match || null;
    return Boolean(
      source.status === 'finished' ||
      source.result?.status === 'finished' ||
      source.matchResult?.status === 'finished' ||
      match?.status === 'finished'
    );
  };

  const applySocketGameplayPayload = (payload, actionName = 'match.socket') => {
    applyBackendPayloads(payload);
    setBackendStatus({ loading: false, error: null, lastAction: actionName });

    if (isFinishedMatchPayload(payload)) {
      navigation.goWin();
    }

    return payload;
  };

  const gameplaySocketHandlers = {
    onGameStarted: (socketPayload) => applySocketGameplayPayload(socketPayload, 'match.socket.started'),
    onGameState: (socketPayload) => applySocketGameplayPayload(socketPayload, 'match.socket.state'),
    onRoundResult: (socketPayload) => applySocketGameplayPayload(socketPayload, 'match.socket.round_result'),
    onGameFinished: (socketPayload) => applySocketGameplayPayload(socketPayload, 'match.socket.finished'),
    onChatMessage: (socketPayload) => applyChatPayload(socketPayload),
    onChatHistory: (socketPayload) => applyChatPayload(socketPayload, { replace: true }),
    onChatError: (error) => {
      setChatStatus({ loading: false, sending: false, error: getErrorMessage(error) });
    },
    onError: (error) => {
      setBackendStatus({ loading: false, error: getErrorMessage(error), lastAction: 'match.socket_error' });
    },
    onDisconnect: () => {
      setBackendStatus({ loading: false, error: 'Socket disconnected. Reconnecting...', lastAction: 'match.socket_disconnect' });
    },
  };

  const runRestMatchActionFallback = (actionName, callback, fallbackNavigation) => (
    runBackendAction(`${actionName}.rest_fallback`, callback, fallbackNavigation)
  );

  const backendActions = {
    login: (credentials) => runBackendAction('auth.login', () => backendBridge.login(credentials), navigation.goLoading),
    register: (payload) => runBackendAction('auth.register', () => backendBridge.register(payload), navigation.goLoading),
    loginAsGuest: () => runBackendAction('auth.guest', () => backendBridge.loginAsGuest(), navigation.goLoading),
    updateProfile: (payload) => runBackendAction('profile.update', async () => {
      const result = await backendBridge.updateProfile(payload);
      const nextAvatar = payload?.avatar || payload?.avatarId;

      if (payload?.username || nextAvatar) {
        setGameData((current) => ({
          ...current,
          user: {
            ...current.user,
            ...(payload?.username ? { username: payload.username, displayName: payload.username } : {}),
            ...(nextAvatar ? { avatar: nextAvatar, avatarId: nextAvatar } : {}),
          },
        }));
      }

      return result;
    }),
    logout: async () => {
      setBackendStatus({ loading: true, error: null, lastAction: 'auth.logout' });

      try {
        const result = await backendBridge.logout();
        disconnectGameSocket();
        setGameData(initialGameData);
        setBackendStatus({ loading: false, error: null, lastAction: 'auth.logout' });
        navigation.goStarter();
        return result;
      } catch (error) {
        disconnectGameSocket();
        setGameData(initialGameData);
        setBackendStatus({ loading: false, error: null, lastAction: 'auth.logout' });
        navigation.goStarter();
        return null;
      }
    },
    joinRoom: (room) => runBackendAction('rooms.join', () => backendBridge.joinRoom(room), navigation.goRoomLobby),
    createRoom: (settings = {}) => {
      const roomSettings = withPrivateRoomMusicMetadata(settings);
      const isBotsMode = isBotsModeSettings(roomSettings);

      setGameData((current) => ({
        ...current,
        selectedTable: roomSettings,
      }));

      return runBackendAction(
        isBotsMode ? 'bots.start' : 'rooms.create',
        () => (isBotsMode ? backendBridge.startBotsMatch(roomSettings) : backendBridge.createRoom(roomSettings)),
        (result) => {
          const patch = extractGameDataPatch(result || {});
          if (isBotsDirectStartResult(result || {}, patch, settings) || (isBotsMode && (patch.match || patch.currentMatchId || isGameStartedPayload(result || {})))) {
            clearChatForMatch();
            navigation.goGameplay();
            return;
          }
          navigation.goRoomLobby();
        },
      );
    },
    startBotsMatch: (settings = {}) => {
      const matchSettings = withPrivateRoomMusicMetadata(settings);

      setGameData((current) => ({
        ...current,
        selectedTable: matchSettings,
      }));

      return runBackendAction(
        'bots.start',
        () => backendBridge.startBotsMatch(matchSettings),
        (result) => {
          const patch = extractGameDataPatch(result || {});
          if (isBotsDirectStartResult(result || {}, patch, settings) || patch.match || patch.currentMatchId || isGameStartedPayload(result || {})) {
            clearChatForMatch();
            navigation.goGameplay();
            return;
          }

          setBackendStatus({
            loading: false,
            error: 'Bots mode did not return an active match. Please try again.',
            lastAction: 'bots.start.error',
          });
        },
      );
    },
    getMyRoom: () => runBackendAction('rooms.my', () => backendBridge.getMyRoom(), navigation.goRoomLobby),
    refreshRoom: (room) => runBackendAction('rooms.get', () => backendBridge.getRoom(room || gameData.currentRoom || gameData.currentRoomId)),
    refreshRooms: () => runBackendAction('rooms.refresh', () => backendBridge.refreshRooms()),
    setRoomReady: (room, ready = true) => runBackendAction('rooms.ready', () => backendBridge.setRoomReady(room || gameData.currentRoom || gameData.currentRoomId, ready)),
    leaveRoom: (room) => runBackendAction('rooms.leave', () => backendBridge.leaveRoom(room || gameData.currentRoom || gameData.currentRoomId), navigation.goRoomSelect),
    startRoomMatch: (room, payload) => {
      const selectedRoom = room || gameData.currentRoom || gameData.selectedTable || {};
      if (selectedRoom && typeof selectedRoom === 'object') {
        const selectedTable = gameData.selectedTable && typeof gameData.selectedTable === 'object' ? gameData.selectedTable : {};
        const roomSettings = withPrivateRoomMusicMetadata({
          ...selectedRoom,
          ...selectedTable,
          id: selectedRoom.id || selectedRoom.roomId || selectedTable.id,
          roomId: selectedRoom.roomId || selectedRoom.id || selectedTable.roomId,
          code: selectedRoom.code || selectedRoom.roomCode || selectedTable.code,
          roomCode: selectedRoom.roomCode || selectedRoom.code || selectedTable.roomCode,
        });
        setGameData((current) => ({
          ...current,
          selectedTable: roomSettings,
        }));
      }

      return runBackendAction(
        'rooms.start',
        () => backendBridge.startRoomMatch(room || gameData.currentRoom || gameData.currentRoomId, payload),
        (result) => {
          const patch = extractGameDataPatch(result || {});
          const status = String(result?.status || result?.match?.status || patch.currentRoom?.status || '').toLowerCase();
          if (status === 'countdown') navigation.goRoomLobby();
          else if (patch.currentMatchId || patch.match) navigation.goGameplay();
          else navigation.goRoomLobby();
        },
      );
    },
    startMatchmaking: async (payload = {}) => {
      const selectedTable = resolveSelectedTableForMatchmaking(payload, gameData);
      const requiredCoins = resolveEntryFee(selectedTable);
      const availableCoins = numericWalletAmount(gameData.wallet?.coins);

      if (requiredCoins > 0 && availableCoins < requiredCoins) {
        clearSocketMatchmakingState();
        setBackendStatus({
          loading: false,
          error: buildInsufficientFundsMessage(requiredCoins, availableCoins),
          lastAction: 'matchmaking.insufficient_funds',
        });
        return null;
      }

      setGameData((current) => ({
        ...current,
        selectedTable,
        currentMatchId: null,
        currentQueueId: null,
        match: null,
        matchResult: null,
        roundResult: null,
        serverMatchmaking: null,
        matchmaking: buildMatchmakingUi(selectedTable, {}, null, null),
      }));

      const isBotsMode = isBotsModeSettings(selectedTable);
      setBackendStatus({ loading: true, error: null, lastAction: isBotsMode ? 'bots.start' : 'matchmaking.start' });

      if (isBotsMode) {
        try {
          const result = await backendBridge.startBotsMatch(selectedTable);
          applyBackendPayloads(result);
          setBackendStatus({ loading: false, error: null, lastAction: 'bots.start' });

          const patch = extractGameDataPatch(result || {});
          if (isBotsDirectStartResult(result || {}, patch, selectedTable) || patch.match || patch.currentMatchId || isGameStartedPayload(result || {})) {
            clearChatForMatch();
            navigation.goGameplay();
          } else {
            setBackendStatus({
              loading: false,
              error: 'Bots mode did not return an active match. Please try again.',
              lastAction: 'bots.start.error',
            });
          }

          return result;
        } catch (error) {
          const message = getErrorMessage(error);
          setBackendStatus({ loading: false, error: message, lastAction: 'bots.start.error' });
          return null;
        }
      }

      try {
        const result = await startSocketMatchmaking(selectedTable, {
          onQueueUpdate: (socketPayload) => applySocketMatchmakingPayload(socketPayload, 'matchmaking.queue_update'),
          onMatchFound: (socketPayload) => applySocketMatchmakingPayload(socketPayload, 'matchmaking.match_found'),
          onMatchCountdown: (socketPayload) => applySocketMatchmakingPayload(socketPayload, 'matchmaking.countdown'),
          onGameStarted: (socketPayload) => {
            clearChatForMatch();
            return applySocketMatchmakingPayload(socketPayload, 'matchmaking.game_started');
          },
          onQueueCancelled: (socketPayload) => {
            applyBackendPayloads(socketPayload);
            clearSocketMatchmakingState();
            setBackendStatus({ loading: false, error: null, lastAction: 'matchmaking.cancel' });
            navigation.goRoomSelect();
          },
          onDisconnect: () => {
            setBackendStatus({
              loading: false,
              error: 'Realtime connection disconnected. Reconnecting...',
              lastAction: 'matchmaking.socket_disconnect',
            });
          },
          onError: (error) => {
            clearSocketMatchmakingState();
            setBackendStatus({ loading: false, error: getErrorMessage(error), lastAction: 'matchmaking.socket_error' });
          },
        });

        const actionName = isGameStartedPayload(result)
          ? 'matchmaking.game_started'
          : result?.matchId || result?.match?.id || result?.match?.matchId
            ? 'matchmaking.match_found'
            : 'matchmaking.queue_update';
        return applySocketMatchmakingPayload(result, actionName);
      } catch (error) {
        clearSocketMatchmakingState();
        const message = getErrorMessage(error);
        setBackendStatus({
          loading: false,
          error: message,
          lastAction: getBackendErrorCode(error) === 'INSUFFICIENT_FUNDS'
            ? 'matchmaking.insufficient_funds'
            : 'matchmaking.start.error',
        });
        return null;
      }
    },
    getMatchmakingStatus: () => runBackendAction('matchmaking.status', () => backendBridge.getMatchmakingStatus()),
    getQueueStatus: (queueId) => runBackendAction('matchmaking.queueStatus', () => backendBridge.getQueueStatus(queueId || gameData.currentQueueId)),
    cancelMatchmaking: async () => {
      setBackendStatus({ loading: true, error: null, lastAction: 'matchmaking.cancel' });

      try {
        const result = await cancelSocketMatchmaking({ queueId: gameData.currentQueueId });
        applyBackendPayloads(result);
        clearSocketMatchmakingState();
        setBackendStatus({ loading: false, error: null, lastAction: 'matchmaking.cancel' });
        navigation.goRoomSelect();
        return result;
      } catch (error) {
        try {
          const result = await backendBridge.cancelMatchmaking();
          applyBackendPayloads(result);
          clearSocketMatchmakingState();
          setBackendStatus({ loading: false, error: null, lastAction: 'matchmaking.cancel.rest_fallback' });
          navigation.goRoomSelect();
          return result;
        } catch (restError) {
          clearSocketMatchmakingState();
          setBackendStatus({ loading: false, error: getErrorMessage(restError) || getErrorMessage(error), lastAction: 'matchmaking.cancel' });
          navigation.goRoomSelect();
          return null;
        }
      }
    },
    claimAchievement: (achievement) => runBackendAction('achievements.claim', () => backendBridge.claimAchievement(achievement)),
    getAchievements: () => runBackendAction('achievements.list', () => backendBridge.getAchievements()),
    claimDailyReward: (reward) => runBackendAction('rewards.claimDaily', () => backendBridge.claimDailyReward(reward)),
    refreshEconomy: () => runBackendAction('economy.refresh', () => backendBridge.refreshEconomy()),
    enterTournament: (tournament) => runBackendAction('tournaments.enter', () => backendBridge.enterTournament(tournament), navigation.goMatchmaking),
    getTournament: (tournament) => runBackendAction('tournaments.details', () => backendBridge.getTournament(tournament)),
    getTournamentLeaderboard: (tournament) => runBackendAction('tournaments.leaderboard', () => backendBridge.getTournamentLeaderboard(tournament)),
    claimTournamentPrize: (tournament) => runBackendAction('tournaments.claim', () => backendBridge.claimTournamentPrize(tournament)),
    upgradePass: () => runBackendAction('pass.upgrade', () => backendBridge.upgradePass()),
    claimPassReward: (reward) => runBackendAction('pass.reward.claim', () => backendBridge.claimPassReward(reward)),
    playSpecialEvent: (event) => runBackendAction('events.play', () => backendBridge.playSpecialEvent(event), navigation.goMatchmaking),
    getSpecialEvent: (event) => runBackendAction('events.details', () => backendBridge.getSpecialEvent(event)),
    getEventMissionsByEvent: (event) => runBackendAction('events.missions.selected', () => backendBridge.getEventMissionsByEvent(event)),
    claimEventMission: (event, mission) => runBackendAction('events.mission.claim', () => backendBridge.claimEventMission(event, mission)),
    refreshGameData: () => runBackendAction('game.refresh', () => backendBridge.refreshGameData()),
    refreshMatch: (matchId) => runBackendAction('match.state', () => backendBridge.getMatchState(matchId || gameData.currentMatchId)),
    joinGameplaySocket: async (matchId) => {
      const safeMatchId = matchId || gameData.currentMatchId || gameData.match?.id || gameData.match?.matchId;
      clearChatForMatch();
      setBackendStatus({ loading: true, error: null, lastAction: 'match.socket.join' });

      try {
        const result = await joinSocketMatch({ matchId: safeMatchId }, gameplaySocketHandlers);
        return applySocketGameplayPayload(result, 'match.socket.join');
      } catch (error) {
        if (!isGameSocketConnected()) {
          return runRestMatchActionFallback('match.state', () => backendBridge.getMatchState(safeMatchId));
        }

        setBackendStatus({ loading: false, error: getErrorMessage(error), lastAction: 'match.socket.join' });
        return null;
      }
    },
    stopGameplaySocket: () => clearSocketGameplayListeners(),
    loadChatHistory: async (matchId) => {
      const safeMatchId = matchId || gameData.currentMatchId || gameData.match?.id || gameData.match?.matchId;
      if (!safeMatchId) return null;

      setChatStatus({ loading: true, error: null });

      try {
        const result = await loadSocketChatHistory({ matchId: safeMatchId });
        applyChatPayload(result, { replace: true });
        return result;
      } catch (error) {
        setChatStatus({ loading: false, sending: false, error: getErrorMessage(error) });
        return null;
      }
    },
    sendChatMessage: async (payload = {}) => {
      const safeMatchId = payload.matchId || gameData.currentMatchId || gameData.match?.id || gameData.match?.matchId;
      const text = String(payload.text || payload.message || '').trim().slice(0, 200);
      if (!safeMatchId || !text) return null;

      setChatStatus({ sending: true, error: null });

      try {
        const result = await sendSocketChatMessage({ matchId: safeMatchId, text });
        applyChatPayload(result);
        return result;
      } catch (error) {
        setChatStatus({ loading: false, sending: false, error: getErrorMessage(error) });
        return null;
      }
    },
    loadMatchResult: (matchId, query) => runBackendAction('match.result.load', () => backendBridge.getMatchResult(matchId || gameData.currentMatchId, query)),
    finalizeMatchResult: (payload = {}) => runBackendAction('match.result.finalize', () => backendBridge.submitMatchResult({ ...payload, matchId: payload.matchId || gameData.currentMatchId })),
    submitGameAction: async (action = {}) => {
      const payload = { ...action, matchId: action.matchId || gameData.currentMatchId };
      setBackendStatus({ loading: true, error: null, lastAction: 'match.action.socket' });

      try {
        const result = await sendSocketMatchAction(payload);
        return applySocketGameplayPayload(result, 'match.action.socket');
      } catch (error) {
        if (!isGameSocketConnected()) {
          return runRestMatchActionFallback(
            'match.action',
            () => backendBridge.submitGameAction(payload),
            (result) => {
              const patch = extractGameDataPatch(result || {});
              const match = patch.match || result?.match || result?.data?.match;
              if (match?.status === 'finished' || result?.result || result?.data?.result) navigation.goWin();
            },
          );
        }

        setBackendStatus({ loading: false, error: getErrorMessage(error), lastAction: 'match.action.socket' });
        return null;
      }
    },
    leaveMatch: async (matchId) => {
      const safeMatchId = matchId || gameData.currentMatchId;
      setBackendStatus({ loading: true, error: null, lastAction: 'match.leave.socket' });

      const finishLeaveFlow = (result) => {
        const finished = isFinishedMatchPayload(result);
        if (finished) {
          navigation.goWin();
          return result;
        }

        setGameData((current) => ({
          ...current,
          currentMatchId: null,
          match: null,
          roundResult: null,
          matchResult: null,
          gameplay: null,
        }));
        navigation.goRoomSelect();
        return result;
      };

      try {
        const result = await leaveSocketMatch({ matchId: safeMatchId, reason: 'player_left' });
        applySocketGameplayPayload(result, 'match.leave.socket');
        return finishLeaveFlow(result);
      } catch (error) {
        if (!isGameSocketConnected()) {
          return runRestMatchActionFallback(
            'match.leave',
            () => backendBridge.leaveMatch(safeMatchId),
            finishLeaveFlow,
          );
        }

        setBackendStatus({ loading: false, error: getErrorMessage(error), lastAction: 'match.leave.socket' });
        return null;
      }
    },
    clearMatch: (matchId) => runBackendAction('match.clear', () => backendBridge.clearMatch(matchId || gameData.currentMatchId)),
    loadResultAndGoWin: () => runBackendAction('match.result.load', () => backendBridge.getMatchResult(gameData.currentMatchId), navigation.goWin),
  };

  const isBootPreloading = !starterAssetsReady;
  const RenderedScreenComponent = isBootPreloading ? AssetBootScreen : ScreenComponent;
  const renderedScreenName = isBootPreloading ? 'assetboot' : screen;
  const activeScreenClass = isBootPreloading
    ? 'assetboot'
    : screen === 'mockgame'
      ? 'gameplay app-shell--gameplay app-shell--mockgame'
      : screen;
  const activeScreenData = isBootPreloading
    ? { ...gameData, assetLoading: bootAssetLoading }
    : screen === 'mockgame'
      ? mockGameplayData
      : gameData;
  const activeBackendActions = isBootPreloading ? {} : screen === 'mockgame' ? createMockBackendActions(setMockGameplayData) : backendActions;
  const activeBackendStatus = isBootPreloading
    ? { loading: false, error: null, lastAction: 'asset.boot' }
    : screen === 'mockgame'
      ? { loading: false, error: null, lastAction: 'mock.gameplay' }
      : backendStatus;

  return (
    <main
      className={`app-shell app-shell--${layout.mode} app-shell--${activeScreenClass}`}
      style={appStyle}
      data-backend-action={activeBackendStatus.lastAction || undefined}
      data-gameplay-background-key={gameplayBackground.backgroundKey || undefined}
      data-gameplay-background-url={gameplayBackground.backgroundUrl || undefined}
    >
      <div className="orientation-guard" aria-hidden="true">
        <div className="orientation-guard__card">
          <div className="orientation-guard__phone">
            <span className="orientation-guard__arrow">↻</span>
          </div>
          <div className="orientation-guard__title">Portrait mode ready</div>
          <div className="orientation-guard__text">The mobile layout now uses a portrait-safe frame.</div>
        </div>
      </div>

      <div className="game-frame">
        <RenderedScreenComponent
          name={renderedScreenName}
          navigation={navigation}
          mode={layout.mode}
          data={activeScreenData}
          backendActions={activeBackendActions}
          backendStatus={activeBackendStatus}
          i18n={i18n}
        />
      </div>
    </main>
  );
}
