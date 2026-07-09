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

export const getTables = ({ includePrivate = true } = {}) => apiRequest(
  withQuery(API_ENDPOINTS.tables.list, { includePrivate }),
);

export const getDefaultTable = () => apiRequest(API_ENDPOINTS.tables.default);
export const getPlayNowTable = () => apiRequest(API_ENDPOINTS.tables.playNow);
export const getTable = (tableId) => {
  if (!tableId) throw new Error('tableId is required');
  return apiRequest(API_ENDPOINTS.tables.details(tableId));
};
