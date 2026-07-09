export const DEFAULT_PROFILE_AVATAR = 'icc1.png';
export const PROFILE_AVATAR_IDS = Array.from({ length: 10 }, (_, index) => `icc${index + 1}.png`);
export const PROFILE_AVATAR_SET = new Set(PROFILE_AVATAR_IDS);
export const PROFILE_AVATAR_BASE_PATH = '/assets/liars-dice/profile-hud/';

export const PROFILE_AVATAR_OPTIONS = PROFILE_AVATAR_IDS.map((id, index) => ({
  id,
  label: `Avatar ${index + 1}`,
  src: `${PROFILE_AVATAR_BASE_PATH}${id}`,
}));

export function extractAvatarValue(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value.url || value.src || value.path || value.file || value.name || value.id ||
      value.avatarUrl || value.avatar || value.avatarId || value.eventAvatar || value.icon || null;
  }
  return null;
}

function basename(value) {
  const raw = extractAvatarValue(value);
  if (!raw) return null;
  const clean = String(raw).split('?')[0].split('#')[0].replace(/\\/g, '/');
  return clean.split('/').pop();
}

export function normalizeProfileAvatar(value, fallback = DEFAULT_PROFILE_AVATAR) {
  const fileName = basename(value);
  return PROFILE_AVATAR_SET.has(fileName) ? fileName : fallback;
}

export function getPlayerProfileAvatar(player, fallback = DEFAULT_PROFILE_AVATAR) {
  if (!player || typeof player !== 'object') return normalizeProfileAvatar(player, fallback);
  return normalizeProfileAvatar(
    player.avatarUrl || player.avatar || player.avatarId || player.eventAvatar || player.icon,
    fallback,
  );
}

export function resolveProfileAvatarSrc(value, fallback = DEFAULT_PROFILE_AVATAR) {
  return `${PROFILE_AVATAR_BASE_PATH}${getPlayerProfileAvatar(value, fallback)}`;
}

export function findProfileAvatarOption(value) {
  const id = normalizeProfileAvatar(value);
  return PROFILE_AVATAR_OPTIONS.find((option) => option.id === id) || PROFILE_AVATAR_OPTIONS[0];
}
