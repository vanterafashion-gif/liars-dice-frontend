const DEFAULT_VOLUME = 0.35;
const VOLUME_STORAGE_KEY = 'liarsDice.tableMusic.volume';
const MUTE_STORAGE_KEY = 'liarsDice.tableMusic.muted';
const LAST_CUE_STORAGE_PREFIX = 'liarsDice.tableMusic.lastCue';

let audioElement = null;
let currentTrackId = null;
let currentAudioSrc = null;
let hasLoopFallbackListener = false;
let pendingMetadataHandler = null;
let playbackRequestId = 0;
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

function getLastCueStorageKey(trackId) {
  return `${LAST_CUE_STORAGE_PREFIX}.${trackId}`;
}

function readLastCueId(trackId) {
  if (typeof window === 'undefined' || !trackId) return null;

  try {
    return window.localStorage?.getItem?.(getLastCueStorageKey(trackId)) || null;
  } catch (_) {
    return null;
  }
}

function writeLastCueId(trackId, cueId) {
  if (typeof window === 'undefined' || !trackId || !cueId) return;

  try {
    window.localStorage?.setItem?.(getLastCueStorageKey(trackId), cueId);
  } catch (_) {
    // Failure to remember the previous cue should not stop music playback.
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

function normalizeCuePoints(track) {
  const rawCuePoints = Array.isArray(track?.cuePoints) ? track.cuePoints : [];

  const normalized = rawCuePoints
    .map((cue, index) => {
      if (typeof cue === 'number') {
        return {
          id: `${track?.id || 'track'}-${index + 1}`,
          start: cue,
        };
      }

      if (!cue || typeof cue !== 'object') return null;

      return {
        id: String(cue.id || `${track?.id || 'track'}-${index + 1}`),
        start: Number(cue.start),
      };
    })
    .filter((cue) => cue && Number.isFinite(cue.start) && cue.start >= 0)
    .sort((left, right) => left.start - right.start);

  return normalized.length > 0
    ? normalized
    : [{ id: `${track?.id || 'track'}-start`, start: 0 }];
}

function randomIndex(max) {
  if (max <= 1) return 0;

  try {
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      const randomValue = new Uint32Array(1);
      window.crypto.getRandomValues(randomValue);
      return randomValue[0] % max;
    }
  } catch (_) {
    // Fall through to Math.random when Web Crypto is unavailable.
  }

  return Math.floor(Math.random() * max);
}

function selectRandomCuePoint(track) {
  const cuePoints = normalizeCuePoints(track);
  const previousCueId = readLastCueId(track?.id);
  const selectableCuePoints = cuePoints.length > 1
    ? cuePoints.filter((cue) => cue.id !== previousCueId)
    : cuePoints;
  const pool = selectableCuePoints.length > 0 ? selectableCuePoints : cuePoints;
  const selectedCue = pool[randomIndex(pool.length)];

  writeLastCueId(track?.id, selectedCue.id);
  return selectedCue;
}

function removePendingMetadataHandler() {
  if (!audioElement || !pendingMetadataHandler) return;
  audioElement.removeEventListener('loadedmetadata', pendingMetadataHandler);
  pendingMetadataHandler = null;
}

function seekAndPlayFromCue(audio, cuePoint, requestId) {
  if (
    !audio
    || requestId !== playbackRequestId
    || audio !== audioElement
    || !currentAudioSrc
  ) {
    return;
  }

  const duration = Number(audio.duration);
  const requestedStart = Number(cuePoint?.start) || 0;
  const maximumStart = Number.isFinite(duration)
    ? Math.max(0, duration - 0.25)
    : requestedStart;
  const safeStart = Math.min(Math.max(0, requestedStart), maximumStart);

  try {
    audio.currentTime = safeStart;
  } catch (_) {
    try {
      audio.currentTime = 0;
    } catch (_) {
      // Ignore browsers that reject seeking before media is ready.
    }
  }

  playAudio(audio);
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

  // After the random starting song, the combined playlist continues normally.
  // At the end of the MP3 it loops back to the beginning of the full playlist.
  audioElement.loop = true;

  // Safety fallback for browsers/devices that fail to honor HTMLAudioElement.loop.
  if (!hasLoopFallbackListener) {
    audioElement.addEventListener('ended', restartTrackFromBeginning);
    hasLoopFallbackListener = true;
  }

  return audioElement;
}

export function stopTableMusic() {
  playbackRequestId += 1;
  removePendingMetadataHandler();

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

  playbackRequestId += 1;
  const requestId = playbackRequestId;
  const selectedCue = selectRandomCuePoint(track);

  removePendingMetadataHandler();
  currentTrackId = nextTrackId;
  currentAudioSrc = nextAudioSrc;

  audio.pause();
  audio.src = nextAudioSrc;
  audio.loop = true;
  audio.volume = getEffectiveVolume();
  audio.muted = currentMuted;

  pendingMetadataHandler = () => {
    pendingMetadataHandler = null;
    seekAndPlayFromCue(audio, selectedCue, requestId);
  };

  audio.addEventListener('loadedmetadata', pendingMetadataHandler, { once: true });
  audio.load();

  // Cached media can already have metadata immediately after assigning src.
  if (audio.readyState >= 1) {
    removePendingMetadataHandler();
    seekAndPlayFromCue(audio, selectedCue, requestId);
  }
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
