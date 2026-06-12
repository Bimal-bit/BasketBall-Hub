import { cachedFetch } from './apiCache';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const MINUTE = 60_000;

function getApiUrl(path: string) {
  if (!API_BASE_URL) {
    console.error('VITE_API_BASE_URL is not defined');
    throw new Error('VITE_API_BASE_URL is not defined');
  }

  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
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
  TOV?: number;
  PLUS_MINUS?: number;
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
  // NBA scoreboard endpoints are keyed to the league's Eastern Time game date.
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
  SHOT_VALUE?: number;
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
    return cachedFetch(getApiUrl(`/scoreboard${query}`), 30_000);
  },

  getPlayByPlay: (gameId: string): Promise<PlayByPlay[]> => {
    return cachedFetch(getApiUrl(`/game/${gameId}/playbyplay`), MINUTE);
  },

  getStandings: (season?: string, seasonType?: string): Promise<Standing[]> => {
    const params = new URLSearchParams();
    if (season) params.append('season', season);
    if (seasonType) params.append('season_type', seasonType);
    const query = params.toString() ? `?${params.toString()}` : '';
    return cachedFetch(getApiUrl(`/standings${query}`), 300_000);
  },

  getTopPlayers: (): Promise<Player[]> => {
    return cachedFetch(getApiUrl('/players/top'), 600_000);
  },

  searchPlayers: (query: string): Promise<Player[]> => {
    const params = new URLSearchParams({ query });
    return cachedFetch(getApiUrl(`/players/search?${params.toString()}`), 600_000);
  },

  getTeams: (): Promise<NbaTeam[]> => {
    return cachedFetch(getApiUrl('/teams'), 3_600_000);
  },

  getBoxScore: (gameId: string): Promise<BoxScorePlayer[]> => {
    return cachedFetch(getApiUrl(`/game/${gameId}/boxscore`), 600_000);
  },

  getGameTeamStats: (gameId: string): Promise<BoxScoreTeam[]> => {
    return cachedFetch(getApiUrl(`/game/${gameId}/team-stats`), 600_000);
  },

  getPlayerShots: (playerId: number, gameId: string): Promise<PlayerShot[]> => {
    return cachedFetch(getApiUrl(`/player/${playerId}/shots/${gameId}`), 600_000);
  },

  getTeamShots: (teamId: number, gameId: string): Promise<PlayerShot[]> => {
    return cachedFetch(getApiUrl(`/team/${teamId}/shots/${gameId}`), 600_000);
  },

  getPlayerImpact: (gameId: string, playerId: number): Promise<PlayerImpact> => {
    return cachedFetch(getApiUrl(`/game/${gameId}/player/${playerId}/impact`), 600_000);
  },

  getPlayerAverages: (playerId: number, season?: string): Promise<any> => {
    const query = season ? `?season=${encodeURIComponent(season)}` : '';
    return cachedFetch(getApiUrl(`/player/${playerId}/averages${query}`), 600_000);
  },

  getAllPlayers: (): Promise<any[]> => {
    return cachedFetch(getApiUrl('/players'), 3_600_000);
  },

  getPlayerInfo: (playerId: number): Promise<any> => {
    return cachedFetch(getApiUrl(`/player/${playerId}`), 600_000);
  },

  getPlayerProfile: (playerId: number): Promise<any> => {
    return cachedFetch(getApiUrl(`/player/${playerId}/profile`), 600_000);
  },

  getPlayerAwards: (playerId: number, season?: string): Promise<any[]> => {
    const query = season ? `?season=${encodeURIComponent(season)}` : '';
    return cachedFetch(getApiUrl(`/player/${playerId}/awards${query}`), 600_000);
  },

  getPlayerDetailedStats: (playerId: number, season?: string): Promise<PlayerGameLog[]> => {
    const query = season ? `?season=${encodeURIComponent(season)}` : '';
    return cachedFetch(getApiUrl(`/player/${playerId}/stats${query}`), 600_000);
  },

  getTeamGameLog: (teamId: number, season?: string, seasonType?: string): Promise<TeamGame[]> => {
    const params = new URLSearchParams();
    if (season) params.append('season', season);
    if (seasonType) params.append('season_type', seasonType);
    const query = params.toString() ? `?${params.toString()}` : '';
    return cachedFetch(getApiUrl(`/team/${teamId}/gamelog${query}`), 600_000);
  },

  getFatigueReport: (teamId?: number | 'all', season?: string): Promise<FatigueReport> => {
    const params = new URLSearchParams();
    if (teamId && teamId !== 'all') params.append('team_id', String(teamId));
    if (season) params.append('season', season);
    const query = params.toString() ? `?${params.toString()}` : '';
    return cachedFetch(getApiUrl(`/fatigue${query}`), 300_000);
  },

  getPlayoffs: (season?: string): Promise<any[]> => {
    const query = season ? `?season=${encodeURIComponent(season)}` : '';
    return cachedFetch(getApiUrl(`/playoffs${query}`), 600_000);
  },

  getAwards: (): Promise<unknown[]> => {
    return cachedFetch(getApiUrl('/awards'), 600_000);
  },

  getTeamRoster: (teamId: number | string): Promise<Player[]> => {
    return cachedFetch(getApiUrl(`/team/${teamId}/roster`), 600_000);
  },
  getAllTeamRosters: (): Promise<Record<string, Player[]>> => {
    return cachedFetch(getApiUrl('/teams/rosters'), 600_000);
  },
  getLeaders: (category: string, season?: string, perMode: string = "PerGame", seasonType: string = "Regular Season"): Promise<Player[]> => {
    const params = new URLSearchParams({ category, per_mode: perMode, season_type: seasonType });
    if (season) params.append('season', season);
    return cachedFetch(getApiUrl(`/leaders?${params.toString()}`), 600_000);
  },
  getTeamHistory: (teamId: number | string, season: string): Promise<any> => {
    return cachedFetch(getApiUrl(`/vault/team-history?team_id=${teamId}&season=${season}`), 86_400_000);
  },
  getSeasonAwards: (season: string): Promise<any[]> => {
    return cachedFetch(getApiUrl(`/vault/season-awards?season=${season}`), 86_400_000);
  },
  getTeamJerseys: (teamName: string, season?: string): Promise<any[]> => {
    const query = season ? `&season=${season}` : '';
    return cachedFetch(getApiUrl(`/vault/jerseys?team_name=${encodeURIComponent(teamName)}${query}`), 86_400_000);
  },
  getHistoricalGames: (season?: string, seasonType: string = "Regular Season", teamId?: number | string, limit: number = 1000): Promise<ArchiveGame[]> => {
    const params = new URLSearchParams({ season_type: seasonType, limit: String(limit) });
    if (season) params.append('season', season);
    if (teamId && teamId !== 'all') params.append('team_id', String(teamId));
    return cachedFetch(getApiUrl(`/archive/games?${params.toString()}`), 3_600_000);
  }
};

export const getTeamLogoUrl = (teamId: number | string) => 
  `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`;

export const getPlayerHeadshotUrl = (playerId: number | string) => 
  `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${playerId}.png`;

export function getPlayerId(player: any): number {
  return Number(player?.PLAYER_ID ?? player?.PERSON_ID ?? player?.id ?? player?.player_id ?? 0);
}

export function getPlayerName(player: any): string {
  return player?.PLAYER_NAME || player?.PLAYER || player?.full_name || player?.name || `${player?.PLAYER_FIRST_NAME ?? ''} ${player?.PLAYER_LAST_NAME ?? ''}`.trim() || 'Unknown Player';
}

export function getPlayerSalary(player: any): number {
  const pid = getPlayerId(player);
  const name = getPlayerName(player).toUpperCase();
  
  const starSalaries: Record<string, number> = {
    'STEPHEN CURRY': 55.7,
    'NIKOLA JOKIC': 51.4,
    'JOEL EMBIID': 51.4,
    'KEVIN DURANT': 51.2,
    'BRADLEY BEAL': 50.2,
    'JAYLEN BROWN': 49.7,
    'KARL-ANTHONY TOWNS': 49.2,
    'DEVIN BOOKER': 49.2,
    'KAWHI LEONARD': 49.2,
    'PAUL GEORGE': 49.2,
    'JIMMY BUTLER': 48.8,
    'DAMIAN LILLARD': 48.8,
    'GIANNIS ANTETOKOUNMPO': 48.8,
    'LEBRON JAMES': 48.7,
    'RUDY GOBERT': 43.8,
    'ANTHONY DAVIS': 43.2,
    'LUKA DONCIC': 43.0,
    'ZACH LAVINE': 43.0,
    'TRAE YOUNG': 43.0,
    'KYRIE IRVING': 41.0,
    'FRED VANVLEET': 42.8,
    'JAYSON TATUM': 34.8,
    'SHAI GILGEOUS-ALEXANDER': 35.8,
    'JA MORANT': 36.7,
    'ZION WILLIAMSON': 36.7,
    'DONOVAN MITCHELL': 35.4,
    'BAM ADEBAYO': 34.8,
    'DE\'AARON FOX': 34.8,
    'DOMANTAS SABONIS': 40.6,
    'LAURI MARKKANEN': 18.0,
    'PASCAL SIAKAM': 37.9,
    'OG ANUNOBY': 36.6,
    'TYRESE HALIBURTON': 35.2,
    'TYRESE MAXEY': 35.1,
    'LAMELO BALL': 35.2,
  };

  for (const star of Object.keys(starSalaries)) {
    if (name.includes(star)) {
      return starSalaries[star];
    }
  }

  // Fallback formula based on stats
  const pts = Number(player.PTS ?? player.pts ?? 0);
  const reb = Number(player.REB ?? player.reb ?? player.rebounds ?? 0);
  const ast = Number(player.AST ?? player.ast ?? player.assists ?? 0);
  const stl = Number(player.STL ?? player.stl ?? 0);
  const blk = Number(player.BLK ?? player.blk ?? 0);

  const production = pts * 0.75 + reb * 0.35 + ast * 0.5 + stl * 1.0 + blk * 1.0;
  return Math.max(1.5, Math.min(45.0, Math.round((production + 3.0) * 10) / 10));
}

export function estimateYears(player: any): number {
  const id = getPlayerId(player);
  return (id % 4) + 1;
}

export function estimateStatus(player: any): string {
  const id = getPlayerId(player);
  if (id % 7 === 0) return 'FA';
  if (id % 5 === 0) return 'Option';
  return 'Signed';
}
