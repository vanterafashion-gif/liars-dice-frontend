import { API_ENDPOINTS } from '../config/apiConfig.js';
import { apiRequest, setAccessToken } from './client.js';

function storeTokenFromPayload(payload) {
  if (payload?.accessToken) setAccessToken(payload.accessToken);
  return payload;
}

export async function loginUser(credentials) {
  const payload = await apiRequest(API_ENDPOINTS.auth.login, {
    method: 'POST',
    body: credentials,
    authRetry: false,
  });
  return storeTokenFromPayload(payload);
}

export async function registerUser(data) {
  const payload = await apiRequest(API_ENDPOINTS.auth.register, {
    method: 'POST',
    body: data,
    authRetry: false,
  });
  return storeTokenFromPayload(payload);
}

export async function refreshToken() {
  const payload = await apiRequest(API_ENDPOINTS.auth.refresh, { method: 'POST', authRetry: false });
  return storeTokenFromPayload(payload);
}

export async function loginAsGuest() {
  const payload = await apiRequest(API_ENDPOINTS.auth.guest, { method: 'POST', body: {}, authRetry: false });
  return storeTokenFromPayload(payload);
}

export async function logoutUser() {
  try {
    return await apiRequest(API_ENDPOINTS.auth.logout, { method: 'POST', body: {}, authRetry: false, keepInvalidToken: true });
  } finally {
    setAccessToken(null);
  }
}

export async function logoutAllSessions() {
  try {
    return await apiRequest(API_ENDPOINTS.auth.logoutAll, { method: 'POST', body: {}, authRetry: false, keepInvalidToken: true });
  } finally {
    setAccessToken(null);
  }
}

export const getProfile = () => apiRequest(API_ENDPOINTS.auth.profile);
export const getSession = () => apiRequest(API_ENDPOINTS.auth.session);
export const getMe = () => apiRequest(API_ENDPOINTS.auth.me);
export const getPublicProfile = (userId) => apiRequest(API_ENDPOINTS.auth.publicProfile(userId));
export const updateProfile = (payload) => apiRequest(API_ENDPOINTS.auth.updateProfile, { method: 'PATCH', body: payload });
