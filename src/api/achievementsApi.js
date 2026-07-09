import { API_ENDPOINTS } from '../config/apiConfig.js';
import { apiRequest } from './client.js';

export const getAchievements = () => apiRequest(API_ENDPOINTS.achievements.list);

export const claimAchievement = (achievementId) => {
  if (!achievementId) throw new Error('achievementId is required');
  return apiRequest(API_ENDPOINTS.achievements.claim(achievementId), {
    method: 'POST',
    body: {},
  });
};
