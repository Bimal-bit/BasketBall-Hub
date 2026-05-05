/*
  # NBA Intelligence System - Core Schema

  ## Summary
  Creates the complete data schema for the NBA Intelligence System analytics platform.

  ## New Tables
  1. `nba_teams` - All NBA franchises with stats and metadata
  2. `nba_players` - Player roster with performance metrics
  3. `nba_games` - Game results and team box scores
  4. `nba_player_game_stats` - Per-game player statistics
  5. `nba_predictions` - ML model predictions for games
  6. `nba_fatigue_scores` - Computed fatigue scores per player per day
  7. `nba_shot_attempts` - Shot chart data with success predictions

  ## Security
  - RLS enabled on all tables
  - Public read access for all analytics data (sports data is public)
  - No write access from client side
*/

-- Teams table
CREATE TABLE IF NOT EXISTS nba_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id text UNIQUE NOT NULL,
  name text NOT NULL,
  abbreviation text NOT NULL,
  conference text NOT NULL,
  division text NOT NULL,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  home_wins integer DEFAULT 0,
  home_losses integer DEFAULT 0,
  away_wins integer DEFAULT 0,
  away_losses integer DEFAULT 0,
  ppg numeric(5,1) DEFAULT 0,
  opp_ppg numeric(5,1) DEFAULT 0,
  pace numeric(5,1) DEFAULT 0,
  off_rating numeric(5,1) DEFAULT 0,
  def_rating numeric(5,1) DEFAULT 0,
  logo_color text DEFAULT '#1d428a',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE nba_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read teams"
  ON nba_teams FOR SELECT
  TO anon, authenticated
  USING (true);

-- Players table
CREATE TABLE IF NOT EXISTS nba_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text UNIQUE NOT NULL,
  team_id text REFERENCES nba_teams(team_id),
  name text NOT NULL,
  position text NOT NULL,
  age integer DEFAULT 25,
  height text DEFAULT '6-6',
  weight integer DEFAULT 210,
  jersey_number integer DEFAULT 0,
  ppg numeric(5,1) DEFAULT 0,
  rpg numeric(5,1) DEFAULT 0,
  apg numeric(5,1) DEFAULT 0,
  spg numeric(4,1) DEFAULT 0,
  bpg numeric(4,1) DEFAULT 0,
  fg_pct numeric(4,1) DEFAULT 0,
  three_pct numeric(4,1) DEFAULT 0,
  ft_pct numeric(4,1) DEFAULT 0,
  per numeric(5,1) DEFAULT 15,
  true_shooting_pct numeric(4,1) DEFAULT 0,
  usage_rate numeric(4,1) DEFAULT 0,
  minutes_per_game numeric(4,1) DEFAULT 0,
  image_url text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE nba_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read players"
  ON nba_players FOR SELECT
  TO anon, authenticated
  USING (true);

-- Games table
CREATE TABLE IF NOT EXISTS nba_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text UNIQUE NOT NULL,
  home_team_id text REFERENCES nba_teams(team_id),
  away_team_id text REFERENCES nba_teams(team_id),
  home_score integer DEFAULT 0,
  away_score integer DEFAULT 0,
  game_date date NOT NULL,
  status text DEFAULT 'scheduled',
  season text DEFAULT '2024-25',
  quarter integer DEFAULT 0,
  time_remaining text DEFAULT '',
  home_q1 integer DEFAULT 0,
  home_q2 integer DEFAULT 0,
  home_q3 integer DEFAULT 0,
  home_q4 integer DEFAULT 0,
  away_q1 integer DEFAULT 0,
  away_q2 integer DEFAULT 0,
  away_q3 integer DEFAULT 0,
  away_q4 integer DEFAULT 0,
  attendance integer DEFAULT 0,
  arena text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE nba_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read games"
  ON nba_games FOR SELECT
  TO anon, authenticated
  USING (true);

-- Player game stats
CREATE TABLE IF NOT EXISTS nba_player_game_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text REFERENCES nba_games(game_id),
  player_id text REFERENCES nba_players(player_id),
  team_id text REFERENCES nba_teams(team_id),
  points integer DEFAULT 0,
  rebounds integer DEFAULT 0,
  assists integer DEFAULT 0,
  steals integer DEFAULT 0,
  blocks integer DEFAULT 0,
  turnovers integer DEFAULT 0,
  fouls integer DEFAULT 0,
  minutes_played numeric(4,1) DEFAULT 0,
  fg_made integer DEFAULT 0,
  fg_attempted integer DEFAULT 0,
  three_made integer DEFAULT 0,
  three_attempted integer DEFAULT 0,
  ft_made integer DEFAULT 0,
  ft_attempted integer DEFAULT 0,
  plus_minus integer DEFAULT 0,
  game_score numeric(5,1) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, player_id)
);

ALTER TABLE nba_player_game_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read player game stats"
  ON nba_player_game_stats FOR SELECT
  TO anon, authenticated
  USING (true);

-- ML Predictions
CREATE TABLE IF NOT EXISTS nba_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text REFERENCES nba_games(game_id),
  predicted_winner text REFERENCES nba_teams(team_id),
  home_win_probability numeric(4,1) DEFAULT 50,
  predicted_home_score numeric(5,1) DEFAULT 110,
  predicted_away_score numeric(5,1) DEFAULT 110,
  predicted_spread numeric(4,1) DEFAULT 0,
  model_used text DEFAULT 'logistic_regression',
  confidence numeric(4,1) DEFAULT 50,
  key_factors jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE nba_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read predictions"
  ON nba_predictions FOR SELECT
  TO anon, authenticated
  USING (true);

-- Fatigue scores
CREATE TABLE IF NOT EXISTS nba_fatigue_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text REFERENCES nba_players(player_id),
  score_date date NOT NULL,
  fatigue_score numeric(5,1) DEFAULT 0,
  minutes_last_3 numeric(5,1) DEFAULT 0,
  back_to_back boolean DEFAULT false,
  games_last_7 integer DEFAULT 0,
  performance_drop numeric(5,1) DEFAULT 0,
  risk_level text DEFAULT 'low',
  created_at timestamptz DEFAULT now(),
  UNIQUE(player_id, score_date)
);

ALTER TABLE nba_fatigue_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read fatigue scores"
  ON nba_fatigue_scores FOR SELECT
  TO anon, authenticated
  USING (true);

-- Shot data
CREATE TABLE IF NOT EXISTS nba_shot_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text REFERENCES nba_players(player_id),
  game_id text REFERENCES nba_games(game_id),
  x_coord numeric(6,2) DEFAULT 0,
  y_coord numeric(6,2) DEFAULT 0,
  shot_distance numeric(5,1) DEFAULT 0,
  shot_type text DEFAULT '2pt',
  shot_zone text DEFAULT 'mid_range',
  made boolean DEFAULT false,
  defender_distance numeric(4,1) DEFAULT 4,
  predicted_probability numeric(4,1) DEFAULT 50,
  quarter integer DEFAULT 1,
  seconds_remaining integer DEFAULT 720,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE nba_shot_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read shot attempts"
  ON nba_shot_attempts FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_game_stats_player ON nba_player_game_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_game_stats_game ON nba_player_game_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_games_date ON nba_games(game_date);
CREATE INDEX IF NOT EXISTS idx_games_status ON nba_games(status);
CREATE INDEX IF NOT EXISTS idx_fatigue_player ON nba_fatigue_scores(player_id);
CREATE INDEX IF NOT EXISTS idx_shots_player ON nba_shot_attempts(player_id);
