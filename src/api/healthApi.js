import { API_ENDPOINTS } from '../config/apiConfig.js';
import { apiRequest } from './client.js';

export const getServerHealth = () => apiRequest(API_ENDPOINTS.health.server, { authRetry: false });

export const getApiHealth = () => apiRequest(API_ENDPOINTS.health.api, { authRetry: false });
