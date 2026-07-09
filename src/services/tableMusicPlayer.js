const DEFAULT_VOLUME = 0.35;
const VOLUME_STORAGE_KEY = 'liarsDice.tableMusic.volume';
const MUTE_STORAGE_KEY = 'liarsDice.tableMusic.muted';

let audioElement = null;
let currentTrackId = null;
let currentAudioSrc = null;
let hasLoopFallbackListener = false;
let currentVolume = readStoredVolume();
let currentMuted = readStoredMuted();

function canUseAudio() {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}

function clampVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, number));
}

function readStoredVolume() {
  if (typeof window === 'undefined') return DEFAULT_VOLUME;

  try {
    const storedValue = window.localStorage?.getItem?.(VOLUME_STORAGE_KEY);
    if (storedValue === null || storedValue === undefined || storedValue === '') return DEFAULT_VOLUME;
    return clampVolume(storedValue);
  } catch (_) {
    return DEFAULT_VOLUME;
  }
}

function readStoredMuted() {
  if (typeof window === 'undefined') return false;

  try {
    const storedValue = window.localStorage?.getItem?.(MUTE_STORAGE_KEY);
    return storedValue === '1' || storedValue === 'true';
  } catch (_) {
    return false;
  }
}

function writeStoredVolume(volume) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage?.setItem?.(VOLUME_STORAGE_KEY, String(volume));
  } catch (_) {
    // Storage can be unavailable in private browsing or embedded webviews.
  }
}

function writeStoredMuted(muted) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage?.setItem?.(MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch (_) {
    // Storage can be unavailable in private browsing or embedded webviews.
  }
}

function getEffectiveVolume() {
  return currentMuted ? 0 : currentVolume;
}

function applyAudioVolume() {
  if (audioElement) {
    audioElement.volume = getEffectiveVolume();
    audioElement.muted = currentMuted;
  }
}

function playAudio(audio) {
  const playPromise = audio.play();
  if (playPromise?.catch) {
    playPromise.catch(() => {
      // Browsers can block autoplay until the player interacts with the page.
    });
  }
}

function restartTrackFromBeginning() {
  if (!audioElement || !currentAudioSrc) return;

  try {
    audioElement.currentTime = 0;
  } catch (_) {
    // Some browsers can throw while media metadata is not ready yet.
  }

  playAudio(audioElement);
}

function getAudioElement() {
  if (!canUseAudio()) return null;

  if (!audioElement) {
    audioElement = new Audio();
    audioElement.preload = 'auto';
    audioElement.volume = getEffectiveVolume();
    audioElement.muted = currentMuted;
  }

  // Main loop behavior: when the track ends it starts again automatically.
  audioElement.loop = true;

  // Safety fallback for browsers/devices that fail to honor HTMLAudioElement.loop.
  if (!hasLoopFallbackListener) {
    audioElement.addEventListener('ended', restartTrackFromBeginning);
    hasLoopFallbackListener = true;
  }

  return audioElement;
}

export function stopTableMusic() {
  if (audioElement) {
    audioElement.pause();
    audioElement.removeAttribute('src');
    audioElement.load();
  }

  currentTrackId = null;
  currentAudioSrc = null;
}

export function syncTableMusic(track) {
  const nextTrackId = track?.id || null;
  const nextAudioSrc = track?.audioSrc || '';

  if (!nextTrackId || !nextAudioSrc) {
    stopTableMusic();
    return;
  }

  if (currentTrackId === nextTrackId && currentAudioSrc === nextAudioSrc) {
    return;
  }

  const audio = getAudioElement();
  if (!audio) return;

  currentTrackId = nextTrackId;
  currentAudioSrc = nextAudioSrc;

  audio.pause();
  audio.src = nextAudioSrc;
  audio.loop = true;
  audio.volume = getEffectiveVolume();
  audio.muted = currentMuted;

  try {
    audio.currentTime = 0;
  } catch (_) {
    // Ignore seek errors before the audio metadata is ready.
  }

  audio.load();
  playAudio(audio);
}

export function getTableMusicVolume() {
  return currentVolume;
}

export function setTableMusicVolume(volume) {
  currentVolume = clampVolume(volume);
  writeStoredVolume(currentVolume);

  if (currentVolume > 0 && currentMuted) {
    currentMuted = false;
    writeStoredMuted(currentMuted);
  }

  applyAudioVolume();

  return currentVolume;
}

export function getTableMusicMuted() {
  return currentMuted;
}

export function setTableMusicMuted(muted) {
  currentMuted = Boolean(muted);
  writeStoredMuted(currentMuted);
  applyAudioVolume();

  return currentMuted;
}

export function toggleTableMusicMuted() {
  return setTableMusicMuted(!currentMuted);
}

export function resumeTableMusic() {
  if (!audioElement || !currentAudioSrc) return;
  playAudio(audioElement);
}
