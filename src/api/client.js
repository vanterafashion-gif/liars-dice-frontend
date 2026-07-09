import { API_BASE_URL, API_ENDPOINTS, API_TIMEOUT_MS } from '../config/apiConfig.js';

export const TOKEN_STORAGE_KEY = 'ld_access_token';

const AUTH_ENDPOINTS_WITHOUT_REFRESH_RETRY = new Set([
  API_ENDPOINTS.auth.login,
  API_ENDPOINTS.auth.register,
  API_ENDPOINTS.auth.guest,
  API_ENDPOINTS.auth.refresh,
  API_ENDPOINTS.auth.logout,
]);

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function readStoredToken() {
  if (!canUseStorage()) return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (_error) {
    return null;
  }
}

let accessToken = readStoredToken();

export function setAccessToken(token) {
  accessToken = token || null;

  if (!canUseStorage()) return;

  try {
    if (accessToken) window.localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (_error) {
    // Storage can be unavailable in private browsing. The in-memory token still works.
  }
}

export function getAccessToken() {
  return accessToken;
}

export function hasAccessToken() {
  return Boolean(accessToken);
}

export function clearAccessToken() {
  setAccessToken(null);
}

export class ApiError extends Error {
  constructor(message, { status = 0, payload = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
    this.details = payload?.details || null;
    this.code = payload?.code || payload?.reason || payload?.details?.code || null;
    this.reason = payload?.reason || payload?.details?.reason || null;
  }
}

function buildUrl(endpoint) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  return response.text();
}

function buildHeaders(options = {}) {
  const headers = {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.headers || {}),
  };

  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (hasBody && !isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

async function executeRequest(endpoint, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const body = options.body && typeof options.body !== 'string' && !isFormData
      ? JSON.stringify(options.body)
      : options.body;

    const response = await fetch(buildUrl(endpoint), {
      credentials: 'include',
      ...options,
      headers: buildHeaders(options),
      signal: controller.signal,
      body,
    });

    const payload = await parseResponse(response);
    return { response, payload };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out', { status: 408 });
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function refreshAccessToken() {
  const { response, payload } = await executeRequest(API_ENDPOINTS.auth.refresh, {
    method: 'POST',
    skipAuthRetry: true,
  });

  if (!response.ok || !payload?.accessToken) {
    setAccessToken(null);
    throw new ApiError(payload?.message || 'Session expired', { status: response.status, payload });
  }

  setAccessToken(payload.accessToken);
  return payload.accessToken;
}

function shouldAttemptRefresh(endpoint, options = {}) {
  if (options.skipAuthRetry || options.authRetry === false) return false;
  if (!accessToken) return false;
  if (AUTH_ENDPOINTS_WITHOUT_REFRESH_RETRY.has(endpoint)) return false;
  return true;
}

export async function apiRequest(endpoint, options = {}) {
  const { response, payload } = await executeRequest(endpoint, options);

  if (response.ok) return payload;

  if (response.status === 401 && shouldAttemptRefresh(endpoint, options)) {
    try {
      await refreshAccessToken();
    } catch (refreshError) {
      setAccessToken(null);
      throw refreshError;
    }

    const retry = await executeRequest(endpoint, { ...options, skipAuthRetry: true });

    if (retry.response.ok) return retry.payload;

    throw new ApiError(retry.payload?.message || `Request failed with status ${retry.response.status}`, {
      status: retry.response.status,
      payload: retry.payload,
    });
  }

  if (response.status === 401 && !options.keepInvalidToken) {
    setAccessToken(null);
  }

  throw new ApiError(payload?.message || `Request failed with status ${response.status}`, {
    status: response.status,
    payload,
  });
}
