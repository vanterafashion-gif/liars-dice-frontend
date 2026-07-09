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

export const getMatchState = (matchId) => apiRequest(
  matchId ? API_ENDPOINTS.match.stateById(matchId) : API_ENDPOINTS.match.state,
);

export const submitMatchAction = (action = {}, matchId = action?.matchId) => {
  const { matchId: _matchId, ...body } = action || {};
  return apiRequest(
    matchId ? API_ENDPOINTS.match.actionById(matchId) : API_ENDPOINTS.match.action,
    {
      method: 'POST',
      body,
    },
  );
};

export const getMatchResult = (matchId, query = {}) => apiRequest(
  withQuery(matchId ? API_ENDPOINTS.match.resultById(matchId) : API_ENDPOINTS.match.result, query),
);

export const submitMatchResult = (payload = {}, matchId = payload?.matchId) => {
  const { matchId: _matchId, ...body } = payload || {};
  return apiRequest(
    matchId ? API_ENDPOINTS.match.resultById(matchId) : API_ENDPOINTS.match.result,
    {
      method: 'POST',
      body,
    },
  );
};

export const leaveMatch = (matchId) => apiRequest(
  matchId ? API_ENDPOINTS.match.leaveById(matchId) : API_ENDPOINTS.match.leave,
  { method: 'POST', body: {} },
);

export const clearMatch = (matchId) => {
  if (!matchId) throw new Error('matchId is required');
  return apiRequest(API_ENDPOINTS.match.clearById(matchId), { method: 'DELETE' });
};
