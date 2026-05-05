const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Simple in-memory cache for API responses
const cache: Record<string, { data: any; expiry: number }> = {};
const DEFAULT_CACHE_TIME = 60 * 1000; // 1 minute

async function fetchWithCache<T>(url: string, cacheTime = DEFAULT_CACHE_TIME): Promise<T> {
  const now = Date.now();
  if (cache[url] && now < cache[url].expiry) {
    return cache[url].data;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
  const data = await res.json();
  
  cache[url] = {
    data,
    expiry: now + cacheTime
  };
  
  return data;
}

export interface GameLeader {
  personId: number;
  name: string;
  points: number;
  rebounds: number;
  assists: number;
}

export interface Game {
  game_id: string;
  game_date: string;
  status: 'live' | 'final' | 'scheduled';
  status_text: string;
  arena: string;
  home_team_id: number;
  away_team_id: number;
  home_team_abbreviation?: string;
  away_team_abbreviation?: string;
  home_team_name?: string;
  away_team_name?: string;
  home_score: number;
  away_score: number;
  home_period_scores?: number[];
  away_period_scores?: number[];
  quarter: number;
  time_remaining: string;
  series_info?: {
    home_wins: number;
    visitor_wins: number;
    series_leader: string;
  };
  home_leader?: GameLeader;
  away_leader?: GameLeader;
}

export interface Standing {
  TeamID: number;
  TeamCity: string;
  TeamName: string;
  Conference: string;
  Wins: number;
  Losses: number;
  WinPCT: number;
  L10Rec: string;
  Strk: string;
}

export interface Player {
  PERSON_ID: number;
  PLAYER_ID?: number;
  PLAYER_FIRST_NAME?: string;
  PLAYER_LAST_NAME?: string;
  PLAYER_NAME?: string;
  PLAYER?: string; // from commonteamroster
  NUM?: string;
  POSITION?: string;
  HEIGHT?: string;
  WEIGHT?: string;
  BIRTH_DATE?: string;
  AGE?: number;
  EXP?: string;
  SCHOOL?: string;
  TEAM_ID: number;
  TEAM_ABBREVIATION: string;
  GP?: number;
  MIN?: number;
  PTS: number;
  REB: number;
  AST: number;
  STL?: number;
  BLK?: number;
  FG_PCT?: number;
  FG3_PCT?: number;
  FT_PCT?: number;
}

export interface BoxScorePlayer {
  GAME_ID: string;
  TEAM_ID: number;
  TEAM_ABBREVIATION: string;
  PLAYER_ID: number;
  PLAYER_NAME: string;
  START_POSITION?: string | null;
  COMMENT?: string | null;
  MIN?: string | null;
  PTS?: number | null;
  REB?: number | null;
  AST?: number | null;
  STL?: number | null;
  BLK?: number | null;
  PLUS_MINUS?: number | null;
  FG_PCT?: number | null;
  FGM?: number | null;
  FGA?: number | null;
  FG3M?: number | null;
  FG3A?: number | null;
  FTM?: number | null;
  FTA?: number | null;
  FT_PCT?: number | null;
  TOV?: number | null;
  TO?: number | null;
}

export interface BoxScoreTeam {
  GAME_ID: string;
  TEAM_ID: number;
  TEAM_NAME: string;
  TEAM_ABBREVIATION: string;
  FGM?: number | null;
  FGA?: number | null;
  FG_PCT?: number | null;
  FG3M?: number | null;
  FG3A?: number | null;
  FG3_PCT?: number | null;
  FTM?: number | null;
  FTA?: number | null;
  FT_PCT?: number | null;
  OREB?: number | null;
  DREB?: number | null;
  REB?: number | null;
  AST?: number | null;
  STL?: number | null;
  BLK?: number | null;
  TO?: number | null;
  PF?: number | null;
  PTS?: number | null;
  PLUS_MINUS?: number | null;
}

export interface PlayerShot {
  LOC_X: number;
  LOC_Y: number;
  SHOT_MADE_FLAG: number;
  SHOT_DISTANCE: number;
  ACTION_TYPE?: string;
  PERIOD?: number;
  MINUTES_REMAINING?: number;
  SECONDS_REMAINING?: number;
  PLAYER_ID?: number;
  PLAYER_NAME?: string;
  TEAM_ID?: number;
  GAME_EVENT_ID?: number;
  SHOT_ZONE_BASIC?: string;
  SHOT_ZONE_AREA?: string;
  SHOT_ZONE_RANGE?: string;
}

export interface PlayerImpact {
  scoring_breakdown: {
    description: string;
    points: number;
    type: string;
  }[];
  assists_tracking: {
    to_player_id: number;
    to_player_name: string;
    points_generated: number;
    description: string;
  }[];
  total_generated_points: number;
}

export interface PlayerGameLog {
  GAME_ID: string;
  GAME_DATE: string;
  MATCHUP: string;
  PTS: number;
  REB?: number;
  AST?: number;
}

export interface TeamGame {
  GAME_ID: string;
  GAME_DATE: string;
  MATCHUP: string;
  WL: string;
  PTS: number;
  OPP_PTS?: number;
  MIN?: number;
  FGM?: number;
  FGA?: number;
  FG_PCT?: number;
  FG3M?: number;
  FG3A?: number;
  FG3_PCT?: number;
  FTM?: number;
  FTA?: number;
  FT_PCT?: number;
  REB?: number;
  AST?: number;
  STL?: number;
  BLK?: number;
  TOV?: number;
  PLUS_MINUS?: number;
}

export interface PlayerFatigueScore {
  id: string;
  player_id: string;
  score_date: string;
  fatigue_score: number;
  minutes_last_3: number;
  back_to_back: boolean;
  games_last_7: number;
  performance_drop: number;
  risk_level: 'high' | 'medium' | 'low';
  avg_rest_days?: number;
  workload_score?: number;
}

export interface FatigueReport {
  season: string;
  generated_at: string;
  players: Array<Player & { fatigue: PlayerFatigueScore; recent_games?: PlayerGameLog[] }>;
  summary: {
    high: number;
    medium: number;
    low: number;
    average: number;
    back_to_back: number;
  };
}

export interface NbaTeam {
  id: number;
  full_name: string;
  abbreviation: string;
  nickname: string;
  city: string;
  state?: string;
  year_founded?: number;
}

export interface ArchiveGame {
  GAME_ID: string;
  GAME_DATE: string;
  SEASON_ID?: string;
  MATCHUP: string;
  WL?: string;
  TEAM_ID: number;
  TEAM_ABBREVIATION: string;
  TEAM_NAME?: string;
  PTS: number;
  PLUS_MINUS?: number;
  OPPONENT_TEAM_ID?: number;
  OPPONENT_TEAM_ABBREVIATION?: string;
  OPPONENT_TEAM_NAME?: string;
  OPP_PTS?: number;
  HOME_TEAM_ID?: number;
  AWAY_TEAM_ID?: number;
  HOME_TEAM_ABBREVIATION?: string;
  AWAY_TEAM_ABBREVIATION?: string;
  HOME_TEAM_NAME?: string;
  AWAY_TEAM_NAME?: string;
  HOME_PTS?: number;
  AWAY_PTS?: number;
  STAGE?: string;
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNBADate() {
  // Returns current date in Eastern Time (NBA HQ)
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export interface PlayByPlay {
  GAME_ID: string;
  EVENTNUM: number;
  EVENTMSGTYPE: number;
  PERIOD: number;
  WCTIMESTRING: string;
  PCTIMESTRING: string;
  HOMEDESCRIPTION: string | null;
  NEUTRALDESCRIPTION: string | null;
  VISITORDESCRIPTION: string | null;
  SCORE: string | null;
  SCOREMARGIN: string | null;
  PLAYER1_ID?: number;
  PLAYER1_NAME?: string;
  PLAYER1_TEAM_ID?: number;
  PLAYER2_ID?: number;
  PLAYER2_NAME?: string;
  PLAYER2_TEAM_ID?: number;
  PLAYER3_ID?: number;
  PLAYER3_NAME?: string;
  PLAYER3_TEAM_ID?: number;
}

export const nbaApi = {
  getScoreboard: (date?: string): Promise<Game[]> => {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return fetchWithCache(`${API_BASE_URL}/scoreboard${query}`, 4000);
  },

  getPlayByPlay: (gameId: string): Promise<PlayByPlay[]> => {
    return fetchWithCache(`${API_BASE_URL}/game/${gameId}/playbyplay`, 4000);
  },

  getStandings: (season?: string, seasonType?: string): Promise<Standing[]> => {
    const params = new URLSearchParams();
    if (season) params.append('season', season);
    if (seasonType) params.append('season_type', seasonType);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchWithCache(`${API_BASE_URL}/standings${query}`, 300000); // 5 min for standings
  },

  getTopPlayers: (): Promise<Player[]> => {
    return fetchWithCache(`${API_BASE_URL}/players/top`, 300000); // 5 min
  },

  getTeams: (): Promise<NbaTeam[]> => {
    return fetchWithCache(`${API_BASE_URL}/teams`, 3600000); // 1 hour
  },

  getBoxScore: (gameId: string): Promise<BoxScorePlayer[]> => {
    return fetchWithCache(`${API_BASE_URL}/game/${gameId}/boxscore`, 4000);
  },

  getGameTeamStats: (gameId: string): Promise<BoxScoreTeam[]> => {
    return fetchWithCache(`${API_BASE_URL}/game/${gameId}/team-stats`, 4000);
  },

  getPlayerShots: (playerId: number, gameId: string): Promise<PlayerShot[]> => {
    return fetchWithCache(`${API_BASE_URL}/player/${playerId}/shots/${gameId}`);
  },

  getTeamShots: (teamId: number, gameId: string): Promise<PlayerShot[]> => {
    return fetchWithCache(`${API_BASE_URL}/team/${teamId}/shots/${gameId}`);
  },

  getPlayerImpact: (gameId: string, playerId: number): Promise<PlayerImpact> => {
    return fetchWithCache(`${API_BASE_URL}/game/${gameId}/player/${playerId}/impact`);
  },

  getPlayerAverages: (playerId: number, season?: string): Promise<any> => {
    const query = season ? `?season=${encodeURIComponent(season)}` : '';
    return fetchWithCache(`${API_BASE_URL}/player/${playerId}/averages${query}`, 300000);
  },

  getAllPlayers: (): Promise<any[]> => {
    return fetchWithCache(`${API_BASE_URL}/players`, 3600000);
  },

  getPlayerProfile: (playerId: number): Promise<any> => {
    return fetchWithCache(`${API_BASE_URL}/player/${playerId}/profile`, 3600000);
  },

  getPlayerAwards: (playerId: number, season?: string): Promise<any[]> => {
    const query = season ? `?season=${encodeURIComponent(season)}` : '';
    return fetchWithCache(`${API_BASE_URL}/player/${playerId}/awards${query}`, 3600000);
  },

  getPlayerDetailedStats: (playerId: number, season?: string): Promise<PlayerGameLog[]> => {
    const query = season ? `?season=${encodeURIComponent(season)}` : '';
    return fetchWithCache(`${API_BASE_URL}/player/${playerId}/stats${query}`, 300000);
  },

  getTeamGameLog: (teamId: number, season?: string, seasonType?: string): Promise<TeamGame[]> => {
    const params = new URLSearchParams();
    if (season) params.append('season', season);
    if (seasonType) params.append('season_type', seasonType);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchWithCache(`${API_BASE_URL}/team/${teamId}/gamelog${query}`, 300000);
  },

  getFatigueReport: (teamId?: number | 'all', season?: string): Promise<FatigueReport> => {
    const params = new URLSearchParams();
    if (teamId && teamId !== 'all') params.append('team_id', String(teamId));
    if (season) params.append('season', season);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchWithCache(`${API_BASE_URL}/fatigue${query}`, 900000);
  },

  getPlayoffs: (season?: string): Promise<any[]> => {
    const query = season ? `?season=${encodeURIComponent(season)}` : '';
    return fetchWithCache(`${API_BASE_URL}/playoffs${query}`, 3600000);
  },

  getAwards: (): Promise<unknown[]> => {
    return fetchWithCache(`${API_BASE_URL}/awards`, 3600000);
  },

  getTeamRoster: (teamId: number | string): Promise<Player[]> => {
    return fetchWithCache(`${API_BASE_URL}/team/${teamId}/roster`, 3600000);
  },
  getAllTeamRosters: (): Promise<Record<string, Player[]>> => {
    return fetchWithCache(`${API_BASE_URL}/teams/rosters`, 3600000);
  },
  getLeaders: (category: string, season?: string, perMode: string = "PerGame", seasonType: string = "Regular Season"): Promise<Player[]> => {
    const params = new URLSearchParams({ category, per_mode: perMode, season_type: seasonType });
    if (season) params.append('season', season);
    return fetchWithCache(`${API_BASE_URL}/leaders?${params.toString()}`, 3600000);
  },
  getTeamHistory: (teamId: number | string, season: string): Promise<any> => {
    return fetchWithCache(`${API_BASE_URL}/vault/team-history?team_id=${teamId}&season=${season}`, 86400000);
  },
  getSeasonAwards: (season: string): Promise<any[]> => {
    return fetchWithCache(`${API_BASE_URL}/vault/season-awards?season=${season}`, 86400000);
  },
  getTeamJerseys: (teamName: string, season?: string): Promise<any[]> => {
    const query = season ? `&season=${season}` : '';
    return fetchWithCache(`${API_BASE_URL}/vault/jerseys?team_name=${encodeURIComponent(teamName)}${query}`, 86400000);
  },
  getHistoricalGames: (season?: string, seasonType: string = "Regular Season", teamId?: number | string, limit: number = 1000): Promise<ArchiveGame[]> => {
    const params = new URLSearchParams({ season_type: seasonType, limit: String(limit) });
    if (season) params.append('season', season);
    if (teamId && teamId !== 'all') params.append('team_id', String(teamId));
    return fetchWithCache(`${API_BASE_URL}/archive/games?${params.toString()}`, 3600000);
  }
};

export const getTeamLogoUrl = (teamId: number | string) => 
  `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`;

export const getPlayerHeadshotUrl = (playerId: number | string) => 
  `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${playerId}.png`;
