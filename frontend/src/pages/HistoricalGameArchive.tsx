import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Award, Calendar, Clock, History, Search, Star, Trophy } from 'lucide-react';
import { nbaApi, type ArchiveGame, type BoxScorePlayer, type NbaTeam } from '../lib/api';

type SortMode = 'date' | 'score' | 'margin' | 'team';

const SEASONS = Array.from({ length: 30 }, (_, index) => {
  const start = 2025 - index;
  return `${start}-${String(start + 1).slice(-2)}`;
});

export default function HistoricalGameArchive() {
  const [teams, setTeams] = useState<NbaTeam[]>([]);
  const [games, setGames] = useState<ArchiveGame[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [boxscore, setBoxscore] = useState<BoxScorePlayer[]>([]);
  const [season, setSeason] = useState('2025-26');
  const [seasonType, setSeasonType] = useState('Regular Season');
  const [teamId, setTeamId] = useState<number | 'all'>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(1230);
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    nbaApi.getTeams().then(items => setTeams(items.slice().sort((a, b) => a.full_name.localeCompare(b.full_name)))).catch(() => setTeams([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    nbaApi.getHistoricalGames(season, seasonType, teamId, limit)
      .then(items => {
        setGames(items);
        setSelectedId(items[0]?.GAME_ID ?? '');
      })
      .catch(() => {
        setGames([]);
        setSelectedId('');
      })
      .finally(() => setLoading(false));
  }, [season, seasonType, teamId, limit]);

  useEffect(() => {
    if (!selectedId) {
      setBoxscore([]);
      return;
    }
    nbaApi.getBoxScore(selectedId).then(setBoxscore).catch(() => setBoxscore([]));
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return games
      .filter(game => !q || `${game.MATCHUP} ${game.TEAM_NAME} ${game.OPPONENT_TEAM_NAME} ${game.GAME_DATE}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortMode === 'score') return getTotalScore(b) - getTotalScore(a);
        if (sortMode === 'margin') return getMargin(a) - getMargin(b);
        if (sortMode === 'team') return getMatchup(a).localeCompare(getMatchup(b));
        return new Date(b.GAME_DATE).getTime() - new Date(a.GAME_DATE).getTime();
      });
  }, [games, query, sortMode]);

  const selected = games.find(game => game.GAME_ID === selectedId) ?? filtered[0] ?? null;
  const topPerformers = boxscore
    .filter(player => Number(player.PTS ?? 0) > 0)
    .sort((a, b) => scorePlayer(b) - scorePlayer(a))
    .slice(0, 8);
  const topScorer = topPerformers[0];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 border-[0.5px] mb-4">
          <h1 className="text-base font-medium text-zinc-900 dark:text-white">Season archive</h1>
          <p className="text-xs text-zinc-500">Official NBA game logs, searchable by season, team, and season type</p>
        </div>
        <div className="relative w-full lg:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search games or teams" className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-lg py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-orange-500/50" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <select value={season} onChange={event => setSeason(event.target.value)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50">
          {SEASONS.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={seasonType} onChange={event => setSeasonType(event.target.value)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50">
          <option value="Regular Season">Regular Season</option>
          <option value="Playoffs">Playoffs</option>
          <option value="Pre Season">Preseason</option>
        </select>
        <select value={teamId} onChange={event => setTeamId(event.target.value === 'all' ? 'all' : Number(event.target.value))} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50">
          <option value="all">All teams</option>
          {teams.map(team => <option key={team.id} value={team.id}>{team.abbreviation} - {team.full_name}</option>)}
        </select>
        <select value={limit} onChange={event => setLimit(Number(event.target.value))} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50">
          <option value={100}>Latest 100 games</option>
          <option value={500}>Latest 500 games</option>
          <option value={1230}>All season games</option>
          <option value={2000}>Full archive</option>
        </select>
        <select value={sortMode} onChange={event => setSortMode(event.target.value as SortMode)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50 sm:col-span-2 lg:col-span-1">
          <option value="date">Sort by newest</option>
          <option value="score">Sort by total score</option>
          <option value="margin">Sort by closest</option>
          <option value="team">Sort by matchup</option>
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
        <div className="space-y-2">
          <div className="text-xs text-gray-400">Loaded {games.length} records{limit >= 1230 ? ' (full season archive)' : ''}</div>
          {loading && <div className="text-center py-10 text-xs text-gray-500 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-xl">Loading official games...</div>}
          {!loading && filtered.map(game => (
            <button key={game.GAME_ID} onClick={() => setSelectedId(game.GAME_ID)} className={`w-full text-left rounded-xl border p-4 transition-transform duration-200 hover:scale-105 shadow-none hover:shadow-none ${selected?.GAME_ID === game.GAME_ID ? 'bg-gray-800 border-orange-500/40 shadow-none' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 border-[0.5px] hover:border-zinc-200 dark:border-zinc-800 border-[0.5px]'}`}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-sm font-medium text-white truncate">{getMatchup(game)}</div>
                {getMargin(game) <= 5 && <Clock size={13} className="text-orange-400 flex-shrink-0" />}
              </div>
              <div className="text-xs text-gray-400">{game.STAGE ?? seasonType}</div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-gray-500">{formatDate(game.GAME_DATE)}</span>
                <span className="font-medium text-white">{formatScore(game)}</span>
              </div>
            </button>
          ))}
          {!loading && filtered.length === 0 && <div className="text-center py-10 text-xs text-gray-500 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-xl">No official games match this archive view</div>}
        </div>

        <div className="space-y-4">
          {selected ? (
            <>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-xl p-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <History size={16} className="text-orange-400" />
                      <h3 className="text-xl font-medium text-white">{getMatchup(selected)}</h3>
                    </div>
                    <p className="text-sm text-gray-400">{selected.STAGE ?? seasonType} / Game ID {selected.GAME_ID}</p>
                  </div>
                  <div className="text-left lg:text-right">
                    <div className="text-2xl font-medium text-white">{formatScore(selected)}</div>
                    <div className="text-xs text-gray-500">{season}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <ArchiveMetric icon={<Calendar size={15} className="text-blue-400 mx-auto mb-1" />} label="Date" value={formatDate(selected.GAME_DATE)} />
                  <ArchiveMetric icon={<Trophy size={15} className="text-yellow-400 mx-auto mb-1" />} label="Type" value={selected.STAGE ?? seasonType} />
                  <ArchiveMetric icon={<Star size={15} className="text-cyan-400 mx-auto mb-1" />} label="Top Scorer" value={topScorer ? `${topScorer.PTS} pts` : '--'} />
                  <ArchiveMetric icon={<Clock size={15} className="text-orange-400 mx-auto mb-1" />} label="Margin" value={`${getMargin(selected)} pts`} />
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-xl p-4">
                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2"><Award size={14} className="text-yellow-400" />Official Boxscore Leaders</h4>
                <div className="space-y-2">
                  {topPerformers.map(player => (
                    <div key={player.PLAYER_ID} className="grid grid-cols-[1fr_44px_44px_44px] gap-2 rounded-lg bg-gray-800/40 p-3 items-center">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate">{player.PLAYER_NAME}</div>
                        <div className="text-[10px] text-gray-500">{player.TEAM_ABBREVIATION} / {player.MIN ?? '--'} min</div>
                      </div>
                      <StatBox value={Number(player.PTS ?? 0)} label="PTS" />
                      <StatBox value={Number(player.REB ?? 0)} label="REB" />
                      <StatBox value={Number(player.AST ?? 0)} label="AST" />
                    </div>
                  ))}
                  {topPerformers.length === 0 && <div className="text-center py-8 text-xs text-gray-500">Boxscore unavailable for this game from NBA API</div>}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-xl">Select a game to inspect the official archive entry</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArchiveMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="bg-gray-800/50 rounded-lg p-3 text-center">{icon}<div className="text-xs font-medium text-white truncate">{value}</div><div className="text-[10px] text-gray-500">{label}</div></div>;
}

function StatBox({ value, label }: { value: number; label: string }) {
  return <div className="text-center"><div className="text-sm font-medium text-white">{value}</div><div className="text-[9px] text-gray-500">{label}</div></div>;
}

function getMatchup(game: ArchiveGame) {
  return `${game.AWAY_TEAM_ABBREVIATION ?? game.OPPONENT_TEAM_ABBREVIATION ?? 'AWAY'} @ ${game.HOME_TEAM_ABBREVIATION ?? game.TEAM_ABBREVIATION ?? 'HOME'}`;
}

function formatScore(game: ArchiveGame) {
  const away = game.AWAY_PTS ?? game.OPP_PTS ?? 0;
  const home = game.HOME_PTS ?? game.PTS ?? 0;
  return `${away}-${home}`;
}

function getTotalScore(game: ArchiveGame) {
  return Number(game.HOME_PTS ?? game.PTS ?? 0) + Number(game.AWAY_PTS ?? game.OPP_PTS ?? 0);
}

function getMargin(game: ArchiveGame) {
  return Math.abs(Number(game.HOME_PTS ?? game.PTS ?? 0) - Number(game.AWAY_PTS ?? game.OPP_PTS ?? 0));
}

function scorePlayer(player: BoxScorePlayer) {
  return Number(player.PTS ?? 0) + Number(player.REB ?? 0) * 0.7 + Number(player.AST ?? 0) * 1.2 + Number(player.STL ?? 0) * 2 + Number(player.BLK ?? 0) * 2;
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
