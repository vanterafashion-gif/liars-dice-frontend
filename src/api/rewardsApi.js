import { API_ENDPOINTS } from '../config/apiConfig.js';
import { apiRequest } from './client.js';

export const getDailyRewards = () => apiRequest(API_ENDPOINTS.rewards.daily);

export const claimDailyReward = (rewardId) => {
  if (!rewardId) throw new Error('daily reward id is required');
  return apiRequest(API_ENDPOINTS.rewards.claimDaily(rewardId), {
    method: 'POST',
    body: {},
  });
};
