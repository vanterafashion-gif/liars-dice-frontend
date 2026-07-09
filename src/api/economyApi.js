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

export const getBalance = () => apiRequest(API_ENDPOINTS.economy.balance);

export const getTransactions = ({ limit = 20, type, currency } = {}) => apiRequest(
  withQuery(API_ENDPOINTS.economy.transactions, { limit, type, currency }),
);

export const validateTransaction = (payload) => apiRequest(API_ENDPOINTS.economy.validateTransaction, {
  method: 'POST',
  body: payload,
});
