const DEFAULT_SFX_VOLUME = 0.7;
const SFX_VOLUME_STORAGE_KEY = 'liarsDice.sfx.volume';

const SFX_SOURCES = Object.freeze({
  roll: `${import.meta.env.BASE_URL}sfx/roll-dice.mp3`,
  zai: `${import.meta.env.BASE_URL}sfx/zai.mp3`,
  fei: `${import.meta.env.BASE_URL}sfx/fei.mp3`,
  callLiar: `${import.meta.env.BASE_URL}sfx/call-liar.mp3`,
  slam: `${import.meta.env.BASE_URL}sfx/slam.mp3`,
});

const audioByEffect = new Map();
let currentSfxVolume = readStoredVolume();

function canUseAudio() {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}

function clampVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_SFX_VOLUME;
  return Math.min(1, Math.max(0, number));
}

function readStoredVolume() {
  if (typeof window === 'undefined') return DEFAULT_SFX_VOLUME;

  try {
    const storedValue = window.localStorage?.getItem?.(SFX_VOLUME_STORAGE_KEY);
    if (storedValue === null || storedValue === undefined || storedValue === '') return DEFAULT_SFX_VOLUME;
    return clampVolume(storedValue);
  } catch (_) {
    return DEFAULT_SFX_VOLUME;
  }
}

function writeStoredVolume(volume) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage?.setItem?.(SFX_VOLUME_STORAGE_KEY, String(volume));
  } catch (_) {
    // Storage can be unavailable in private browsing or embedded webviews.
  }
}

function getAudio(effectName) {
  if (!canUseAudio()) return null;
  const source = SFX_SOURCES[effectName];
  if (!source) return null;

  let audio = audioByEffect.get(effectName);
  if (!audio) {
    audio = new Audio(source);
    audio.preload = 'auto';
    audio.volume = currentSfxVolume;
    audioByEffect.set(effectName, audio);
  }

  return audio;
}

export function preloadGameSfx() {
  if (!canUseAudio()) return;
  Object.keys(SFX_SOURCES).forEach((effectName) => {
    const audio = getAudio(effectName);
    try {
      audio?.load?.();
    } catch (_) {
      // A failed preload should not prevent the effect from playing later.
    }
  });
}

export function getGameSfxVolume() {
  return currentSfxVolume;
}

export function setGameSfxVolume(volume) {
  currentSfxVolume = clampVolume(volume);
  writeStoredVolume(currentSfxVolume);

  audioByEffect.forEach((audio) => {
    audio.volume = currentSfxVolume;
  });

  return currentSfxVolume;
}

export function playGameSfx(effectName) {
  const audio = getAudio(effectName);
  if (!audio || currentSfxVolume <= 0) return false;

  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = currentSfxVolume;
    const playPromise = audio.play();
    if (playPromise?.catch) playPromise.catch(() => {});
    return true;
  } catch (_) {
    return false;
  }
}
