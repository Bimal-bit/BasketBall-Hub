import { useEffect, useMemo, useState } from 'react';
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
  getNBADate,
  getPlayerHeadshotUrl,
  getTeamLogoUrl,
  nbaApi,
  type Game,
  type BoxScorePlayer,
  type NbaTeam,
  type Player,
  type PlayByPlay,
  type Standing,
  type TeamGame,
} from '../lib/api';
import { mockPlayers, mockTeams } from '../lib/mockData';

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
  const [watchlist, setWatchlist] = useState<WatchItem[]>(() => readWatchlist());
  const [recap, setRecap] = useState('');
  const [recapLoading, setRecapLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [playerResult, teamResult, standingResult, gameResult] = await Promise.allSettled([
        nbaApi.getTopPlayers(),
        nbaApi.getTeams(),
        nbaApi.getStandings(),
        nbaApi.getScoreboard(getNBADate()),
      ]);

      if (cancelled) return;

      const apiPlayers = playerResult.status === 'fulfilled' ? playerResult.value : fallbackPlayers();
      const apiStandings = standingResult.status === 'fulfilled' ? standingResult.value : [];
      const apiTeams = teamResult.status === 'fulfilled' ? teamResult.value : fallbackTeams();
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
      setPlayerAId(apiPlayers[0]?.PERSON_ID ?? null);
      setPlayerBId(apiPlayers[1]?.PERSON_ID ?? null);
      setTeamAId(enrichedTeams[0]?.id ?? null);
      setTeamBId(enrichedTeams[1]?.id ?? null);
      setGameId(apiGames[0]?.game_id ?? '');
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-orange-500">
            <BrainCircuit size={16} />
            Insights Lab
          </div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white sm:text-4xl">
            Compare, predict, recap, and follow
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            A single workspace for player matchups, team scouting, live win probability, AI-style recaps, and your personal NBA watchlist.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-orange-400 hover:border-orange-500/50 hover:bg-orange-500/10"
        >
          <RefreshCw size={15} />
          Refresh Lab
        </button>
      </div>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Player Comparison" icon={<Users size={18} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <PlayerSelect label="Player A" value={playerAId} players={players} onChange={setPlayerAId} />
            <PlayerSelect label="Player B" value={playerBId} players={players} onChange={setPlayerBId} />
          </div>
          <ComparePlayers playerA={playerA} playerB={playerB} />
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
          <CompareTeams teamA={teamA} teamB={teamB} teamALogs={teamALogs} teamBLogs={teamBLogs} standings={standings} />
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

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Win Probability Graph" icon={<Sparkles size={18} />}>
          <GameSelect value={gameId} games={games} onChange={setGameId} />
          {selectedGame && winModel ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <TeamWinBlock game={selectedGame} side="away" probability={100 - winModel.homeProbability} />
                <div className="rounded-xl border border-gray-800 bg-black/30 p-4 text-center">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">{selectedGame.status}</div>
                  <div className="mt-2 text-3xl font-black text-white">{selectedGame.away_score}-{selectedGame.home_score}</div>
                  <div className="mt-1 text-xs text-gray-400">{selectedGame.status_text || 'Game status'}</div>
                </div>
                <TeamWinBlock game={selectedGame} side="home" probability={winModel.homeProbability} />
              </div>
              <ProbabilityChart data={winModel.series} />
              <button
                onClick={() => addWatch({
                  id: `game-${selectedGame.game_id}`,
                  type: 'Game',
                  label: `${selectedGame.away_team_abbreviation} @ ${selectedGame.home_team_abbreviation}`,
                  sub: `${selectedGame.away_score}-${selectedGame.home_score} ${selectedGame.status_text || selectedGame.status}`,
                })}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-800 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-orange-400 hover:border-orange-500/50 hover:bg-orange-500/10"
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
          <div className="mt-4 rounded-xl border border-gray-800 bg-black/30 p-4 text-sm leading-6 text-gray-300">
            {recap || 'Choose a game and generate a recap to summarize leaders, score flow, and the most important notes.'}
          </div>
        </Panel>
      </section>

      <Panel title="Personal Watchlist" icon={<Star size={18} />}>
        {watchlist.length === 0 ? (
          <EmptyState text="Add players, teams, or games from the panels above. Your watchlist is saved in this browser." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {watchlist.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">{item.type}</div>
                  <div className="mt-1 font-bold text-white">{item.label}</div>
                  <div className="text-xs text-gray-400">{item.sub}</div>
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
    <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 shadow-2xl shadow-black/10">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">{icon}</div>
        <h2 className="text-lg font-black uppercase italic tracking-tight text-white">{title}</h2>
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
        className="w-full rounded-xl border border-gray-800 bg-black/40 px-3 py-3 text-sm text-white"
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
        className="w-full rounded-xl border border-gray-800 bg-black/40 px-3 py-3 text-sm text-white"
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
      className="w-full rounded-xl border border-gray-800 bg-black/40 px-3 py-3 text-sm text-white"
    >
      {games.map(game => (
        <option key={game.game_id} value={game.game_id}>
          {game.away_team_abbreviation} @ {game.home_team_abbreviation} - {game.status_text || game.status}
        </option>
      ))}
    </select>
  );
}

function ComparePlayers({ playerA, playerB }: { playerA: Player | null; playerB: Player | null }) {
  if (!playerA || !playerB) return <EmptyState text="Choose two players to compare." />;

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[180px_1fr_180px]">
      <PlayerFace player={playerA} />
      <div className="space-y-3">
        <MetricRow label="Points" a={playerA.PTS} b={playerB.PTS} />
        <MetricRow label="Rebounds" a={playerA.REB} b={playerB.REB} />
        <MetricRow label="Assists" a={playerA.AST} b={playerB.AST} />
        <MetricRow label="Steals" a={playerA.STL ?? 0} b={playerB.STL ?? 0} />
        <MetricRow label="Blocks" a={playerA.BLK ?? 0} b={playerB.BLK ?? 0} />
        <MetricRow label="FG%" a={(playerA.FG_PCT ?? 0) * 100} b={(playerB.FG_PCT ?? 0) * 100} suffix="%" />
      </div>
      <PlayerFace player={playerB} align="right" />
    </div>
  );
}

function PlayerFace({ player, align = 'left' }: { player: Player; align?: 'left' | 'right' }) {
  return (
    <div className={`rounded-xl border border-gray-800 bg-black/30 p-4 ${align === 'right' ? 'text-right' : ''}`}>
      <img
        src={getPlayerHeadshotUrl(player.PERSON_ID)}
        alt={playerName(player)}
        className={`mb-3 h-24 w-24 rounded-full border border-gray-800 bg-gray-950 object-cover object-top ${align === 'right' ? 'ml-auto' : ''}`}
      />
      <div className="font-black text-white">{playerName(player)}</div>
      <div className="text-xs text-gray-400">{player.TEAM_ABBREVIATION || 'NBA'}</div>
    </div>
  );
}

function CompareTeams({ teamA, teamB, teamALogs, teamBLogs }: {
  teamA: TeamOption | null;
  teamB: TeamOption | null;
  teamALogs: TeamGame[];
  teamBLogs: TeamGame[];
  standings: Standing[];
}) {
  if (!teamA || !teamB) return <EmptyState text="Choose two teams to compare." />;

  const aRecent = average(teamALogs.map(game => game.PTS));
  const bRecent = average(teamBLogs.map(game => game.PTS));

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TeamMiniCard team={teamA} recentPpg={aRecent} />
        <TeamMiniCard team={teamB} recentPpg={bRecent} />
      </div>
      <MetricRow label="Wins" a={teamA.wins ?? 0} b={teamB.wins ?? 0} />
      <MetricRow label="Win pct" a={(teamA.winPct ?? 0) * 100} b={(teamB.winPct ?? 0) * 100} suffix="%" />
      <MetricRow label="Recent PPG" a={aRecent} b={bRecent} />
    </div>
  );
}

function TeamMiniCard({ team, recentPpg }: { team: TeamOption; recentPpg: number }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-black/30 p-4">
      <div className="flex items-center gap-3">
        <img src={getTeamLogoUrl(team.id)} alt={team.full_name} className="h-12 w-12 object-contain" />
        <div>
          <div className="font-black text-white">{team.full_name}</div>
          <div className="text-xs text-gray-400">{team.conference || team.state || 'NBA'} - {team.l10 || 'L10 unavailable'}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <TinyStat label="Record" value={`${team.wins ?? 0}-${team.losses ?? 0}`} />
        <TinyStat label="Streak" value={team.streak || '-'} />
        <TinyStat label="PPG" value={recentPpg ? recentPpg.toFixed(1) : '-'} />
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
      <div className="mb-1 grid grid-cols-[80px_1fr_80px] items-center gap-3 text-sm">
        <span className="font-black text-white">{formatMetric(a, suffix)}</span>
        <span className="text-center text-xs font-bold uppercase tracking-[0.16em] text-gray-500">{label}</span>
        <span className="text-right font-black text-white">{formatMetric(b, suffix)}</span>
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
    <div className="rounded-xl border border-gray-800 bg-black/30 p-4">
      <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
        <span>Away control</span>
        <span>Home win probability</span>
      </div>
      <svg viewBox="0 0 100 100" className="h-40 w-full overflow-visible" preserveAspectRatio="none">
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
    <div className="rounded-xl border border-gray-800 bg-black/30 p-4 text-center">
      <img src={getTeamLogoUrl(teamId)} alt={abbr || 'Team'} className="mx-auto h-12 w-12 object-contain" />
      <div className="mt-2 text-sm font-black text-white">{abbr}</div>
      <div className="mt-1 text-3xl font-black text-orange-400">{probability.toFixed(0)}%</div>
    </div>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gray-800 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-orange-400 hover:border-orange-500/50 hover:bg-orange-500/10"
    >
      <Plus size={14} />
      Add to watchlist
    </button>
  );
}

function TinyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-950/80 p-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">{label}</div>
      <div className="mt-1 font-black text-white">{value}</div>
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
