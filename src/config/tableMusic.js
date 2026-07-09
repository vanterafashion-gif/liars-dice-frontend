const MUSIC_BASE_PATH = '/assets/liars-dice/music';

export const TABLE_MUSIC_TRACKS = {
  beginner: {
    id: 'beginner',
    label: 'Beginner Table Music',
    placeholder: `${MUSIC_BASE_PATH}/beginner-table-music.txt`,
    audioSrc: '/assets/liars-dice/music/beginner-table-music.mp3',
  },
  'high-roller': {
    id: 'high-roller',
    label: 'High Roller Table Music',
    placeholder: `${MUSIC_BASE_PATH}/high-roller-table-music.txt`,
    audioSrc: '/assets/liars-dice/music/high-roller-table-music.mp3',
  },
  createroom: {
    id: 'createroom',
    label: 'Create Room Music',
    placeholder: `${MUSIC_BASE_PATH}/create-room-music.txt`,
    audioSrc: '/assets/liars-dice/music/create-room-music.mp3',
  },
};

const TABLE_KEY_ALIASES = {
  beginner: 'beginner',
  beginners: 'beginner',
  basic: 'beginner',
  casual: 'beginner',
  table_buyin_500: 'beginner',
  'table-buyin-500': 'beginner',
  highroller: 'high-roller',
  'high-roller': 'high-roller',
  high_roller: 'high-roller',
  'high-rollers': 'high-roller',
  vip: 'high-roller',
  table_buyin_5000: 'high-roller',
  'table-buyin-5000': 'high-roller',
  private: 'createroom',
  'private-room': 'createroom',
  private_room: 'createroom',
  createroom: 'createroom',
  'create-room': 'createroom',
  create_room: 'createroom',
};

const MUSIC_ENABLED_SCREENS = new Set([
  'gameplay',
  'mockgame',
]);

function slugifyMusicKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeTableMusicKey(value) {
  const rawValue = String(value || '').trim().toLowerCase();
  const slug = slugifyMusicKey(value);
  return TABLE_KEY_ALIASES[rawValue]
    || TABLE_KEY_ALIASES[slug]
    || TABLE_KEY_ALIASES[slug.replace(/-/g, '_')]
    || null;
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function numericMusicAmount(value, fallback = 0) {
  const number = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : fallback;
}

function readCreateRoomBidAmount(source = {}) {
  if (!source || typeof source !== 'object') return undefined;

  const pricing = source.pricing && typeof source.pricing === 'object' ? source.pricing : {};
  return firstValue(
    source.selectedBuyIn,
    source.buyInAmount,
    source.buyInCoins,
    source.customBuyIn,
    source.customStake,
    source.entryFee,
    pricing.buyInAmount,
    pricing.buyInCoins,
    pricing.entryFee,
    source.selectedPerGame,
    source.perGameAmount,
    source.roundStake,
    pricing.selectedPerGame,
    pricing.perGameAmount,
    pricing.roundStake,
  );
}

export function resolveCreateRoomMusicKeyForBid(value) {
  const amount = numericMusicAmount(value, 0);
  if (amount >= 500) return 'createroom';
  if (amount >= 250) return 'high-roller';
  return 'beginner';
}

export function resolveCreateRoomMusicKeyFromSettings(settings = {}) {
  return resolveCreateRoomMusicKeyForBid(readCreateRoomBidAmount(settings));
}

function resolveSelectedTableSource(gameData = {}) {
  return firstValue(
    gameData.selectedTable,
    gameData.selectedTable?.background,
    gameData.match?.selectedTable,
    gameData.match?.table,
    gameData.match?.tier,
    gameData.currentRoom?.selectedTable,
    gameData.currentRoom?.table,
    gameData.currentRoom?.tier,
    gameData.currentRoom,
    gameData.currentTable,
    gameData.table,
    gameData.tier,
    gameData.matchmaking?.selectedTable,
    gameData.matchmaking?.table,
    gameData.defaultTable,
    gameData.playNowTable,
  );
}

function resolveMusicKeyFromTable(table) {
  if (!table) return null;

  if (typeof table === 'string') {
    return normalizeTableMusicKey(table);
  }

  const directMusicKey = normalizeTableMusicKey(firstValue(
    table.musicKey,
    table.tableMusicKey,
    table.audioKey,
  ));

  if (directMusicKey) return directMusicKey;

  const privateLikeKey = normalizeTableMusicKey(firstValue(
    table.key,
    table.slug,
    table.tierKey,
    table.tierId,
    table.tableId,
    table.roomTypeId,
    table.id,
    table.name,
    table.title,
    table.type,
    table.roomType,
  ));

  const looksLikePrivateRoom = Boolean(
    table.isPrivate
    || table.private
    || table.roomCode
    || table.code
    || table.roomName
    || privateLikeKey === 'createroom'
  );

  if (looksLikePrivateRoom && readCreateRoomBidAmount(table) !== undefined) {
    return resolveCreateRoomMusicKeyFromSettings(table);
  }

  const explicitMusicKey = normalizeTableMusicKey(firstValue(
    table.key,
    table.slug,
    table.tierKey,
    table.tierId,
    table.tableId,
    table.roomTypeId,
    table.id,
    table.name,
    table.title,
    table.type,
    table.roomType,
  ));

  if (explicitMusicKey) return explicitMusicKey;

  if (looksLikePrivateRoom) {
    return resolveCreateRoomMusicKeyFromSettings(table);
  }

  return null;
}

function isActiveGameplayMusicScreen(screenName) {
  return MUSIC_ENABLED_SCREENS.has(screenName);
}

export function resolveTableMusicTrack(screenName, gameData = {}) {
  if (!isActiveGameplayMusicScreen(screenName, gameData)) return null;

  const musicKey = resolveMusicKeyFromTable(resolveSelectedTableSource(gameData));
  if (!musicKey) return null;

  return TABLE_MUSIC_TRACKS[musicKey] || null;
}
