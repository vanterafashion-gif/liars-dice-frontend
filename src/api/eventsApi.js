import { API_ENDPOINTS } from '../config/apiConfig.js';
import { apiRequest } from './client.js';

export const getSpecialEvents = () => apiRequest(API_ENDPOINTS.events.list);
export const getEventMissions = () => apiRequest(API_ENDPOINTS.events.missions);

export const getSpecialEvent = (eventId) => {
  if (!eventId) throw new Error('eventId is required');
  return apiRequest(API_ENDPOINTS.events.details(eventId));
};

export const getEventMissionsByEvent = (eventId) => {
  if (!eventId) throw new Error('eventId is required');
  return apiRequest(API_ENDPOINTS.events.eventMissions(eventId));
};

export const playSpecialEvent = (eventId) => {
  if (!eventId) throw new Error('eventId is required');
  return apiRequest(API_ENDPOINTS.events.play(eventId), {
    method: 'POST',
    body: {},
  });
};

export const claimEventMission = (eventId, missionId) => {
  if (!eventId) throw new Error('eventId is required');
  if (!missionId) throw new Error('missionId is required');
  return apiRequest(API_ENDPOINTS.events.claimMission(eventId, missionId), {
    method: 'POST',
    body: {},
  });
};
