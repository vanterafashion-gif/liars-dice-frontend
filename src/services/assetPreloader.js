const cache = new Map();
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_BACKGROUND_CONCURRENCY = 2;

function normalizeSrc(src) {
  if (!src || typeof src !== 'string') return '';
  return src.trim();
}

function makeProgress(loaded, total, src = '', ok = true) {
  return {
    loaded,
    total,
    percent: total ? Math.max(1, Math.min(100, Math.round((loaded / total) * 100))) : 100,
    src,
    ok,
  };
}

function scheduleIdleTask(callback, options = {}) {
  const delayMs = Math.max(0, Number(options.delayMs) || 0);
  const timeout = Math.max(0, Number(options.idleTimeoutMs) || 2000);
  let idleId = null;
  let timerId = null;
  let cancelled = false;

  const run = () => {
    if (cancelled) return;

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => {
        if (!cancelled) callback();
      }, { timeout });
      return;
    }

    timerId = window.setTimeout(() => {
      if (!cancelled) callback();
    }, 0);
  };

  timerId = window.setTimeout(run, delayMs);

  return () => {
    cancelled = true;
    if (timerId) window.clearTimeout(timerId);
    if (idleId && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleId);
    }
  };
}

function preloadWithImage(src, timeoutMs) {
  if (typeof Image === 'undefined') {
    return Promise.resolve({ src, ok: false, skipped: true, reason: 'image-api-unavailable' });
  }

  return new Promise((resolve) => {
    const image = new Image();
    let finished = false;
    let timeoutId = null;

    const finish = async (ok, reason = ok ? 'loaded' : 'failed') => {
      if (finished) return;
      finished = true;
      if (timeoutId) window.clearTimeout(timeoutId);

      try {
        if (ok && typeof image.decode === 'function') await image.decode();
      } catch {
        // decode can reject for cached images in Safari even when onload fired.
      }

      resolve({ src, ok, reason, image });
    };

    image.onload = () => finish(true);
    image.onerror = () => finish(false, 'error');
    image.decoding = 'async';
    image.loading = 'eager';

    timeoutId = window.setTimeout(() => finish(false, 'timeout'), timeoutMs);
    image.src = src;

    if (image.complete && image.naturalWidth > 0) finish(true, 'cached');
  });
}

export function clearAssetPreloadCache() {
  cache.clear();
}

export function getPreloadedAssetState(src) {
  const safeSrc = normalizeSrc(src);
  return safeSrc ? cache.get(safeSrc) || null : null;
}

export function isAssetPreloaded(src) {
  return getPreloadedAssetState(src)?.ok === true;
}

export function getAssetPreloadSnapshot() {
  return Array.from(cache.values()).map(({ promise, image, ...state }) => state);
}

export function preloadAsset(src, options = {}) {
  const safeSrc = normalizeSrc(src);
  if (!safeSrc) return Promise.resolve({ src: safeSrc, ok: false, skipped: true, reason: 'empty-src' });

  const cached = cache.get(safeSrc);
  if (cached?.promise) return cached.promise;

  const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;
  const promise = preloadWithImage(safeSrc, timeoutMs).then((result) => {
    cache.set(safeSrc, { ...result, promise: Promise.resolve(result), loadedAt: Date.now() });
    return result;
  });

  cache.set(safeSrc, { src: safeSrc, ok: null, pending: true, promise });
  return promise;
}

async function runPool(items, worker, concurrency) {
  const safeConcurrency = Math.max(1, Math.min(Number(concurrency) || DEFAULT_CONCURRENCY, items.length || 1));
  let cursor = 0;

  const workers = Array.from({ length: safeConcurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  });

  await Promise.all(workers);
}

export async function preloadAssets(list = [], options = {}) {
  const assets = [...new Set((Array.isArray(list) ? list : []).map(normalizeSrc).filter(Boolean))];
  const total = assets.length;
  const onProgress = typeof options === 'function' ? options : options.onProgress;
  const timeoutMs = typeof options === 'function' ? DEFAULT_TIMEOUT_MS : options.timeoutMs;
  const concurrency = typeof options === 'function' ? DEFAULT_CONCURRENCY : options.concurrency;

  if (!total) {
    onProgress?.(makeProgress(0, 0));
    return [];
  }

  let loaded = 0;
  const results = new Array(total);
  onProgress?.({ loaded: 0, total, percent: 0, src: '', ok: true });

  await runPool(assets, async (src, index) => {
    const result = await preloadAsset(src, { timeoutMs });
    results[index] = result;
    loaded += 1;
    onProgress?.(makeProgress(loaded, total, src, result.ok));
  }, concurrency);

  return results;
}

export function preloadAssetsInBackground(list = [], options = {}) {
  const assets = [...new Set((Array.isArray(list) ? list : []).map(normalizeSrc).filter(Boolean))];
  let cancelled = false;
  let stopIdleTask = null;

  const promise = new Promise((resolve) => {
    stopIdleTask = scheduleIdleTask(() => {
      if (cancelled || !assets.length) {
        resolve([]);
        return;
      }

      preloadAssets(assets, {
        timeoutMs: options.timeoutMs ?? 10000,
        concurrency: options.concurrency ?? DEFAULT_BACKGROUND_CONCURRENCY,
        onProgress: options.onProgress,
      })
        .then(resolve)
        .catch(() => resolve([]));
    }, {
      delayMs: options.delayMs ?? 700,
      idleTimeoutMs: options.idleTimeoutMs ?? 2000,
    });
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      stopIdleTask?.();
    },
  };
}

export const preloadImage = preloadAsset;
export const preloadImages = (list = [], onProgress) => preloadAssets(list, { onProgress });
