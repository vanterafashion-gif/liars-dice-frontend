import { API_ENDPOINTS } from '../config/apiConfig.js';
import { apiRequest } from './client.js';

export const getTournaments = () => apiRequest(API_ENDPOINTS.tournaments.list);

export const getTournament = (tournamentId) => {
  if (!tournamentId) throw new Error('tournamentId is required');
  return apiRequest(API_ENDPOINTS.tournaments.details(tournamentId));
};

export const getTournamentLeaderboard = (tournamentId) => {
  if (!tournamentId) throw new Error('tournamentId is required');
  return apiRequest(API_ENDPOINTS.tournaments.leaderboard(tournamentId));
};

export const enterTournament = (tournamentId) => {
  if (!tournamentId) throw new Error('tournamentId is required');
  return apiRequest(API_ENDPOINTS.tournaments.enter(tournamentId), {
    method: 'POST',
    body: {},
  });
};

export const claimTournamentPrize = (tournamentId) => {
  if (!tournamentId) throw new Error('tournamentId is required');
  return apiRequest(API_ENDPOINTS.tournaments.claim(tournamentId), {
    method: 'POST',
    body: {},
  });
};

export const getTournamentPass = () => apiRequest(API_ENDPOINTS.tournaments.legacyPass);
export const upgradePass = () => apiRequest(API_ENDPOINTS.tournaments.legacyUpgradePass, { method: 'POST', body: {} });
