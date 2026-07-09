import { API_ENDPOINTS } from '../config/apiConfig.js';
import { apiRequest } from './client.js';

function withQuery(endpoint, query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const queryString = params.toString();
  return `${endpoint}${queryString ? `?${queryString}` : ''}`;
}

export const getProfile = () => apiRequest(API_ENDPOINTS.profile.me);
export const updateProfile = (payload) => apiRequest(API_ENDPOINTS.profile.update, { method: 'PATCH', body: payload });
export const getPublicProfile = (userId) => apiRequest(API_ENDPOINTS.profile.public(userId));

export const getStats = () => apiRequest(API_ENDPOINTS.profile.stats);
export const getSummary = () => apiRequest(API_ENDPOINTS.profile.summary);
export const getPublicStats = (userId) => apiRequest(API_ENDPOINTS.profile.publicStats(userId));

export const getWallet = () => apiRequest(API_ENDPOINTS.profile.wallet);
export const getTransactions = ({ limit = 20, type, currency } = {}) => apiRequest(
  withQuery(API_ENDPOINTS.profile.transactions, { limit, type, currency }),
);
