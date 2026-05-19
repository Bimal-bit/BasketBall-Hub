import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BrainCircuit,
  LineChart,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import {
  getPlayerHeadshotUrl,
  getTeamLogoUrl,
  nbaApi,
  type Game,
  type BoxScorePlayer,
  type NbaTeam,
  type Player,
  type PlayerGameLog,
  type PlayByPlay,
  type Standing,
  type TeamGame,
} from '../lib/api';
import { mockPlayers, mockTeams } from '../lib/mockData';
import { gameStatusInIndia, getIndianDateKey } from '../lib/time';

type WatchItem = {
  id: string;
  type: 'Player' | 'Team' | 'Game';
  label: string;
  sub: string;
};

type TeamOption = NbaTeam & {
  wins?: number;
  losses?: number;
  winPct?: number;
  l10?: string;
  streak?: string;
  conference?: string;
};

type TeamProfile = {
  ppg: number;
  oppPpg: number;
  offRating: number;
  defRating: number;
  pace: number;
  formScore: number;
  playoffOdds: number;
  topScorers: string[];
  injuryNote: string;
};

const WATCHLIST_KEY = 'nba-live-watchlist';

export default function InsightsLab() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [playerAId, setPlayerAId] = useState<number | null>(null);
  const [playerBId, setPlayerBId] = useState<number | null>(null);
  const [teamAId, setTeamAId] = useState<number | null>(null);
  const [teamBId, setTeamBId] = useState<number | null>(null);
  const [gameId, setGameId] = useState('');
  const [teamALogs, setTeamALogs] = useState<TeamGame[]>([]);
  const [teamBLogs, setTeamBLogs] = useState<TeamGame[]>([]);
  const [playerALogs, setPlayerALogs] = useState<PlayerGameLog[]>([]);
  const [playerBLogs, setPlayerBLogs] = useState<PlayerGameLog[]>([]);
  const [teamRosters, setTeamRosters] = useState<Record<string, Player[]>>({});
  const [watchlist, setWatchlist] = useState<WatchItem[]>(() => readWatchlist());
  const [recap, setRecap] = useState('');
  const [recapLoading, setRecapLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLabData = useCallback(async (cancelled: () => boolean) => {
    setRefreshing(true);
    const [playerResult, teamResult, standingResult, gameResult] = await Promise.allSettled([
      nbaApi.getTopPlayers(),
      nbaApi.getTeams(),
      nbaApi.getStandings(),
      nbaApi.getScoreboard(getIndianDateKey()),
    ]);

    if (cancelled()) return;

    const apiPlayers = playerResult.status === 'fulfilled' && playerResult.value.length ? playerResult.value : fallbackPlayers();
    const apiStandings = standingResult.status === 'fulfilled' ? standingResult.value : [];
    const apiTeams = teamResult.status === 'fulfilled' && teamResult.value.length ? teamResult.value : fallbackTeams();
    const apiGames = gameResult.status === 'fulfilled' ? gameResult.value : [];

    const enrichedTeams = apiTeams.map(team => {
      const standing = apiStandings.find(row => row.TeamID === team.id);
      return {
        ...team,
        wins: standing?.Wins,
        losses: standing?.Losses,
        winPct: standing?.WinPCT,
        l10: standing?.L10Rec,
        streak: standing?.Strk,
        conference: standing?.Conference,
      };
    });

    setPlayers(apiPlayers);
    setTeams(enrichedTeams);
    setStandings(apiStandings);
    setGames(apiGames);
    setPlayerAId(current => current ?? apiPlayers[0]?.PERSON_ID ?? null);
    setPlayerBId(current => current ?? apiPlayers[1]?.PERSON_ID ?? null);
    setTeamAId(current => current ?? enrichedTeams[0]?.id ?? null);
    setTeamBId(current => current ?? enrichedTeams[1]?.id ?? null);
    setGameId(current => current || apiGames[0]?.game_id || '');
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    loadLabData(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadLabData]);

  useEffect(() => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    let cancelled = false;

    async function loadLogs() {
      const [a, b] = await Promise.allSettled([
        teamAId ? nbaApi.getTeamGameLog(teamAId).catch(() => []) : Promise.resolve([]),
        teamBId ? nbaApi.getTeamGameLog(teamBId).catch(() => []) : Promise.resolve([]),
      ]);

      if (cancelled) return;
      setTeamALogs(a.status === 'fulfilled' ? a.value.slice(0, 8) : []);
      setTeamBLogs(b.status === 'fulfilled' ? b.value.slice(0, 8) : []);
    }

    loadLogs();
    return () => {
      cancelled = true;
    };
  }, [teamAId, teamBId]);

  useEffect(() => {
    let cancelled = false;

    async function loadPlayerLogs() {
      const [a, b] = await Promise.allSettled([
        playerAId ? nbaApi.getPlayerDetailedStats(playerAId).catch(() => []) : Promise.resolve([]),
        playerBId ? nbaApi.getPlayerDetailedStats(playerBId).catch(() => []) : Promise.resolve([]),
      ]);

      if (cancelled) return;
      setPlayerALogs(a.status === 'fulfilled' ? a.value.slice(0, 8) : []);
      setPlayerBLogs(b.status === 'fulfilled' ? b.value.slice(0, 8) : []);
    }

    loadPlayerLogs();
    return () => {
      cancelled = true;
    };
  }, [playerAId, playerBId]);

  useEffect(() => {
    let cancelled = false;

    async function loadRosters() {
      const ids = Array.from(new Set([teamAId, teamBId].filter(Boolean) as number[]));
      if (!ids.length) return;

      const results = await Promise.allSettled(ids.map(id => nbaApi.getTeamRoster(id).catch(() => [])));
      if (cancelled) return;

      setTeamRosters(current => {
        const next = { ...current };
        ids.forEach((id, index) => {
          if (next[String(id)]?.length) return;
          next[String(id)] = results[index].status === 'fulfilled' ? results[index].value : [];
        });
        return next;
      });
    }

    loadRosters();
    return () => {
      cancelled = true;
    };
  }, [teamAId, teamBId]);

  const playerA = players.find(player => player.PERSON_ID === playerAId) ?? null;
  const playerB = players.find(player => player.PERSON_ID === playerBId) ?? null;
  const teamA = teams.find(team => team.id === teamAId) ?? null;
  const teamB = teams.find(team => team.id === teamBId) ?? null;
  const selectedGame = games.find(game => game.game_id === gameId) ?? null;
  const winModel = useMemo(() => selectedGame ? buildWinModel(selectedGame) : null, [selectedGame]);

  function addWatch(item: WatchItem) {
    setWatchlist(current => current.some(existing => existing.id === item.id) ? current : [item, ...current].slice(0, 12));
  }

  function removeWatch(id: string) {
    setWatchlist(current => current.filter(item => item.id !== id));
  }

  async function generateRecap() {
    if (!selectedGame) return;
    setRecapLoading(true);
    setRecap('');

    const [boxResult, pbpResult] = await Promise.allSettled([
      nbaApi.getBoxScore(selectedGame.game_id).catch(() => []),
      nbaApi.getPlayByPlay(selectedGame.game_id).catch(() => []),
    ]);

    const box = boxResult.status === 'fulfilled' ? boxResult.value : [];
    const pbp = pbpResult.status === 'fulfilled' ? pbpResult.value : [];
    setRecap(buildRecap(selectedGame, box, pbp));
    setRecapLoading(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-sm font-bold uppercase tracking-[0.2em] text-orange-400">
        Loading insights
      </div>
    );
  }

  return (
    <div className="max-w-full space-y-4 overflow-hidden sm:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] sm:text-xs font-black uppercase tracking-[0.18em] sm:tracking-[0.22em] text-orange-500">
            <BrainCircuit size={16} />
            Insights Lab
          </div>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white sm:text-4xl">
            Compare, predict, recap, and follow
          </h1>
          <p className="mt-2 max-w-2xl text-xs sm:text-sm text-gray-400">
            Player matchups, team scouting, win probability, recaps, and watchlist in one compact workspace.
          </p>
        </div>
        <button
          onClick={() => loadLabData(() => false)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-orange-400 hover:border-orange-500/50 hover:bg-orange-500/10 sm:w-auto"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing' : 'Refresh Lab'}
        </button>
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
        <Panel title="Player Comparison" icon={<Users size={18} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <PlayerSelect label="Player A" value={playerAId} players={players} onChange={setPlayerAId} />
            <PlayerSelect label="Player B" value={playerBId} players={players} onChange={setPlayerBId} />
          </div>
          <ComparePlayers playerA={playerA} playerB={playerB} playerALogs={playerALogs} playerBLogs={playerBLogs} />
          <div className="flex justify-end">
            {playerA && (
              <AddButton onClick={() => addWatch({
                id: `player-${playerA.PERSON_ID}`,
                type: 'Player',
                label: playerName(playerA),
                sub: playerA.TEAM_ABBREVIATION || 'NBA',
              })} />
            )}
          </div>
        </Panel>

        <Panel title="Team Comparison" icon={<LineChart size={18} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <TeamSelect label="Team A" value={teamAId} teams={teams} onChange={setTeamAId} />
            <TeamSelect label="Team B" value={teamBId} teams={teams} onChange={setTeamBId} />
          </div>
          <CompareTeams
            teamA={teamA}
            teamB={teamB}
            teamALogs={teamALogs}
            teamBLogs={teamBLogs}
            teamARoster={teamA ? teamRosters[String(teamA.id)] ?? [] : []}
            teamBRoster={teamB ? teamRosters[String(teamB.id)] ?? [] : []}
            standings={standings}
          />
          <div className="flex justify-end">
            {teamA && (
              <AddButton onClick={() => addWatch({
                id: `team-${teamA.id}`,
                type: 'Team',
                label: teamA.full_name,
                sub: `${teamA.wins ?? 0}-${teamA.losses ?? 0}`,
              })} />
            )}
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr] xl:gap-6">
        <Panel title="Win Probability Graph" icon={<Sparkles size={18} />}>
          <GameSelect value={gameId} games={games} onChange={setGameId} />
          {selectedGame && winModel ? (
            <div className="space-y-4 sm:space-y-5">
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <TeamWinBlock game={selectedGame} side="away" probability={100 - winModel.homeProbability} />
                <div className="min-w-0 rounded-xl border border-gray-800 bg-black/30 p-2 text-center sm:p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">{selectedGame.status}</div>
                  <div className="mt-2 text-lg font-black text-white sm:text-3xl">{selectedGame.away_score}-{selectedGame.home_score}</div>
                  <div className="mt-1 text-xs text-gray-400">{gameStatusInIndia(selectedGame)}</div>
                </div>
                <TeamWinBlock game={selectedGame} side="home" probability={winModel.homeProbability} />
              </div>
              <ProbabilityChart data={winModel.series} />
              <button
                onClick={() => addWatch({
                  id: `game-${selectedGame.game_id}`,
                  type: 'Game',
                  label: `${selectedGame.away_team_abbreviation} @ ${selectedGame.home_team_abbreviation}`,
                  sub: `${selectedGame.away_score}-${selectedGame.home_score} ${gameStatusInIndia(selectedGame)}`,
                })}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-800 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-orange-400 hover:border-orange-500/50 hover:bg-orange-500/10 sm:w-auto"
              >
                <Bell size={14} />
                Watch this game
              </button>
            </div>
          ) : (
            <EmptyState text="No games are available for the current NBA date." />
          )}
        </Panel>

        <Panel title="AI Game Recap" icon={<Sparkles size={18} />}>
          <GameSelect value={gameId} games={games} onChange={setGameId} />
          <button
            onClick={generateRecap}
            disabled={!selectedGame || recapLoading}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles size={15} />
            {recapLoading ? 'Writing recap' : 'Generate recap'}
          </button>
          <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-gray-800 bg-black/30 p-3 text-xs leading-5 text-gray-300 sm:max-h-none sm:p-4 sm:text-sm sm:leading-6">
            {recap || 'Choose a game and generate a recap to summarize leaders, score flow, and the most important notes.'}
          </div>
        </Panel>
      </section>

      <Panel title="Personal Watchlist" icon={<Star size={18} />}>
        <WatchlistSummary watchlist={watchlist} games={games} players={players} teams={teams} />
        {watchlist.length === 0 ? (
          <EmptyState text="Add players, teams, or games from the panels above. Your watchlist is saved in this browser." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {watchlist.map(item => (
              <div key={item.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">{item.type}</div>
                  <div className="mt-1 truncate font-bold text-white">{item.label}</div>
                  <div className="truncate text-xs text-gray-400">{item.sub}</div>
                </div>
                <button
                  onClick={() => removeWatch(item.id)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                  aria-label={`Remove ${item.label}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-gray-800 bg-gray-900/40 p-3 shadow-2xl shadow-black/10 sm:p-5">
      <div className="mb-3 flex items-center gap-3 sm:mb-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 sm:h-9 sm:w-9">{icon}</div>
        <h2 className="min-w-0 text-base font-black uppercase italic tracking-tight text-white sm:text-lg">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function PlayerSelect({ label, value, players, onChange }: {
  label: string;
  value: number | null;
  players: Player[];
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-gray-500">{label}</span>
      <select
        value={value ?? ''}
        onChange={event => onChange(Number(event.target.value))}
        className="w-full min-w-0 rounded-xl border border-gray-800 bg-black/40 px-3 py-2.5 text-xs text-white sm:py-3 sm:text-sm"
      >
        {players.map(player => (
          <option key={player.PERSON_ID} value={player.PERSON_ID}>{playerName(player)}</option>
        ))}
      </select>
    </label>
  );
}

function TeamSelect({ label, value, teams, onChange }: {
  label: string;
  value: number | null;
  teams: TeamOption[];
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-gray-500">{label}</span>
      <select
        value={value ?? ''}
        onChange={event => onChange(Number(event.target.value))}
        className="w-full min-w-0 rounded-xl border border-gray-800 bg-black/40 px-3 py-2.5 text-xs text-white sm:py-3 sm:text-sm"
      >
        {teams.map(team => (
          <option key={team.id} value={team.id}>{team.full_name}</option>
        ))}
      </select>
    </label>
  );
}

function GameSelect({ value, games, onChange }: { value: string; games: Game[]; onChange: (value: string) => void }) {
  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      disabled={games.length === 0}
      className="w-full min-w-0 rounded-xl border border-gray-800 bg-black/40 px-3 py-2.5 text-xs text-white disabled:opacity-60 sm:py-3 sm:text-sm"
    >
      {games.length === 0 && <option value="">No games available today</option>}
      {games.map(game => (
        <option key={game.game_id} value={game.game_id}>
          {game.away_team_abbreviation} @ {game.home_team_abbreviation} - {gameStatusInIndia(game)}
        </option>
      ))}
    </select>
  );
}

function ComparePlayers({ playerA, playerB, playerALogs, playerBLogs }: {
  playerA: Player | null;
  playerB: Player | null;
  playerALogs: PlayerGameLog[];
  playerBLogs: PlayerGameLog[];
}) {
  if (!playerA || !playerB) return <EmptyState text="Choose two players to compare." />;

  const aTrend = average(playerALogs.map(game => game.PTS));
  const bTrend = average(playerBLogs.map(game => game.PTS));
  const aEfficiency = playerEfficiency(playerA);
  const bEfficiency = playerEfficiency(playerB);
  const aUsage = playerUsageEstimate(playerA);
  const bUsage = playerUsageEstimate(playerB);
  const aClutch = clutchEstimate(playerA, aTrend);
  const bClutch = clutchEstimate(playerB, bTrend);

  return (
    <div className="mt-4 space-y-4 sm:mt-5 sm:space-y-5">
      <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_180px] lg:gap-4">
        <PlayerFace player={playerA} recentPpg={aTrend} />
        <div className="space-y-3">
          <MetricRow label="Points" a={playerA.PTS} b={playerB.PTS} />
          <MetricRow label="Rebounds" a={playerA.REB} b={playerB.REB} />
          <MetricRow label="Assists" a={playerA.AST} b={playerB.AST} />
          <MetricRow label="Efficiency" a={aEfficiency} b={bEfficiency} />
          <MetricRow label="Usage" a={aUsage} b={bUsage} suffix="%" />
          <MetricRow label="Clutch index" a={aClutch} b={bClutch} />
          <MetricRow label="Recent PPG" a={aTrend} b={bTrend} />
          <MetricRow label="3PT%" a={(playerA.FG3_PCT ?? 0) * 100} b={(playerB.FG3_PCT ?? 0) * 100} suffix="%" />
        </div>
        <PlayerFace player={playerB} align="right" recentPpg={bTrend} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <TrendCard title={`${playerName(playerA)} trend`} logs={playerALogs} />
        <TrendCard title={`${playerName(playerB)} trend`} logs={playerBLogs} />
      </div>
    </div>
  );
}

function PlayerFace({ player, align = 'left', recentPpg }: { player: Player; align?: 'left' | 'right'; recentPpg?: number }) {
  const playerId = player.PERSON_ID || player.PLAYER_ID || 0;
  const teamId = player.TEAM_ID || '';
  return (
    <div className={`min-w-0 rounded-xl border border-gray-800 bg-black/30 p-3 sm:p-4 ${align === 'right' ? 'text-right' : ''}`}>
      <img
        src={getPlayerHeadshotUrl(playerId)}
        alt={playerName(player)}
        onError={(e) => {
          e.currentTarget.src = teamId ? getTeamLogoUrl(teamId) : '/assets/images/nba-6.svg';
          e.currentTarget.classList.add('p-2', 'object-contain');
        }}
        className={`mb-3 h-16 w-16 rounded-full border border-gray-800 bg-gray-950 object-cover object-top sm:h-24 sm:w-24 ${align === 'right' ? 'ml-auto' : ''}`}
      />
      <div className="truncate font-black text-white">{playerName(player)}</div>
      <div className="text-xs text-gray-400">{player.TEAM_ABBREVIATION || 'NBA'}</div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <TinyStat label="FG" value={`${(((player.FG_PCT ?? 0) * 100) || 0).toFixed(1)}%`} />
        <TinyStat label="Recent" value={recentPpg ? recentPpg.toFixed(1) : '-'} />
      </div>
    </div>
  );
}

function CompareTeams({ teamA, teamB, teamALogs, teamBLogs, teamARoster, teamBRoster }: {
  teamA: TeamOption | null;
  teamB: TeamOption | null;
  teamALogs: TeamGame[];
  teamBLogs: TeamGame[];
  teamARoster: Player[];
  teamBRoster: Player[];
  standings: Standing[];
}) {
  if (!teamA || !teamB) return <EmptyState text="Choose two teams to compare." />;

  const aProfile = teamProfile(teamA, teamALogs, teamARoster);
  const bProfile = teamProfile(teamB, teamBLogs, teamBRoster);

  return (
    <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <TeamMiniCard team={teamA} profile={aProfile} />
        <TeamMiniCard team={teamB} profile={bProfile} />
      </div>
      <MetricRow label="Wins" a={teamA.wins ?? 0} b={teamB.wins ?? 0} />
      <MetricRow label="Win pct" a={(teamA.winPct ?? 0) * 100} b={(teamB.winPct ?? 0) * 100} suffix="%" />
      <MetricRow label="Off rating" a={aProfile.offRating} b={bProfile.offRating} />
      <MetricRow label="Def rating" a={aProfile.defRating} b={bProfile.defRating} />
      <MetricRow label="Pace" a={aProfile.pace} b={bProfile.pace} />
      <MetricRow label="Recent form" a={aProfile.formScore} b={bProfile.formScore} />
      <MetricRow label="Playoff odds" a={aProfile.playoffOdds} b={bProfile.playoffOdds} suffix="%" />
      <div className="grid gap-2 md:grid-cols-2 md:gap-3">
        <TeamDetailList title={`${teamA.abbreviation} top scorers`} items={aProfile.topScorers} />
        <TeamDetailList title={`${teamB.abbreviation} top scorers`} items={bProfile.topScorers} />
      </div>
      <div className="grid gap-2 md:grid-cols-2 md:gap-3">
        <InfoStrip title={`${teamA.abbreviation} injuries`} value={aProfile.injuryNote} />
        <InfoStrip title={`${teamB.abbreviation} injuries`} value={bProfile.injuryNote} />
      </div>
    </div>
  );
}

function TeamMiniCard({ team, profile }: { team: TeamOption; profile: TeamProfile }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-800 bg-black/30 p-3 sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <img src={getTeamLogoUrl(team.id)} alt={team.full_name} onError={(e) => { e.currentTarget.src = '/assets/images/nba-6.svg'; }} className="h-9 w-9 object-contain sm:h-12 sm:w-12" />
        <div className="min-w-0">
          <div className="truncate font-black text-white">{team.full_name}</div>
          <div className="truncate text-xs text-gray-400">{team.conference || team.state || 'NBA'} - {team.l10 || 'L10 unavailable'}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center sm:mt-4 sm:gap-2">
        <TinyStat label="Record" value={`${team.wins ?? 0}-${team.losses ?? 0}`} />
        <TinyStat label="Streak" value={team.streak || '-'} />
        <TinyStat label="PPG" value={profile.ppg ? profile.ppg.toFixed(1) : '-'} />
      </div>
    </div>
  );
}

function MetricRow({ label, a, b, suffix = '' }: { label: string; a: number; b: number; suffix?: string }) {
  const total = Math.max(Math.abs(a) + Math.abs(b), 1);
  const aWidth = Math.max(8, Math.min(92, (Math.abs(a) / total) * 100));
  const bWidth = Math.max(8, Math.min(92, (Math.abs(b) / total) * 100));

  return (
    <div>
      <div className="mb-1 grid grid-cols-[64px_minmax(0,1fr)_64px] items-center gap-2 text-xs sm:grid-cols-[80px_minmax(0,1fr)_80px] sm:gap-3 sm:text-sm">
        <span className="truncate font-black text-white">{formatMetric(a, suffix)}</span>
        <span className="truncate text-center text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 sm:text-xs sm:tracking-[0.16em]">{label}</span>
        <span className="truncate text-right font-black text-white">{formatMetric(b, suffix)}</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div className="flex justify-end rounded-full bg-gray-950">
          <div className="h-2 rounded-full bg-orange-500" style={{ width: `${aWidth}%` }} />
        </div>
        <div className="rounded-full bg-gray-950">
          <div className="h-2 rounded-full bg-blue-500" style={{ width: `${bWidth}%` }} />
        </div>
      </div>
    </div>
  );
}

function ProbabilityChart({ data }: { data: number[] }) {
  const points = data.map((value, index) => {
    const x = (index / Math.max(data.length - 1, 1)) * 100;
    const y = 100 - value;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="min-w-0 rounded-xl border border-gray-800 bg-black/30 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
        <span>Away control</span>
        <span>Home win probability</span>
      </div>
      <svg viewBox="0 0 100 100" className="h-24 w-full overflow-hidden sm:h-40" preserveAspectRatio="none">
        <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(148,163,184,0.25)" strokeDasharray="4 4" />
        <polyline points={points} fill="none" stroke="#f97316" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function TeamWinBlock({ game, side, probability }: { game: Game; side: 'home' | 'away'; probability: number }) {
  const teamId = side === 'home' ? game.home_team_id : game.away_team_id;
  const abbr = side === 'home' ? game.home_team_abbreviation : game.away_team_abbreviation;

  return (
    <div className="min-w-0 rounded-xl border border-gray-800 bg-black/30 p-2 text-center sm:p-4">
      <img src={getTeamLogoUrl(teamId)} alt={abbr || 'Team'} onError={(e) => { e.currentTarget.src = '/assets/images/nba-6.svg'; }} className="mx-auto h-8 w-8 object-contain sm:h-12 sm:w-12" />
      <div className="mt-2 text-sm font-black text-white">{abbr}</div>
      <div className="mt-1 text-lg font-black text-orange-400 sm:text-3xl">{probability.toFixed(0)}%</div>
    </div>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-800 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-orange-400 hover:border-orange-500/50 hover:bg-orange-500/10 sm:mt-4 sm:w-auto"
    >
      <Plus size={14} />
      Add to watchlist
    </button>
  );
}

function TinyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-gray-950/80 p-1.5 sm:p-2">
      <div className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">{label}</div>
      <div className="mt-1 truncate text-xs font-black text-white sm:text-base">{value}</div>
    </div>
  );
}

function TrendCard({ title, logs }: { title: string; logs: PlayerGameLog[] }) {
  const points = logs.map(game => game.PTS).reverse();
  const recent = average(logs.map(game => game.PTS));
  const high = Math.max(...points, 0);

  return (
    <div className="min-w-0 rounded-xl border border-gray-800 bg-black/30 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0 truncate text-sm font-black text-white">{title}</div>
        <div className="shrink-0 text-xs font-bold uppercase tracking-[0.16em] text-orange-400">{recent ? `${recent.toFixed(1)} PPG` : 'No logs'}</div>
      </div>
      <div className="flex h-14 items-end gap-1 sm:h-20">
        {points.length ? points.map((value, index) => (
          <div key={`${value}-${index}`} className="flex-1 rounded-t bg-orange-500/70" style={{ height: `${Math.max(10, (value / Math.max(high, 1)) * 100)}%` }} />
        )) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">Recent game logs unavailable</div>
        )}
      </div>
    </div>
  );
}

function TeamDetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-800 bg-black/30 p-3 sm:p-4">
      <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-gray-500">{title}</div>
      <div className="space-y-2">
        {items.length ? items.map(item => (
          <div key={item} className="truncate rounded-lg bg-gray-950/80 px-3 py-2 text-sm font-semibold text-white">{item}</div>
        )) : (
          <div className="text-sm text-gray-500">Roster scoring data unavailable</div>
        )}
      </div>
    </div>
  );
}

function InfoStrip({ title, value }: { title: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-800 bg-black/30 p-3 sm:p-4">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-gray-500">{title}</div>
      <div className="mt-2 break-words text-sm text-gray-300">{value}</div>
    </div>
  );
}

function WatchlistSummary({ watchlist, games, players, teams }: {
  watchlist: WatchItem[];
  games: Game[];
  players: Player[];
  teams: TeamOption[];
}) {
  if (!watchlist.length) return null;

  const watchedTeamIds = new Set(watchlist.filter(item => item.type === 'Team').map(item => Number(item.id.replace('team-', ''))));
  const watchedPlayerIds = new Set(watchlist.filter(item => item.type === 'Player').map(item => Number(item.id.replace('player-', ''))));
  const watchedGames = games.filter(game => (
    watchedTeamIds.has(game.home_team_id) ||
    watchedTeamIds.has(game.away_team_id) ||
    watchlist.some(item => item.id === `game-${game.game_id}`)
  ));
  const watchedPlayers = players.filter(player => watchedPlayerIds.has(player.PERSON_ID));
  const watchedTeams = teams.filter(team => watchedTeamIds.has(team.id));
  const alerts = [
    ...watchedGames.filter(game => game.status === 'live').map(game => `${game.away_team_abbreviation} @ ${game.home_team_abbreviation} is live`),
    ...watchedGames.filter(game => game.status === 'scheduled').map(game => `${game.away_team_abbreviation} @ ${game.home_team_abbreviation} tips at ${gameStatusInIndia(game)}`),
    ...watchedPlayers.filter(player => player.PTS >= 25).map(player => `${playerName(player)} is a high-scoring watch at ${player.PTS.toFixed(1)} PPG`),
  ].slice(0, 5);

  return (
    <div className="mb-5 grid gap-3 lg:grid-cols-3">
      <InfoStrip title="Your games" value={watchedGames.length ? watchedGames.map(game => `${game.away_team_abbreviation} @ ${game.home_team_abbreviation}`).join(', ') : 'No watched teams play on the current board.'} />
      <InfoStrip title="Your stats" value={[...watchedPlayers.map(player => `${playerName(player)} ${player.PTS.toFixed(1)} PPG`), ...watchedTeams.map(team => `${team.abbreviation} ${team.wins ?? 0}-${team.losses ?? 0}`)].slice(0, 4).join(' | ') || 'Add players or teams to see quick stats.'} />
      <InfoStrip title="Alerts and news" value={alerts.length ? alerts.join(' | ') : 'No urgent alerts. News feed integration is ready for a future API source.'} />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-800 bg-black/20 p-6 text-center text-sm text-gray-400">
      {text}
    </div>
  );
}

function buildWinModel(game: Game) {
  const awayPeriods = game.away_period_scores?.length ? game.away_period_scores : spreadScore(game.away_score);
  const homePeriods = game.home_period_scores?.length ? game.home_period_scores : spreadScore(game.home_score);
  let away = 0;
  let home = 0;
  const series = [50];

  const length = Math.max(awayPeriods.length, homePeriods.length, 4);
  for (let i = 0; i < length; i++) {
    away += awayPeriods[i] ?? 0;
    home += homePeriods[i] ?? 0;
    series.push(homeWinProbability(home - away, i + 1, game.status));
  }

  const current = homeWinProbability(game.home_score - game.away_score, game.quarter || length, game.status);
  if (series[series.length - 1] !== current) series.push(current);

  return {
    homeProbability: current,
    series,
  };
}

function homeWinProbability(diff: number, period: number, status: Game['status']) {
  if (status === 'final') return diff > 0 ? 100 : diff < 0 ? 0 : 50;
  const urgency = Math.min(Math.max(period, 1), 4) / 4;
  return clamp(50 + diff * (1.25 + urgency) + 3, 3, 97);
}

function teamProfile(team: TeamOption, logs: TeamGame[], roster: Player[]): TeamProfile {
  const ppg = average(logs.map(game => game.PTS));
  const oppPpg = average(logs.map(game => game.OPP_PTS ?? Math.max(0, game.PTS - (game.PLUS_MINUS ?? 0))));
  const possessions = logs.map(game => {
    const fga = game.FGA ?? 88;
    const fta = game.FTA ?? 22;
    const tov = game.TOV ?? 13;
    return fga + 0.44 * fta + tov;
  });
  const pace = average(possessions) || 98;
  const offRating = ppg ? (ppg / pace) * 100 : ratingFromRecord(team, 113);
  const defRating = oppPpg ? (oppPpg / pace) * 100 : ratingFromRecord(team, 112, true);
  const recentWins = logs.filter(game => game.WL === 'W').length;
  const formScore = logs.length ? (recentWins / logs.length) * 100 : (team.winPct ?? 0.5) * 100;
  const playoffOdds = clamp(((team.winPct ?? 0.5) * 72) + (formScore * 0.22) + streakBoost(team.streak), 3, 98);
  const topScorers = [...roster]
    .filter(player => Number.isFinite(player.PTS))
    .sort((a, b) => (b.PTS ?? 0) - (a.PTS ?? 0))
    .slice(0, 3)
    .map(player => `${playerName(player)} - ${(player.PTS ?? 0).toFixed(1)} PPG`);

  return {
    ppg,
    oppPpg,
    offRating,
    defRating,
    pace,
    formScore,
    playoffOdds,
    topScorers,
    injuryNote: 'No official injury feed is connected yet. Add an injury API to show return dates and rotation impact here.',
  };
}

function playerEfficiency(player: Player) {
  const fg = (player.FG_PCT ?? 0) * 100;
  const three = (player.FG3_PCT ?? 0) * 100;
  const ft = (player.FT_PCT ?? 0) * 100;
  return (fg * 0.5) + (three * 0.25) + (ft * 0.25);
}

function playerUsageEstimate(player: Player) {
  return clamp((player.PTS * 0.72) + (player.AST * 1.8) + ((player.REB ?? 0) * 0.35), 8, 38);
}

function clutchEstimate(player: Player, recentPpg: number) {
  return clamp((player.PTS * 1.1) + (player.AST * 1.6) + ((player.STL ?? 0) * 3) + ((player.BLK ?? 0) * 2) + Math.max(0, recentPpg - player.PTS), 1, 100);
}

function ratingFromRecord(team: TeamOption, baseline: number, defense = false) {
  const winPct = team.winPct ?? 0.5;
  const swing = (winPct - 0.5) * 12;
  return defense ? baseline - swing : baseline + swing;
}

function streakBoost(streak?: string) {
  if (!streak) return 0;
  const amount = Number(streak.replace(/\D/g, '')) || 0;
  return streak.toUpperCase().startsWith('W') ? Math.min(amount * 2, 10) : -Math.min(amount * 2, 10);
}

function buildRecap(game: Game, box: BoxScorePlayer[], pbp: PlayByPlay[]) {
  const sorted = [...box].sort((a, b) => (b.PTS ?? 0) - (a.PTS ?? 0));
  const top = sorted[0];
  const second = sorted[1];
  const margin = Math.abs(game.home_score - game.away_score);
  const winner = game.home_score > game.away_score ? game.home_team_abbreviation : game.away_team_abbreviation;
  const status = game.status === 'final' ? 'finished' : game.status === 'live' ? 'is live' : 'is scheduled';
  const event = pbp.find(play => play.HOMEDESCRIPTION || play.VISITORDESCRIPTION || play.NEUTRALDESCRIPTION);
  const eventText = event ? (event.HOMEDESCRIPTION || event.VISITORDESCRIPTION || event.NEUTRALDESCRIPTION) : '';

  if (game.status === 'scheduled') {
    return `${game.away_team_abbreviation} visit ${game.home_team_abbreviation}. The watch points are pace, early shot quality, and whether either bench creates a first-half run.`;
  }

  const leaderText = top
    ? `${top.PLAYER_NAME} set the tone with ${top.PTS ?? 0} points, ${top.REB ?? 0} rebounds, and ${top.AST ?? 0} assists`
    : 'The box score leaders are still loading';
  const supportText = second ? ` ${second.PLAYER_NAME} added ${second.PTS ?? 0} points as the next scoring option.` : '';
  const gameText = game.status === 'final'
    ? `${winner} closed out a ${margin}-point result, ${game.away_score}-${game.home_score}.`
    : `The game ${status} at ${game.away_score}-${game.home_score}, with the win model leaning toward the current leader.`;
  const momentText = eventText ? ` Latest key note: ${eventText}.` : '';

  return `${gameText} ${leaderText}.${supportText}${momentText}`;
}

function playerName(player: Player) {
  return player.PLAYER_NAME || [player.PLAYER_FIRST_NAME, player.PLAYER_LAST_NAME].filter(Boolean).join(' ') || 'NBA Player';
}

function formatMetric(value: number, suffix: string) {
  const display = suffix ? value.toFixed(1) : value.toFixed(value % 1 === 0 ? 0 : 1);
  return `${display}${suffix}`;
}

function average(values: number[]) {
  const valid = values.filter(value => Number.isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function spreadScore(score: number) {
  if (!score) return [0, 0, 0, 0];
  const base = Math.floor(score / 4);
  return [base, base, base, score - base * 3];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readWatchlist() {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) as WatchItem[] : [];
  } catch {
    return [];
  }
}

function fallbackPlayers(): Player[] {
  return mockPlayers.map((player, index) => ({
    PERSON_ID: 100000 + index,
    PLAYER_NAME: player.name,
    TEAM_ID: index,
    TEAM_ABBREVIATION: player.team_id,
    PTS: player.ppg,
    REB: player.rpg,
    AST: player.apg,
    STL: player.spg,
    BLK: player.bpg,
    FG_PCT: player.fg_pct,
    FG3_PCT: player.three_pct,
    FT_PCT: player.ft_pct,
  }));
}

function fallbackTeams(): NbaTeam[] {
  return mockTeams.map((team, index) => ({
    id: 200000 + index,
    full_name: team.name,
    abbreviation: team.abbreviation,
    nickname: team.name.replace(`${team.name.split(' ')[0]} `, ''),
    city: team.name.split(' ')[0],
  }));
}
