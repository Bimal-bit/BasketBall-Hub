import type { Player } from './api';
import type { PlayerGameStat } from './supabase';

// Player Efficiency Rating computation
export function computePER(stats: PlayerGameStat, minutesPerGame: number): number {
  if (minutesPerGame === 0) return 0;
  const { points, rebounds, assists, steals, blocks, turnovers, fouls, fg_made, fg_attempted, ft_made, ft_attempted } = stats;
  const raw =
    points + rebounds * 1.2 + assists * 1.5 + steals * 2 + blocks * 1.7
    - (fg_attempted - fg_made) * 0.4
    - (ft_attempted - ft_made) * 0.7
    - turnovers - fouls * 0.4;
  return Math.round((raw / minutesPerGame) * 10 * 10) / 10;
}

// True Shooting %
export function trueShootingPct(pts: number, fga: number, fta: number): number {
  const tsa = fga + 0.44 * fta;
  if (tsa === 0) return 0;
  return Math.round((pts / (2 * tsa)) * 1000) / 10;
}

// Usage Rate
export function usageRate(fga: number, fta: number, to: number, teamFga: number, teamFta: number, teamTo: number, minutes: number, teamMinutes: number): number {
  if (minutes === 0 || teamMinutes === 0) return 0;
  const num = (fga + 0.44 * fta + to) * (teamMinutes / 5);
  const den = minutes * (teamFga + 0.44 * teamFta + teamTo);
  if (den === 0) return 0;
  return Math.round((num / den) * 1000) / 10;
}

// Fatigue score calculation
export function computeFatigueScore(
  minutesLast3: number,
  backToBack: boolean,
  gamesLast7: number,
  performanceDrop: number
): number {
  let score = 0;
  score += Math.min(minutesLast3 / 3, 40) * 0.8; // up to 32 pts
  score += backToBack ? 20 : 0;
  score += Math.min(gamesLast7, 7) * 3; // up to 21 pts
  score += Math.min(Math.abs(performanceDrop), 20) * 1.35; // up to 27 pts
  return Math.min(Math.round(score * 10) / 10, 100);
}

// Shot success probability (simulated Random Forest output)
export function predictShotSuccess(
  distance: number,
  defenderDistance: number,
  playerShootingPct: number,
  shotZone: string
): number {
  let base = playerShootingPct;
  // Distance penalty
  base -= distance * 0.4;
  // Defender proximity penalty
  if (defenderDistance < 2) base -= 12;
  else if (defenderDistance < 4) base -= 6;
  else if (defenderDistance > 6) base += 4;
  // Zone adjustment
  if (shotZone === 'paint') base += 8;
  if (shotZone === 'corner_three') base += 5;
  if (shotZone === 'mid_range') base -= 3;
  return Math.max(10, Math.min(85, Math.round(base * 10) / 10));
}

// Generate synthetic performance trend for a player
export function generatePerformanceTrend(player: Player, games = 10): Array<{ game: number; points: number; efficiency: number }> {
  return Array.from({ length: games }, (_, i) => {
    const variance = (Math.random() - 0.5) * player.ppg * 0.4;
    const pts = Math.max(0, Math.round(player.ppg + variance));
    const effVariance = (Math.random() - 0.5) * 8;
    const eff = Math.max(5, Math.round((player.per + effVariance) * 10) / 10);
    return { game: i + 1, points: pts, efficiency: eff };
  });
}

// Hot/cold streak detection
export function detectStreak(trend: Array<{ points: number }>): 'hot' | 'cold' | 'neutral' {
  if (trend.length < 3) return 'neutral';
  const recent = trend.slice(-3);
  const avg = trend.reduce((s, g) => s + g.points, 0) / trend.length;
  const recentAvg = recent.reduce((s, g) => s + g.points, 0) / recent.length;
  if (recentAvg > avg * 1.2) return 'hot';
  if (recentAvg < avg * 0.8) return 'cold';
  return 'neutral';
}

// AI Commentary generation
export function generateCommentary(
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
  topPerformer: { name: string; points: number; assists: number; rebounds: number }
): string {
  const winner = homeScore > awayScore ? homeTeam : awayTeam;
  const loser = homeScore > awayScore ? awayTeam : homeTeam;
  const margin = Math.abs(homeScore - awayScore);
  const { name, points, assists, rebounds } = topPerformer;

  const intros = [
    `In a ${margin < 5 ? 'nail-biting thriller' : margin < 15 ? 'competitive battle' : 'dominant performance'}, `,
    `The ${winner} delivered a ${margin < 10 ? 'hard-fought' : 'convincing'} victory, `,
    `Powered by a stellar performance, `,
  ];
  const intro = intros[Math.floor(Math.random() * intros.length)];

  const performances = [
    `${name} was unstoppable, posting ${points} points, ${rebounds} rebounds, and ${assists} assists`,
    `${name} led all scorers with ${points} points while adding ${rebounds} boards and ${assists} dimes`,
    `${name} orchestrated the offense brilliantly — ${points}/${rebounds}/${assists} on the night`,
  ];
  const perf = performances[Math.floor(Math.random() * performances.length)];

  const closers = [
    ` to help ${winner} dismantle the ${loser} ${homeScore}-${awayScore}.`,
    ` as ${winner} pulled away in the final stretch, winning ${homeScore}-${awayScore}.`,
    `. The ${loser} had no answer, falling ${awayScore}-${homeScore}.`,
  ];
  const closer = closers[Math.floor(Math.random() * closers.length)];

  return intro + perf + closer;
}

// Clutch performance analysis
export function analyzeClutchPerformance(stats: PlayerGameStat[]): {
  clutchRating: number;
  clutchGames: number;
  avgClutchPoints: number;
} {
  if (!stats.length) return { clutchRating: 0, clutchGames: 0, avgClutchPoints: 0 };
  const clutchGames = Math.floor(stats.length * 0.35);
  const avgPts = stats.reduce((s, g) => s + g.points, 0) / stats.length;
  // Simulate clutch scoring slightly above average
  const avgClutchPoints = Math.round((avgPts * 1.12) * 10) / 10;
  const clutchRating = Math.round(Math.min(99, (avgClutchPoints / 40) * 100) * 10) / 10;
  return { clutchRating, clutchGames, avgClutchPoints };
}

// Tactics definitions
export const TACTICAL_STRATEGIES = {
  'BALANCED': { name: 'Balanced', description: 'Standard gameplay with no specific bias.', ppgMod: 1.0, defMod: 1.0, astMod: 1.0, rebMod: 1.0 },
  'PACE_SPACE': { name: 'Pace & Space', description: 'Faster tempo, more 3PAs. Increases PPG and AST but lowers REB.', ppgMod: 1.12, defMod: 1.05, astMod: 1.15, rebMod: 0.9 },
  'GRIT_GRIND': { name: 'Grit & Grind', description: 'Slow, physical play. Lowers PPG but increases DEF and REB.', ppgMod: 0.88, defMod: 0.9, astMod: 0.85, rebMod: 1.2 },
  'LOCKDOWN': { name: 'Lockdown Defense', description: 'Focus on stopping the opponent. Greatly increases DEF but tires players.', ppgMod: 0.92, defMod: 0.8, astMod: 0.9, rebMod: 1.05 },
  'POST_DOMINANCE': { name: 'Post Dominance', description: 'Focus on interior scoring and boards. Increases REB and PPG but lowers AST.', ppgMod: 1.05, defMod: 1.0, astMod: 0.8, rebMod: 1.25 },
};

export type TacticKey = keyof typeof TACTICAL_STRATEGIES;

// Simulate lineup matchup
export function simulateLineup(
  homePlayers: Player[],
  awayPlayers: Player[],
  homeTactic: TacticKey = 'BALANCED',
  awayTactic: TacticKey = 'BALANCED'
): { 
  homeWinProb: number; 
  predictedHomePts: number; 
  predictedAwayPts: number; 
  mvp: string;
  homeStats: { pts: number; reb: number; ast: number; stl: number; blk: number };
  awayStats: { pts: number; reb: number; ast: number; stl: number; blk: number };
  playerPredictions: Record<string, { pts: number; reb: number; ast: number; stl: number; blk: number; fgPct: number }>;
} {
  // Ensure we have players
  if (homePlayers.length === 0 || awayPlayers.length === 0) {
    throw new Error("Lineups must not be empty");
  }

  // Normalize players to ensure they have at least 0 for stats
  const normalizePlayer = (p: Player) => ({
    ...p,
    PTS: p.PTS || (p as any).PPG || 0,
    REB: p.REB || (p as any).RPG || 0,
    AST: p.AST || (p as any).APG || 0,
    STL: p.STL || 0,
    BLK: p.BLK || 0,
    FG_PCT: p.FG_PCT || 0.45,
    name: p.PLAYER_NAME || p.PLAYER || (p as any).full_name || 'Unknown Player'
  });

  const validHome = homePlayers.map(normalizePlayer);
  const validAway = awayPlayers.map(normalizePlayer);

  const getStatsRating = (players: any[], tactic: TacticKey) => {
    const strat = TACTICAL_STRATEGIES[tactic];
    const pts = players.reduce((s, p) => s + (p.PTS || 0), 0) * strat.ppgMod;
    const reb = players.reduce((s, p) => s + (p.REB || 0), 0) * strat.rebMod;
    const ast = players.reduce((s, p) => s + (p.AST || 0), 0) * strat.astMod;
    const stl = players.reduce((s, p) => s + (p.STL || 0), 0);
    const blk = players.reduce((s, p) => s + (p.BLK || 0), 0);
    
    // Position balance check
    const uniquePositions = new Set(players.map(p => p.position || p.POSITION || p.pos)).size;
    const balanceBonus = uniquePositions * 2;
    
    const rating = (pts * 0.4 + reb * 0.25 + ast * 0.25 + (stl + blk) * 0.1) + balanceBonus;
    return { rating, pts, reb, ast, stl, blk };
  };

  const home = getStatsRating(validHome, homeTactic);
  const away = getStatsRating(validAway, awayTactic);
  
  // Tactical counter logic
  let tacticModifier = 0;
  if (homeTactic === 'PACE_SPACE' && awayTactic === 'GRIT_GRIND') tacticModifier = -3;
  if (homeTactic === 'GRIT_GRIND' && awayTactic === 'PACE_SPACE') tacticModifier = 3;
  if (homeTactic === 'LOCKDOWN' && awayTactic === 'PACE_SPACE') tacticModifier = 5;
  if (homeTactic === 'POST_DOMINANCE' && awayTactic === 'LOCKDOWN') tacticModifier = 4;

  const homeDefMod = TACTICAL_STRATEGIES[homeTactic].defMod;
  const awayDefMod = TACTICAL_STRATEGIES[awayTactic].defMod;

  const homeWinProb = Math.round(Math.min(95, Math.max(5, 50 + (home.rating * (1/homeDefMod) - away.rating * (1/awayDefMod)) * 1.2 + 3.0 + tacticModifier)) * 10) / 10;

  const baseScore = 102;
  const predictedHomePts = Math.round((baseScore + (home.rating - away.rating) * 0.8 + (Math.random() * 10 - 5)) * TACTICAL_STRATEGIES[homeTactic].ppgMod);
  const predictedAwayPts = Math.round((baseScore + (away.rating - home.rating) * 0.8 + (Math.random() * 10 - 5)) * TACTICAL_STRATEGIES[awayTactic].ppgMod);

  // Generate individual player predictions
  const playerPredictions: Record<string, { pts: number; reb: number; ast: number; stl: number; blk: number; fgPct: number }> = {};
  
  const generatePlayerStats = (p: any, teamTactic: TacticKey, oppDefMod: number) => {
    const strat = TACTICAL_STRATEGIES[teamTactic];
    const id = (p.PLAYER_ID || p.PERSON_ID || '').toString();
    if (!id) return;

    // Variance factor
    const variance = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
    
    playerPredictions[id] = {
      pts: Math.round((p.PTS || 0) * strat.ppgMod * (1/oppDefMod) * variance),
      reb: Math.round((p.REB || 0) * strat.rebMod * variance),
      ast: Math.round((p.AST || 0) * strat.astMod * variance),
      stl: Math.round((p.STL || 0) * variance),
      blk: Math.round((p.BLK || 0) * variance),
      fgPct: Math.round(Math.min(85, (p.FG_PCT || 0.45) * 100 * (1/oppDefMod) * variance) * 10) / 10
    };
  };

  validHome.forEach(p => generatePlayerStats(p, homeTactic, awayDefMod));
  validAway.forEach(p => generatePlayerStats(p, awayTactic, homeDefMod));

  const allPlayers = [...validHome, ...validAway];
  const mvp = allPlayers.reduce((best, p) => (p.PTS || 0) > (best.PTS || 0) ? p : best, allPlayers[0]);

  return { 
    homeWinProb, 
    predictedHomePts, 
    predictedAwayPts, 
    mvp: mvp?.name || 'N/A',
    homeStats: { pts: home.pts, reb: home.reb, ast: home.ast, stl: home.stl, blk: home.blk },
    awayStats: { pts: away.pts, reb: away.reb, ast: away.ast, stl: away.stl, blk: away.blk },
    playerPredictions
  };
}
