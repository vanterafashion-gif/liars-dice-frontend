import { API_ENDPOINTS } from '../config/apiConfig.js';
import { apiRequest } from './client.js';

export const getPass = () => apiRequest(API_ENDPOINTS.pass.state);

export const upgradePass = () => apiRequest(API_ENDPOINTS.pass.upgrade, { method: 'POST' });

export const claimFreeReward = (level) => {
  if (!level) throw new Error('pass reward level is required');
  return apiRequest(API_ENDPOINTS.pass.claimFree(level), { method: 'POST' });
};

export const claimPremiumReward = (level) => {
  if (!level) throw new Error('pass reward level is required');
  return apiRequest(API_ENDPOINTS.pass.claimPremium(level), { method: 'POST' });
};
