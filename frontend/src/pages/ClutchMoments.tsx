import { type ReactNode, useEffect, useState } from 'react';
import { Activity, Award, Clock, Filter, Flame, TrendingUp } from 'lucide-react';
import { nbaApi, type BoxScorePlayer, type Game, type NbaTeam, type PlayByPlay } from '../lib/api';
import MiniLineChart from '../components/MiniLineChart';
import { formatIndianDate, getIndianDateKey } from '../lib/time';

const CLUTCH_PRESSURE_THRESHOLD = 62;

type ClutchMoment = {
  period: number;
  clock: string;
  description: string;
  score: string;
  margin: string;
};

type ClutchPerformer = {
  playerId: number;
  playerName: string;
  teamAbbreviation: string;
  stat: BoxScorePlayer;
  clutchScore: number;
  grade: string;
};

type ClutchGame = {
  game: Game;
  isClutch: boolean;
  margin: number;
  pressureRating: number;
  clutchReason: string;
  leadingTeam: string;
  topPerformers: ClutchPerformer[];
  keyMoments: ClutchMoment[];
};

type GameFilter = 'all' | 'clutch' | 'live' | 'final';
type SortMode = 'pressure' | 'date' | 'oldest' | 'margin' | 'score' | 'performer' | 'team';

export default function ClutchMoments() {
  const [clutchGames, setClutchGames] = useState<ClutchGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<ClutchGame | null>(null);
  const [filter, setFilter] = useState<GameFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('pressure');
  const [teams, setTeams] = useState<NbaTeam[]>([]);
  const [teamFilter, setTeamFilter] = useState<number | 'all'>('all');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    nbaApi.getTeams().then(items => setTeams(items.slice().sort((a, b) => a.full_name.localeCompare(b.full_name)))).catch(() => setTeams([]));
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const dates = buildRecentDates(getIndianDateKey(), 8);
      const firstWave = await Promise.all(dates.slice(0, 3).map(date => withTimeout(nbaApi.getScoreboard(date), 1800, [] as Game[]).catch(() => [])));
      const hasEnoughGames = firstWave.flat().filter(game => game.status !== 'scheduled').length >= 8;
      const recentScoreboardSets = hasEnoughGames
        ? firstWave
        : [
            ...firstWave,
            ...await Promise.all(dates.slice(3).map(date => withTimeout(nbaApi.getScoreboard(date), 1600, [] as Game[]).catch(() => []))),
          ];
      let games = (Array.isArray(recentScoreboardSets) ? recentScoreboardSets : [])
        .flat()
        .filter(game => game.status !== 'scheduled')
        .filter((game, index, arr) => arr.findIndex(item => item.game_id === game.game_id) === index)
        .sort((a, b) => new Date(b.game_date).getTime() - new Date(a.game_date).getTime());

      games = games.slice(0, 18);

      const processed = await mapWithConcurrency(games, 4, async game => {
        const margin = Math.abs((game.home_score ?? 0) - (game.away_score ?? 0));
        const pressureRating = computePressureRating(game, margin);
        const isClutch = pressureRating >= CLUTCH_PRESSURE_THRESHOLD;
        const boxscoreRaw = await withTimeout(nbaApi.getBoxScore(game.game_id), 1800, [] as BoxScorePlayer[]).catch(() => []);
        const shouldLoadPbp = isClutch || game.status === 'live' || margin <= 8;
        const playByPlayRaw = shouldLoadPbp
          ? await withTimeout(nbaApi.getPlayByPlay(game.game_id), 1800, [] as PlayByPlay[]).catch(() => [])
          : [];
        const boxscore = Array.isArray(boxscoreRaw) ? boxscoreRaw : [];
        const playByPlay = Array.isArray(playByPlayRaw) ? playByPlayRaw : [];
        const topPerformers = (boxscore.length > 0 ? boxscore : buildLeaderBoxScore(game))
          .filter(stat => Number(stat.PTS ?? 0) > 0)
          .sort((a, b) => computeClutchScore(b, isClutch, margin) - computeClutchScore(a, isClutch, margin))
          .slice(0, 5)
          .map(stat => {
            const clutchScore = computeClutchScore(stat, isClutch, margin);
            return {
              playerId: Number(stat.PLAYER_ID),
              playerName: stat.PLAYER_NAME,
              teamAbbreviation: stat.TEAM_ABBREVIATION,
              stat,
              clutchScore,
              grade: getClutchGrade(clutchScore),
            };
          });

        return {
          game,
          isClutch,
          margin,
          pressureRating,
          clutchReason: getClutchReason(game, margin, pressureRating),
          leadingTeam: getLeadingTeam(game),
          topPerformers,
          keyMoments: extractKeyMoments(playByPlay),
        };
      });

      setClutchGames(processed);
      setSelectedGame(processed.find(game => game.isClutch) ?? processed[0] ?? null);
    } catch {
      setClutchGames([]);
      setSelectedGame(null);
    } finally {
      setLoading(false);
    }
  }

  const clutchOnly = clutchGames.filter(game => game.isClutch);
  const totalClutchGames = clutchOnly.length;
  const liveClutchGames = clutchOnly.filter(game => game.game.status === 'live').length;
  const averagePressure = clutchGames.length ? Math.round(clutchGames.reduce((sum, game) => sum + game.pressureRating, 0) / clutchGames.length) : 0;
  const filteredGames = clutchGames
    .filter(game => {
      if (teamFilter !== 'all' && game.game.home_team_id !== teamFilter && game.game.away_team_id !== teamFilter) return false;
      if (filter === 'clutch') return game.isClutch;
      if (filter === 'live') return game.game.status === 'live';
      if (filter === 'final') return game.game.status === 'final';
      return true;
    })
    .sort((a, b) => {
      if (sortMode === 'date') return new Date(b.game.game_date).getTime() - new Date(a.game.game_date).getTime();
      if (sortMode === 'oldest') return new Date(a.game.game_date).getTime() - new Date(b.game.game_date).getTime();
      if (sortMode === 'margin') return a.margin - b.margin;
      if (sortMode === 'score') return (b.game.home_score + b.game.away_score) - (a.game.home_score + a.game.away_score);
      if (sortMode === 'performer') return (b.topPerformers[0]?.clutchScore ?? 0) - (a.topPerformers[0]?.clutchScore ?? 0);
      if (sortMode === 'team') return `${a.game.away_team_abbreviation} ${a.game.home_team_abbreviation}`.localeCompare(`${b.game.away_team_abbreviation} ${b.game.home_team_abbreviation}`);
      return b.pressureRating - a.pressureRating;
    });
  const allTopPerformers = clutchOnly
    .flatMap(game => game.topPerformers.map(performer => ({ ...performer, game })))
    .sort((a, b) => b.clutchScore - a.clutchScore)
    .slice(0, 10);

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        {[...Array(4)].map((_, index) => <div key={index} className="h-24 bg-gray-800 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-white mb-1">Clutch Moment Detector</h2>
        <p className="text-xs sm:text-sm text-gray-400">Recent NBA games ranked by late pressure and boxscore impact.</p>
      </div>

      <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
        <MetricCard icon={<Flame size={16} className="text-orange-400 mx-auto mb-1" />} value={totalClutchGames} label="Clutch" />
        <MetricCard icon={<Clock size={16} className="text-blue-400 mx-auto mb-1" />} value={liveClutchGames} label="Live" />
        <MetricCard icon={<TrendingUp size={16} className="text-green-400 mx-auto mb-1" />} value={allTopPerformers[0]?.playerName.split(' ').slice(-1)[0] ?? '--'} label="Top" />
        <MetricCard icon={<Award size={16} className="text-yellow-400 mx-auto mb-1" />} value={allTopPerformers[0]?.clutchScore.toFixed(0) ?? '--'} label="Score" />
        <MetricCard icon={<Activity size={16} className="text-cyan-400 mx-auto mb-1" />} value={averagePressure} label="Pressure" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
          <Filter size={14} className="text-gray-500 flex-shrink-0" />
          {(['all', 'clutch', 'live', 'final'] as GameFilter[]).map(mode => (
            <button key={mode} onClick={() => setFilter(mode)} className={`text-xs px-3 py-1.5 rounded border capitalize flex-shrink-0 ${filter === mode ? 'bg-orange-500/15 text-orange-300 border-orange-500/40' : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-700'}`}>
              {mode}
            </button>
          ))}
          <select value={teamFilter} onChange={event => setTeamFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))} className="text-xs bg-gray-900 border border-gray-800 rounded px-3 py-1.5 text-gray-300 outline-none focus:border-orange-500/40">
            <option value="all">All teams</option>
            {teams.map(team => <option key={team.id} value={team.id}>{team.abbreviation}</option>)}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={selectedGame?.game.game_id ?? ''} onChange={event => setSelectedGame(clutchGames.find(game => game.game.game_id === event.target.value) ?? null)} className="bg-gray-900 border border-gray-800 rounded px-3 py-2 text-xs text-gray-300 outline-none focus:border-orange-500/40">
            {clutchGames.map(game => <option key={game.game.game_id} value={game.game.game_id}>{game.game.away_team_abbreviation} @ {game.game.home_team_abbreviation} / {formatIndianDate(new Date(`${game.game.game_date}T12:00:00`), { month: 'short', day: 'numeric' })}</option>)}
          </select>
          <select value={sortMode} onChange={event => setSortMode(event.target.value as SortMode)} className="bg-gray-900 border border-gray-800 rounded px-3 py-2 text-xs text-gray-300 outline-none focus:border-orange-500/40">
            <option value="pressure">Sort by pressure</option>
            <option value="performer">Sort by top performer</option>
            <option value="score">Sort by total score</option>
            <option value="date">Sort by newest</option>
            <option value="oldest">Sort by oldest</option>
            <option value="margin">Sort by closest margin</option>
            <option value="team">Sort by matchup</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="order-2 lg:order-1 lg:col-span-1 space-y-2">
          <h3 className="text-sm font-semibold text-white">Recent Games</h3>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1 lg:max-h-none">
          {filteredGames.map(clutchGame => (
            <button key={clutchGame.game.game_id} onClick={() => setSelectedGame(clutchGame)} className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${selectedGame?.game.game_id === clutchGame.game.game_id ? 'bg-gray-800 border-orange-500/40' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {clutchGame.isClutch && <Flame size={10} className="text-orange-400 flex-shrink-0" />}
                  <span className="text-xs font-medium text-white truncate">{clutchGame.game.away_team_abbreviation} @ {clutchGame.game.home_team_abbreviation}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{formatIndianDate(new Date(`${clutchGame.game.game_date}T12:00:00`), { month: 'short', day: 'numeric' })}</span>
                  <span className="text-white font-medium">{clutchGame.game.away_score}-{clutchGame.game.home_score}</span>
                  {clutchGame.game.status === 'live' && <span className="text-green-400 font-medium">Q{clutchGame.game.quarter}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-xs font-bold ${clutchGame.margin < 5 ? 'text-orange-400' : clutchGame.margin < 10 ? 'text-yellow-400' : 'text-gray-400'}`}>+/-{clutchGame.margin}</div>
                <div className={`text-xs ${clutchGame.isClutch ? 'text-orange-400' : 'text-gray-500'}`}>{clutchGame.pressureRating}</div>
              </div>
            </button>
          ))}
          </div>
          {filteredGames.length === 0 && <div className="text-center py-8 text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-xl">No recent games found from NBA API</div>}
        </div>

        <div className="order-1 lg:order-2 lg:col-span-2 space-y-3 sm:space-y-4">
          {selectedGame ? (
            <>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div>
                    <div className="text-base font-bold text-white">{selectedGame.game.away_team_name} @ {selectedGame.game.home_team_name}</div>
                    <div className="text-xs text-gray-400">{formatIndianDate(new Date(`${selectedGame.game.game_date}T12:00:00`), { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedGame.isClutch && <span className="flex items-center gap-1 text-xs bg-orange-500/15 text-orange-400 px-2 py-1 rounded-full font-medium"><Flame size={10} />Clutch Game</span>}
                    <div className={`text-xs px-2 py-1 rounded ${selectedGame.game.status === 'live' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-300'}`}>{selectedGame.game.status.toUpperCase()}</div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-6 sm:gap-8 mb-4">
                  <ScoreBlock score={selectedGame.game.away_score} label={selectedGame.game.away_team_abbreviation ?? 'AWAY'} />
                  <div className="text-gray-500">-</div>
                  <ScoreBlock score={selectedGame.game.home_score} label={selectedGame.game.home_team_abbreviation ?? 'HOME'} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                  <DetailTile label="Pressure" value={`${selectedGame.pressureRating}/100`} />
                  <DetailTile label="Leader" value={selectedGame.leadingTeam} />
                  <DetailTile label="Trigger" value={selectedGame.clutchReason} />
                </div>

                <div className="grid grid-cols-4 gap-1 text-center">
                  {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, index) => (
                    <div key={quarter} className={`rounded-lg p-2 ${index === 3 && selectedGame.isClutch ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-gray-800/50'}`}>
                      <div className="text-xs text-gray-500">{quarter}</div>
                      <div className="text-xs font-medium text-gray-300">{selectedGame.game.away_period_scores?.[index] ?? 0}-{selectedGame.game.home_period_scores?.[index] ?? 0}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
                <h4 className="text-sm font-semibold text-white mb-3">Late-Game Moment Feed</h4>
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1 sm:max-h-none">
                  {selectedGame.keyMoments.map((moment, index) => (
                    <div key={`${moment.period}-${moment.clock}-${index}`} className="flex items-start gap-3 rounded-lg bg-gray-800/40 p-3">
                      <div className="text-[10px] font-bold text-orange-300 w-14 flex-shrink-0">Q{moment.period} {moment.clock}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white">{moment.description}</div>
                        <div className="text-[10px] text-gray-500 mt-1">{moment.score || 'No score'} / margin {moment.margin || '--'}</div>
                      </div>
                    </div>
                  ))}
                  {selectedGame.keyMoments.length === 0 && (
                    <div className="text-center py-6 text-xs text-gray-500 bg-gray-800/30 rounded-lg">No late-game play-by-play moments available for this game</div>
                  )}
                </div>
              </div>

              {selectedGame.topPerformers.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-white mb-3">Official Boxscore Impact</h4>
                  <div className="space-y-3">
                    {selectedGame.topPerformers.map((performer, index) => <PerformerRow key={`${performer.playerId}-${index}`} performer={performer} rank={index + 1} />)}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">Select a game to view clutch analysis</div>
          )}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Award size={14} className="text-yellow-400" />Clutch Leaderboard</h3>
        <div className="grid gap-2 sm:hidden">
          {allTopPerformers.slice(0, 5).map((performer, index) => (
            <PerformerRow key={`${performer.playerId}-mobile-${index}`} performer={performer} rank={index + 1} />
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-800">
                <th className="text-left pb-2 font-medium">Player</th>
                <th className="text-center pb-2 font-medium">Score</th>
                <th className="text-center pb-2 font-medium">Grade</th>
                <th className="text-center pb-2 font-medium">PTS</th>
                <th className="text-center pb-2 font-medium">REB</th>
                <th className="text-center pb-2 font-medium">AST</th>
                <th className="text-center pb-2 font-medium">Game</th>
              </tr>
            </thead>
            <tbody>
              {allTopPerformers.map((performer, index) => (
                <tr key={`${performer.playerId}-${index}`} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="py-2.5 text-xs font-medium text-white">{index + 1}. {performer.playerName}<div className="text-xs text-gray-500">{performer.teamAbbreviation}</div></td>
                  <td className="text-center py-2.5 text-xs font-bold text-orange-400">{performer.clutchScore.toFixed(1)}</td>
                  <td className="text-center py-2.5 text-xs font-bold text-cyan-300">{performer.grade}</td>
                  <td className="text-center py-2.5 text-xs text-white">{performer.stat.PTS ?? 0}</td>
                  <td className="text-center py-2.5 text-xs text-gray-300">{performer.stat.REB ?? 0}</td>
                  <td className="text-center py-2.5 text-xs text-gray-300">{performer.stat.AST ?? 0}</td>
                  <td className="text-center py-2.5 text-xs text-gray-400">{performer.game.game.away_team_abbreviation} @ {performer.game.game.home_team_abbreviation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {allTopPerformers.length === 0 && <div className="text-center py-8 text-xs text-gray-500">No clutch performers found yet</div>}
      </div>
    </div>
  );
}

function computeClutchScore(stat: BoxScorePlayer, isClutch: boolean, margin: number): number {
  const anyStat = stat as any;
  let score = Number(stat.PTS ?? 0) + Number(stat.AST ?? 0) * 1.6 + Number(stat.REB ?? 0) * 0.85 + Number(stat.STL ?? 0) * 2.5 + Number(stat.BLK ?? 0) * 2.2 + Number(stat.PLUS_MINUS ?? 0) * 0.25 - Number(anyStat.TO ?? anyStat.TOV ?? 0) * 1.7;
  if (isClutch) score *= 1.25;
  if (margin <= 3) score *= 1.1;
  return Math.round(score * 10) / 10;
}

function computePressureRating(game: Game, margin: number): number {
  const isLate = game.quarter >= 4 || game.status === 'final';
  const marginScore = Math.max(0, 60 - margin * 7);
  const quarterScore = game.quarter > 4 ? 30 : game.quarter === 4 || game.status === 'final' ? 25 : Math.max(0, game.quarter - 1) * 6;
  const liveScore = game.status === 'live' ? 15 : 5;
  const closeFinalBonus = game.status === 'final' && margin <= 7 ? 14 : 0;
  if (!isLate && margin > 5) return Math.min(55, marginScore + quarterScore);
  return Math.min(100, Math.round(marginScore + quarterScore + liveScore + closeFinalBonus));
}

function getClutchReason(game: Game, margin: number, pressureRating: number): string {
  if (game.status === 'live' && game.quarter >= 4 && margin <= 5) return `Live Q${game.quarter}, ${margin}-point margin`;
  if (game.status === 'final' && margin <= 5) return `Final decided by ${margin} point${margin === 1 ? '' : 's'}`;
  if (pressureRating >= CLUTCH_PRESSURE_THRESHOLD) return `${margin}-point margin`;
  return margin <= 10 ? 'Close-watch game' : 'Standard pressure';
}

function getClutchGrade(score: number): string {
  if (score >= 45) return 'A+';
  if (score >= 35) return 'A';
  if (score >= 25) return 'B';
  if (score >= 15) return 'C';
  return 'D';
}

function getLeadingTeam(game: Game): string {
  if (game.home_score === game.away_score) return 'Tied';
  return game.home_score > game.away_score ? game.home_team_abbreviation ?? 'Home' : game.away_team_abbreviation ?? 'Away';
}

function buildRecentDates(today: string, days: number): string[] {
  const start = new Date(`${today}T12:00:00`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() - index);
    return date.toISOString().slice(0, 10);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const timer = window.setTimeout(() => resolve(fallback), ms);
    promise
      .then(value => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        window.clearTimeout(timer);
        resolve(fallback);
      });
  });
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function extractKeyMoments(playByPlay: PlayByPlay[]): ClutchMoment[] {
  const moments = playByPlay
    .filter(event => event.PERIOD >= 4)
    .filter(event => {
      const secondsLeft = clockToSeconds(event.PCTIMESTRING);
      const margin = parseScoreMargin(event.SCOREMARGIN);
      const isScoringOrTurnover = [1, 3, 5].includes(Number(event.EVENTMSGTYPE));
      return secondsLeft <= 180 && Math.abs(margin) <= 6 && isScoringOrTurnover;
    })
    .slice(-8)
    .reverse()
    .map(event => ({
      period: event.PERIOD,
      clock: event.PCTIMESTRING,
      description: event.HOMEDESCRIPTION || event.VISITORDESCRIPTION || event.NEUTRALDESCRIPTION || 'Clutch sequence',
      score: event.SCORE ?? '',
      margin: event.SCOREMARGIN ?? '',
    }));
  return moments;
}

function clockToSeconds(clock: string) {
  const [minutes, seconds] = (clock || '0:00').split(':').map(Number);
  return (Number.isFinite(minutes) ? minutes : 0) * 60 + (Number.isFinite(seconds) ? seconds : 0);
}

function parseScoreMargin(value: string | null) {
  if (!value || value === 'TIE') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 99;
}

function buildLeaderBoxScore(game: Game): BoxScorePlayer[] {
  return [game.away_leader, game.home_leader]
    .filter(Boolean)
    .map((leader, index) => ({
      GAME_ID: game.game_id,
      TEAM_ID: index === 0 ? game.away_team_id : game.home_team_id,
      TEAM_ABBREVIATION: index === 0 ? game.away_team_abbreviation ?? 'AWY' : game.home_team_abbreviation ?? 'HME',
      PLAYER_ID: Number(leader?.personId ?? index + 1),
      PLAYER_NAME: leader?.name ?? 'Team Leader',
      PTS: leader?.points ?? 0,
      REB: leader?.rebounds ?? 0,
      AST: leader?.assists ?? 0,
      STL: 0,
      BLK: 0,
      PLUS_MINUS: game.status === 'final' ? (index === 0 ? game.away_score - game.home_score : game.home_score - game.away_score) : 0,
    }));
}

function MetricCard({ icon, value, label }: { icon: ReactNode; value: string | number; label: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-2 text-center sm:p-4 min-w-0">
      {icon}
      <div className="text-base sm:text-2xl font-bold text-white truncate">{value}</div>
      <div className="text-[10px] sm:text-xs text-gray-400 truncate">{label}</div>
    </div>
  );
}

function ScoreBlock({ score, label }: { score: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl sm:text-3xl font-black text-white">{score}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-2 sm:p-3 min-w-0">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xs font-medium text-gray-300 truncate">{value}</div>
    </div>
  );
}

function PerformerRow({ performer, rank }: { performer: ClutchPerformer; rank: number }) {
  const sparkData = [
    Number(performer.stat.PTS ?? 0),
    Number(performer.stat.REB ?? 0) * 2,
    Number(performer.stat.AST ?? 0) * 3,
    Number(performer.stat.STL ?? 0) * 4,
    Number(performer.stat.BLK ?? 0) * 4,
    Math.max(0, Number(performer.stat.PLUS_MINUS ?? 0) + 8),
    performer.clutchScore,
  ].map(value => Math.max(0, Math.round(value)));

  return (
    <div className="flex items-center gap-2 sm:gap-3 rounded-lg bg-gray-800/30 p-2 sm:bg-transparent sm:p-0">
      <div className="text-sm font-bold text-gray-500 w-4">{rank}</div>
      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-800 flex items-center justify-center text-[10px] sm:text-xs font-bold text-white flex-shrink-0">{performer.playerName.split(' ').map(name => name[0]).join('')}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{performer.playerName}</span>
          {rank === 1 && <Flame size={12} className="text-orange-400 flex-shrink-0" />}
        </div>
        <div className="text-[11px] sm:text-xs text-gray-400 truncate">{performer.stat.PTS ?? 0}pts / {performer.stat.REB ?? 0}reb / {performer.stat.AST ?? 0}ast / {performer.grade}</div>
      </div>
      <div className="hidden w-20 flex-shrink-0 sm:block"><MiniLineChart data={sparkData} color="#f97316" height={30} /></div>
      <div className="text-right flex-shrink-0">
        <div className={`text-sm font-bold ${performer.clutchScore >= 40 ? 'text-orange-400' : 'text-white'}`}>{performer.clutchScore.toFixed(0)}</div>
        <div className="text-xs text-gray-500">score</div>
      </div>
    </div>
  );
}
