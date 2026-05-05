import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Team = {
  id: string;
  team_id: string;
  name: string;
  abbreviation: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  home_wins: number;
  home_losses: number;
  away_wins: number;
  away_losses: number;
  ppg: number;
  opp_ppg: number;
  pace: number;
  off_rating: number;
  def_rating: number;
  logo_color: string;
};

export type Player = {
  id: string;
  player_id: string;
  team_id: string;
  name: string;
  position: string;
  age: number;
  height: string;
  weight: number;
  jersey_number: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fg_pct: number;
  three_pct: number;
  ft_pct: number;
  per: number;
  true_shooting_pct: number;
  usage_rate: number;
  minutes_per_game: number;
  image_url: string;
  is_active: boolean;
};

export type Game = {
  id: string;
  game_id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  game_date: string;
  status: string;
  season: string;
  quarter: number;
  time_remaining: string;
  home_q1: number; home_q2: number; home_q3: number; home_q4: number;
  away_q1: number; away_q2: number; away_q3: number; away_q4: number;
  attendance: number;
  arena: string;
};

export type PlayerGameStat = {
  id: string;
  game_id: string;
  player_id: string;
  team_id: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  minutes_played: number;
  fg_made: number;
  fg_attempted: number;
  three_made: number;
  three_attempted: number;
  ft_made: number;
  ft_attempted: number;
  plus_minus: number;
  game_score: number;
};

export type FatigueScore = {
  id: string;
  player_id: string;
  score_date: string;
  fatigue_score: number;
  minutes_last_3: number;
  back_to_back: boolean;
  games_last_7: number;
  performance_drop: number;
  risk_level: string;
  avg_rest_days?: number;
  workload_score?: number;
};
