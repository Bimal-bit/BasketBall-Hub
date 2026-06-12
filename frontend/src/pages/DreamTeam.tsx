import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Dice5,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  User,
  X,
} from 'lucide-react';
import {
  nbaApi,
  getPlayerHeadshotUrl,
  getPlayerId,
  getPlayerName,
} from '../lib/api';
import BasketballLoader from '../components/BasketballLoader';

type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
type TeamKey = 'A' | 'B';
type ActivePick = { team: TeamKey; position: Position };

type PrimeStats = {
  season: string;
  gp: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgPct: number;
  fg3Pct: number;
  ftPct: number;
  estimated?: boolean;
};

type DreamPlayer = {
  id: number;
  name: string;
  position: Position;
  teamAbbr: string;
  teamId: number;
  prime: PrimeStats;
};

type TeamRoster = Record<Position, DreamPlayer | null>;

type PlayerLine = {
  player: DreamPlayer;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  plusMinus: number;
};

type SimulationResult = {
  scoreA: number;
  scoreB: number;
  winner: TeamKey | 'OT';
  pace: number;
  teamA: PlayerLine[];
  teamB: PlayerLine[];
  notes: string[];
};

const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
const TEAM_LABELS: Record<TeamKey, string> = { A: 'Team A', B: 'Team B' };
const STORAGE_KEY = 'nba_dream_team_matchup_v2';

const emptyRoster = (): TeamRoster => ({
  PG: null,
  SG: null,
  SF: null,
  PF: null,
  C: null,
});

const fallbackPrime = (player: any, position: Position): PrimeStats => {
  const pts = numberFrom(player.PTS, player.pts, position === 'C' ? 18 : 20);
  const reb = numberFrom(player.REB, player.reb, position === 'C' || position === 'PF' ? 9 : 5);
  const ast = numberFrom(player.AST, player.ast, position === 'PG' ? 7 : 3);
  const stl = numberFrom(player.STL, player.stl, 1.1);
  const blk = numberFrom(player.BLK, player.blk, position === 'C' ? 1.6 : 0.6);

  return {
    season: 'Prime',
    gp: numberFrom(player.GP, 72),
    min: numberFrom(player.MIN, 34),
    pts,
    reb,
    ast,
    stl,
    blk,
    tov: numberFrom(player.TOV, Math.max(1.2, ast * 0.32)),
    fgPct: numberFrom(player.FG_PCT, 0.47),
    fg3Pct: numberFrom(player.FG3_PCT, 0.35),
    ftPct: numberFrom(player.FT_PCT, 0.78),
    estimated: true,
  };
};

export default function DreamTeam() {
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [activePick, setActivePick] = useState<ActivePick | null>(null);
  const [loadingPrimeId, setLoadingPrimeId] = useState<number | null>(null);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [rosters, setRosters] = useState<Record<TeamKey, TeamRoster>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : { A: emptyRoster(), B: emptyRoster() };
    } catch {
      return { A: emptyRoster(), B: emptyRoster() };
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rosters));
  }, [rosters]);

  useEffect(() => {
    Promise.all([
      nbaApi.getAllPlayers().catch(() => []),
      nbaApi.getTopPlayers().catch(() => []),
    ])
      .then(([players, leaders]) => {
        setAllPlayers(Array.isArray(players) ? players : []);
        setTopPlayers(Array.isArray(leaders) ? leaders : []);
      })
      .finally(() => setLoadingList(false));
  }, []);

  const selectedIds = useMemo(() => {
    const ids = new Set<number>();
    (['A', 'B'] as TeamKey[]).forEach(team => {
      POSITIONS.forEach(position => {
        const player = rosters[team][position];
        if (player) ids.add(player.id);
      });
    });
    return ids;
  }, [rosters]);

  const filteredPlayers = useMemo(() => {
    if (!search.trim()) return [];
    const s = search.toLowerCase();
    return allPlayers
      .filter(player => {
        const id = getPlayerId(player);
        const name = getPlayerName(player).toLowerCase();
        return id > 0 && name.includes(s) && !selectedIds.has(id);
      })
      .slice(0, 10);
  }, [allPlayers, search, selectedIds]);

  const teamScores = useMemo(() => ({
    A: rateTeam(Object.values(rosters.A).filter(Boolean) as DreamPlayer[]),
    B: rateTeam(Object.values(rosters.B).filter(Boolean) as DreamPlayer[]),
  }), [rosters]);

  const complete = POSITIONS.every(position => rosters.A[position] && rosters.B[position]);
  const nextPick = getNextPick(rosters);

  async function handleAddPlayer(player: any, pickOverride?: ActivePick) {
    const pick = pickOverride || activePick;
    if (!pick) return;
    const id = getPlayerId(player);
    if (!id) return;

    setLoadingPrimeId(id);
    try {
      const dreamPlayer = await buildDreamPlayer(player, pick.position);
      setRosters(prev => ({
        ...prev,
        [pick.team]: {
          ...prev[pick.team],
          [pick.position]: dreamPlayer,
        },
      }));
      setSimResult(null);
      setActivePick(null);
      setSearch('');
    } finally {
      setLoadingPrimeId(null);
    }
  }

  async function buildDreamPlayer(player: any, position: Position): Promise<DreamPlayer> {
    const id = getPlayerId(player);
    const profile = await nbaApi.getPlayerProfile(id).catch(() => null);
    const prime = await getPrimeSeason(id, profile, player, position);

    return {
      id,
      name: getPlayerName(player),
      position,
      teamAbbr: player.team_abbreviation || player.TEAM_ABBREVIATION || 'NBA',
      teamId: Number(player.TEAM_ID || player.team_id || 0),
      prime,
    };
  }

  async function getPrimeSeason(playerId: number, profile: any, player: any, position: Position): Promise<PrimeStats> {
    const seasons = Array.isArray(profile?.seasons) ? profile.seasons : [];
    const candidates = seasons.length > 0 ? pickPrimeCandidateSeasons(seasons) : [];

    const seasonStats = await Promise.all(
      candidates.map(async (season: string) => {
        const avg = await nbaApi.getPlayerAverages(playerId, season).catch(() => null);
        return normalizePrime(avg, season);
      })
    );

    const best = seasonStats
      .filter(Boolean)
      .sort((a, b) => primeScore(b as PrimeStats) - primeScore(a as PrimeStats))[0] as PrimeStats | undefined;

    return best || fallbackPrime(player, position);
  }

  function removePlayer(team: TeamKey, position: Position) {
    setRosters(prev => ({
      ...prev,
      [team]: {
        ...prev[team],
        [position]: null,
      },
    }));
    setSimResult(null);
  }

  function clearRosters() {
    setRosters({ A: emptyRoster(), B: emptyRoster() });
    setSimResult(null);
  }

  async function randomizeTeams() {
    setLoadingList(true);
    try {
      // Prefer creating two lineups sourced from two different real team rosters
      const allRosters = await nbaApi.getAllTeamRosters().catch(() => ({}));
      const teamIds = Object.keys(allRosters || {});
      if (teamIds.length < 2) {
        // fallback: if rosters unavailable, try to fill from topPlayers
        const fallbackNext = { A: emptyRoster(), B: emptyRoster() };
        const used = new Set<number>();
        for (const teamKey of (['A', 'B'] as TeamKey[])) {
          for (const position of POSITIONS) {
            const candidate = pickRandomPlayer(topPlayers, used);
            if (candidate) {
              used.add(getPlayerId(candidate));
              try { fallbackNext[teamKey][position] = await buildDreamPlayer(candidate, position); } catch { /* ignore */ }
            }
          }
        }
        setRosters(fallbackNext);
        setSimResult(null);
        return;
      }

      // pick two distinct random teams
      let idxA = Math.floor(Math.random() * teamIds.length);
      let idxB = Math.floor(Math.random() * teamIds.length);
      let attempts = 0;
      while (idxB === idxA && attempts++ < 12) idxB = Math.floor(Math.random() * teamIds.length);
      const teamAId = teamIds[idxA];
      const teamBId = teamIds[idxB];

      const next = { A: emptyRoster(), B: emptyRoster() };

      // Helper: build roster for a single team id
      const buildForTeam = async (teamId: string, teamKey: TeamKey) => {
        const roster = Array.isArray(allRosters[teamId]) ? allRosters[teamId] : [];
        const used = new Set<number>();

        for (const position of POSITIONS) {
          let candidate: any = null;
          try {
            candidate = roster.find((p: any) => {
              const id = getPlayerId(p);
              const pos = (p.POSITION || p.position || '').toString().toUpperCase();
              if (id <= 0 || used.has(id)) return false;
              if (pos.includes(position)) return true;
              // guard for generic guards/forwards
              if ((position === 'PG' || position === 'SG') && pos.includes('G')) return true;
              if ((position === 'SF' || position === 'PF') && (pos.includes('F') || pos.includes('SF') || pos.includes('PF'))) return true;
              if (position === 'C' && pos.includes('C')) return true;
              return false;
            });
          } catch (e) {
            candidate = null;
          }

          if (!candidate) {
            const sorted = roster
              .filter((p: any) => !used.has(getPlayerId(p)) && getPlayerId(p) > 0)
              .sort((a: any, b: any) => (Number(b.PTS || b.pts || 0) - Number(a.PTS || a.pts || 0)));
            candidate = sorted[0];
          }

          // Ultimate fallback: pick from topPlayers across league
          if (!candidate) {
            const fallback = pickRandomPlayer(topPlayers, used) || pickRandomPlayer(allPlayers, used);
            candidate = fallback;
          }

          if (candidate) {
            const id = getPlayerId(candidate);
            used.add(id);
            try {
              next[teamKey][position] = await buildDreamPlayer(candidate, position);
            } catch (e) {
              // continue on error for robustness
            }
          }
        }
      };

      await Promise.all([
        buildForTeam(teamAId, 'A'),
        buildForTeam(teamBId, 'B'),
      ]);

      setRosters(next);
      setSimResult(null);
    } finally {
      setLoadingList(false);
    }
  }

  function autoAssignNext() {
    if (!nextPick) return;
    const used = new Set(selectedIds);
    const candidate = pickRandomPlayer(topPlayers, used);
    if (!candidate) return;
    handleAddPlayer(candidate, nextPick);
  }

  function simulateMatch() {
    if (!complete) return;
    setSimResult(simulate(rosters));
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col gap-5 border-b border-zinc-200 dark:border-zinc-800 border-[0.5px] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl sm:text-4xl font-medium text-white uppercase tracking-tighter">
            <Trophy className="text-orange-500" size={32} />
            Prime Dream Match
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Build two all-prime starting fives, alternate picks by position, then simulate a complete game with score, box score, and matchup notes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={autoAssignNext} disabled={!nextPick || loadingList} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs font-medium uppercase tracking-widest text-zinc-500 hover:border-orange-500 hover:text-orange-400 disabled:opacity-40">
            <Dice5 size={15} />
            Next Pick
          </button>
          <button onClick={randomizeTeams} disabled={loadingList || topPlayers.length < 10} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-medium uppercase tracking-widest text-white hover:bg-orange-500 disabled:opacity-40">
            <Bot size={15} />
            Random Teams
          </button>
          <button onClick={clearRosters} className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 px-4 py-2 text-xs font-medium uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white">
            <RefreshCw size={15} />
            Reset
          </button>
        </div>
      </div>

      {loadingList ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <BasketballLoader />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px_1fr]">
            <TeamPanel team="A" roster={rosters.A} score={teamScores.A} onPick={setActivePick} onRemove={removePlayer} />

            <div className="flex flex-col justify-center gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-white dark:bg-zinc-900 p-5">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
                  <Swords size={26} />
                </div>
                <div className="text-xs font-medium uppercase tracking-[0.32em] text-gray-500">Draft Order</div>
                <div className="mt-2 text-sm text-white">
                  {nextPick ? `${TEAM_LABELS[nextPick.team]} selects ${nextPick.position}` : 'Lineups ready'}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1">
                {POSITIONS.map(position => (
                  <div key={position} className="rounded-lg bg-zinc-100 px-2 py-2 text-center text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {position}
                  </div>
                ))}
              </div>

              <button
                onClick={simulateMatch}
                disabled={!complete}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium uppercase tracking-widest text-zinc-900 transition hover:bg-orange-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Sparkles size={16} />
                Simulate Game
              </button>

              {!complete && (
                <div className="flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs leading-relaxed text-yellow-300">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  Fill every position for both teams before simulation.
                </div>
              )}
            </div>

            <TeamPanel team="B" roster={rosters.B} score={teamScores.B} onPick={setActivePick} onRemove={removePlayer} />
          </div>

          <Diagnostics rosters={rosters} scores={teamScores} />

          {simResult && <SimulationPanel result={simResult} />}
        </>
      )}

      {activePick && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto bg-white/95 p-4 backdrop-blur dark:bg-zinc-950/95">
          <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <button
              onClick={() => { setActivePick(null); setSearch(''); }}
              className="absolute right-4 top-4 text-gray-500 transition-colors hover:text-white"
              aria-label="Close player search"
            >
              <X size={20} />
            </button>

            <div className="pr-10">
              <div className="text-xs font-medium uppercase tracking-[0.28em] text-orange-500">
                {TEAM_LABELS[activePick.team]} pick
              </div>
              <h3 className="mt-1 text-xl font-medium uppercase tracking-tight text-white">
                Assign {activePick.position}
              </h3>
            </div>

            <label className="relative mt-5 block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                autoFocus
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search player name..."
                className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm text-zinc-900 outline-none focus:border-orange-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
              />
            </label>

            <div className="mt-4 min-h-[180px] flex-1 space-y-2 overflow-y-auto pr-1">
              {filteredPlayers.map(player => {
                const id = getPlayerId(player);
                return (
                  <button
                    key={id}
                    onClick={() => handleAddPlayer(player)}
                    disabled={loadingPrimeId !== null}
                    className="group flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white p-2.5 text-left transition hover:border-orange-500/40 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800"
                  >
                    <img
                      src={getPlayerHeadshotUrl(id)}
                      className="h-11 w-11 rounded-full bg-white object-cover"
                      alt=""
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zinc-900 group-hover:text-orange-500 dark:text-white">
                        {getPlayerName(player)}
                      </div>
                      <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
                        Prime season lookup
                      </div>
                    </div>
                    {loadingPrimeId === id && <RefreshCw size={16} className="animate-spin text-orange-500" />}
                  </button>
                );
              })}

              {search.trim() && filteredPlayers.length === 0 && (
                <div className="py-12 text-center text-xs font-medium uppercase tracking-widest text-gray-500">
                  No matching players found
                </div>
              )}

              {!search.trim() && (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-xs text-gray-500">
                  <User size={28} className="opacity-30" />
                  Search a player, then the app will use his best available season.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamPanel({ team, roster, score, onPick, onRemove }: {
  team: TeamKey;
  roster: TeamRoster;
  score: ReturnType<typeof rateTeam>;
  onPick: (pick: ActivePick) => void;
  onRemove: (team: TeamKey, position: Position) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-medium uppercase tracking-tight text-white">{TEAM_LABELS[team]}</h3>
          <p className="text-xs text-gray-500">Prime rating {score.overall}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <TinyGrade label="OFF" value={score.offense} />
          <TinyGrade label="DEF" value={score.defense} />
          <TinyGrade label="FIT" value={score.fit} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5 xl:grid-cols-1">
        {POSITIONS.map(position => {
          const player = roster[position];
          return player && player.prime ? (
            <div key={position} className="group relative flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 transition hover:border-orange-500/50 dark:border-zinc-800 dark:bg-zinc-900">
              <button
                onClick={() => onRemove(team, position)}
                className="absolute right-2 top-2 rounded-md p-1 text-gray-500 transition hover:bg-red-500/10 hover:text-red-400"
                aria-label={`Remove ${player.name}`}
              >
                <Trash2 size={14} />
              </button>
              <img src={getPlayerHeadshotUrl(player.id)} alt="" className="h-16 w-16 rounded-xl bg-white object-cover" />
              <div className="min-w-0 flex-1 pr-6">
                <div className="text-[10px] font-medium uppercase tracking-widest text-orange-500">{position} / {player.prime.season}{player.prime.estimated ? ' (estimated)' : ''}</div>
                <div className="truncate text-sm font-medium uppercase text-zinc-900 dark:text-white">{player.name}</div>
                <div className="mt-1 grid grid-cols-3 gap-1 text-[10px] text-gray-500">
                  <span>{player.prime.pts || 0} PTS</span>
                  <span>{player.prime.reb || 0} REB</span>
                  <span>{player.prime.ast || 0} AST</span>
                </div>
              </div>
            </div>
          ) : (
            <button
              key={position}
              onClick={() => onPick({ team, position })}
              className="flex min-h-[92px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-center transition hover:border-orange-500 hover:bg-orange-500/5 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <Plus size={18} className="mb-2 text-gray-500" />
              <span className="text-xs font-medium uppercase tracking-widest text-gray-500">{position}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Diagnostics({ rosters, scores }: { rosters: Record<TeamKey, TeamRoster>; scores: Record<TeamKey, ReturnType<typeof rateTeam>> }) {
  const teamA = Object.values(rosters.A).filter(Boolean) as DreamPlayer[];
  const teamB = Object.values(rosters.B).filter(Boolean) as DreamPlayer[];
  const allPlayers = [...teamA, ...teamB].filter(p => p && p.prime);
  const topScorer = allPlayers.length > 0 ? allPlayers.sort((a, b) => (b.prime.pts || 0) - (a.prime.pts || 0))[0] : null;
  const topDefender = allPlayers.length > 0 ? allPlayers.sort((a, b) => ((b.prime.stl || 0) + (b.prime.blk || 0)) - ((a.prime.stl || 0) + (a.prime.blk || 0)))[0] : null;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <InfoTile icon={<BarChart3 size={18} />} label="Projected Edge" value={scores.A.overall === scores.B.overall ? 'Even' : scores.A.overall > scores.B.overall ? 'Team A' : 'Team B'} />
      <InfoTile icon={<Sparkles size={18} />} label="Best Scorer" value={topScorer ? topScorer.name : '--'} />
      <InfoTile icon={<Shield size={18} />} label="Best Stopper" value={topDefender ? topDefender.name : '--'} />
      <InfoTile icon={<Swords size={18} />} label="Matchup Status" value={teamA.length + teamB.length === 10 ? 'Ready' : `${teamA.length + teamB.length}/10 picked`} />
    </section>
  );
}

function SimulationPanel({ result }: { result: SimulationResult }) {
  const sorted = [...result.teamA, ...result.teamB].sort((a, b) => b.pts - a.pts);
  return (
    <section className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.32em] text-orange-500">Final Score</div>
          <div className="mt-2 text-4xl font-medium tracking-tight text-zinc-900 dark:text-white">
            Team A {result.scoreA} - {result.scoreB} Team B
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {result.winner === 'OT' ? 'Dead even after regulation.' : `${TEAM_LABELS[result.winner]} wins at a pace of ${result.pace} possessions.`}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 text-sm text-gray-500">
          {result.notes.map(note => <div key={note} className="rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800">{note}</div>)}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <BoxScore title="Team A Box Score" lines={result.teamA} />
        <BoxScore title="Team B Box Score" lines={result.teamB} />
      </div>

      <div className="rounded-xl bg-zinc-100 p-4 dark:bg-zinc-800">
        <div className="mb-3 text-xs font-medium uppercase tracking-[0.24em] text-gray-500">Game Leaders</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Leader label="Points" line={sorted[0]} value={sorted[0]?.pts} />
          <Leader label="Rebounds" line={[...sorted].sort((a, b) => b.reb - a.reb)[0]} value={[...sorted].sort((a, b) => b.reb - a.reb)[0]?.reb} />
          <Leader label="Assists" line={[...sorted].sort((a, b) => b.ast - a.ast)[0]} value={[...sorted].sort((a, b) => b.ast - a.ast)[0]?.ast} />
        </div>
      </div>
    </section>
  );
}

function BoxScore({ title, lines }: { title: string; lines: PlayerLine[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="bg-zinc-100 px-4 py-3 text-xs font-medium uppercase tracking-[0.24em] text-gray-500 dark:bg-zinc-800">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-gray-500">
            <tr>
              <th className="px-4 py-3">Player</th>
              <th>MIN</th>
              <th>PTS</th>
              <th>REB</th>
              <th>AST</th>
              <th>STL</th>
              <th>BLK</th>
              <th>TO</th>
              <th>FG</th>
              <th>3PT</th>
              <th>FT</th>
              <th>+/-</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(line => (
              <tr key={line.player.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{line.player.name}</td>
                <td>{line.min}</td>
                <td className="font-medium text-orange-500">{line.pts}</td>
                <td>{line.reb}</td>
                <td>{line.ast}</td>
                <td>{line.stl}</td>
                <td>{line.blk}</td>
                <td>{line.tov}</td>
                <td>{line.fgm}-{line.fga}</td>
                <td>{line.fg3m}-{line.fg3a}</td>
                <td>{line.ftm}-{line.fta}</td>
                <td>{line.plusMinus > 0 ? `+${line.plusMinus}` : line.plusMinus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TinyGrade({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
      <div className="text-sm font-medium text-zinc-900 dark:text-white">{value}</div>
      <div className="text-[9px] font-medium uppercase tracking-widest text-gray-500">{label}</div>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: JSX.Element; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-widest text-gray-500">{label}</div>
        <div className="truncate text-sm font-medium text-zinc-900 dark:text-white">{value}</div>
      </div>
    </div>
  );
}

function Leader({ label, line, value }: { label: string; line?: PlayerLine; value?: number }) {
  return (
    <div className="rounded-lg bg-white p-3 dark:bg-zinc-900">
      <div className="text-[10px] font-medium uppercase tracking-widest text-gray-500">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-zinc-900 dark:text-white">{line?.player.name || '--'}</div>
      <div className="text-lg font-medium text-orange-500">{value ?? 0}</div>
    </div>
  );
}

function numberFrom(...values: any[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function positionMatches(posRaw: string | undefined | null, target: Position) {
  const pos = (posRaw || '').toString().toUpperCase();
  if (!pos) return false;
  if (pos.includes(target)) return true;
  // treat guards and wings
  if ((target === 'PG' || target === 'SG') && pos.includes('G')) return true;
  if ((target === 'SF' || target === 'PF') && (pos.includes('F') || pos.includes('SF') || pos.includes('PF'))) return true;
  if (target === 'C' && pos.includes('C')) return true;
  return false;
}

function normalizePrime(avg: any, season: string): PrimeStats | null {
  if (!avg || Number(avg.GP ?? 0) <= 0) return null;
  const prime: PrimeStats = {
    season,
    gp: Number(avg.GP ?? 0),
    min: round(Number(avg.MIN ?? 0), 1),
    pts: round(Number(avg.PTS ?? 0), 1),
    reb: round(Number(avg.REB ?? 0), 1),
    ast: round(Number(avg.AST ?? 0), 1),
    stl: round(Number(avg.STL ?? 0), 1),
    blk: round(Number(avg.BLK ?? 0), 1),
    tov: round(Number(avg.TOV ?? 0), 1),
    fgPct: Number(avg.FG_PCT ?? 0),
    fg3Pct: Number(avg.FG3_PCT ?? 0),
    ftPct: Number(avg.FT_PCT ?? 0),
    estimated: false,
  };
  return primeScore(prime) > 0 ? prime : null;
}

function pickPrimeCandidateSeasons(seasons: string[]) {
  const sorted = [...seasons].sort();
  if (sorted.length <= 8) return sorted;
  const start = Math.max(0, Math.floor(sorted.length * 0.2) - 1);
  const end = Math.min(sorted.length, Math.ceil(sorted.length * 0.85));
  const primeWindow = sorted.slice(start, end);
  const everyOther = primeWindow.filter((_, index) => index % 2 === 0);
  return everyOther.slice(-8);
}

function primeScore(stats: PrimeStats) {
  return stats.pts + stats.reb * 0.8 + stats.ast * 0.9 + stats.stl * 2.3 + stats.blk * 2.1 - stats.tov * 0.6 + stats.min * 0.12;
}

function rateTeam(players: DreamPlayer[]) {
  const offense = clamp(Math.round(players.reduce((sum, p) => sum + p.prime.pts + p.prime.ast * 1.4, 0) * 1.2), 0, 100);
  const defense = clamp(Math.round(players.reduce((sum, p) => sum + p.prime.reb * 0.8 + p.prime.stl * 3 + p.prime.blk * 3.2, 0) * 1.35), 0, 100);
  const spacing = players.reduce((sum, p) => sum + p.prime.fg3Pct, 0) / Math.max(players.length, 1);
  const balance = players.length === 5 ? 15 : players.length * 2;
  const fit = clamp(Math.round(balance + spacing * 95 + players.reduce((sum, p) => sum + Math.min(p.prime.ast, 8), 0) * 1.2), 0, 100);
  return { offense, defense, fit, overall: Math.round((offense * 0.44 + defense * 0.36 + fit * 0.2)) };
}

function getNextPick(rosters: Record<TeamKey, TeamRoster>): ActivePick | null {
  for (const position of POSITIONS) {
    if (!rosters.A[position]) return { team: 'A', position };
    if (!rosters.B[position]) return { team: 'B', position };
  }
  return null;
}

function pickRandomPlayer(pool: any[], used: Set<number>) {
  const available = pool.filter(player => !used.has(getPlayerId(player)) && getPlayerId(player) > 0);
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function simulate(rosters: Record<TeamKey, TeamRoster>): SimulationResult {
  const playersA = POSITIONS.map(position => rosters.A[position]).filter(Boolean) as DreamPlayer[];
  const playersB = POSITIONS.map(position => rosters.B[position]).filter(Boolean) as DreamPlayer[];
  const ratingA = rateTeam(playersA);
  const ratingB = rateTeam(playersB);
  const pace = Math.round(96 + Math.random() * 8);

  const linesA = simulateLines(playersA, ratingA, ratingB, pace);
  const linesB = simulateLines(playersB, ratingB, ratingA, pace);
  const rawA = linesA.reduce((sum, line) => sum + line.pts, 0);
  const rawB = linesB.reduce((sum, line) => sum + line.pts, 0);
  const targetA = Math.max(82, Math.round(rawA + (ratingA.overall - ratingB.overall) * 0.18 + randomBetween(-5, 7)));
  const targetB = Math.max(82, Math.round(rawB + (ratingB.overall - ratingA.overall) * 0.18 + randomBetween(-5, 7)));

  scalePoints(linesA, targetA);
  scalePoints(linesB, targetB);

  const scoreA = linesA.reduce((sum, line) => sum + line.pts, 0);
  const scoreB = linesB.reduce((sum, line) => sum + line.pts, 0);
  linesA.forEach(line => { line.plusMinus = scoreA - scoreB + Math.round(randomBetween(-6, 6)); });
  linesB.forEach(line => { line.plusMinus = scoreB - scoreA + Math.round(randomBetween(-6, 6)); });

  const winner = scoreA === scoreB ? 'OT' : scoreA > scoreB ? 'A' : 'B';
  return {
    scoreA,
    scoreB,
    winner,
    pace,
    teamA: linesA,
    teamB: linesB,
    notes: buildNotes(linesA, linesB, ratingA, ratingB),
  };
}

function simulateLines(players: DreamPlayer[], own: ReturnType<typeof rateTeam>, opp: ReturnType<typeof rateTeam>, pace: number): PlayerLine[] {
  const usageTotal = players.reduce((sum, player) => sum + player.prime.pts + player.prime.ast * 0.8, 0) || 1;
  return players.map(player => {
    const usage = (player.prime.pts + player.prime.ast * 0.8) / usageTotal;
    const defenseTax = 1 - Math.max(-0.1, Math.min(0.12, (opp.defense - own.offense) / 600));
    const pts = Math.max(4, Math.round((player.prime.pts * (0.88 + usage) * defenseTax * pace) / 100 + randomBetween(-4, 5)));
    const reb = Math.max(1, Math.round(player.prime.reb * randomBetween(0.78, 1.22)));
    const ast = Math.max(0, Math.round(player.prime.ast * randomBetween(0.75, 1.25)));
    const stl = Math.max(0, Math.round(player.prime.stl * randomBetween(0.55, 1.55)));
    const blk = Math.max(0, Math.round(player.prime.blk * randomBetween(0.55, 1.55)));
    const tov = Math.max(0, Math.round(player.prime.tov * randomBetween(0.65, 1.4)));
    const fgPct = clamp(player.prime.fgPct + randomBetween(-0.045, 0.045), 0.34, 0.66);
    const fga = Math.max(5, Math.round(pts / Math.max(0.75, fgPct * 2) + randomBetween(0, 5)));
    const fgm = clamp(Math.round(fga * fgPct), 1, fga);
    const fg3a = Math.max(0, Math.round((player.position === 'C' ? fga * 0.16 : fga * 0.34) * randomBetween(0.7, 1.25)));
    const fg3m = clamp(Math.round(fg3a * clamp(player.prime.fg3Pct + randomBetween(-0.05, 0.05), 0.22, 0.48)), 0, fg3a);
    const fta = Math.max(0, Math.round(pts * randomBetween(0.16, 0.34)));
    const ftm = clamp(Math.round(fta * clamp(player.prime.ftPct + randomBetween(-0.04, 0.04), 0.55, 0.94)), 0, fta);

    return {
      player,
      min: Math.round(clamp(player.prime.min + randomBetween(-3, 3), 28, 42)),
      pts,
      reb,
      ast,
      stl,
      blk,
      tov,
      fgm,
      fga,
      fg3m,
      fg3a,
      ftm,
      fta,
      plusMinus: 0,
    };
  });
}

function scalePoints(lines: PlayerLine[], target: number) {
  const current = lines.reduce((sum, line) => sum + line.pts, 0) || 1;
  let remaining = target;
  lines.forEach((line, index) => {
    if (index === lines.length - 1) {
      line.pts = Math.max(0, remaining);
    } else {
      line.pts = Math.max(0, Math.round(line.pts * target / current));
      remaining -= line.pts;
    }
  });
}

function buildNotes(teamA: PlayerLine[], teamB: PlayerLine[], ratingA: ReturnType<typeof rateTeam>, ratingB: ReturnType<typeof rateTeam>) {
  const all = [...teamA, ...teamB];
  const scorer = [...all].sort((a, b) => b.pts - a.pts)[0];
  const passer = [...all].sort((a, b) => b.ast - a.ast)[0];
  const glass = [...all].sort((a, b) => b.reb - a.reb)[0];
  return [
    scorer ? `${scorer.player.name} leads all scorers with ${scorer.pts}.` : 'Close scoring distribution.',
    passer ? `${passer.player.name} controls creation with ${passer.ast} assists.` : 'Balanced playmaking setup.',
    glass ? `${glass.player.name} owns the glass with ${glass.reb} rebounds.` : 'Shared rebounding effort.',
    ratingA.defense > ratingB.defense ? 'Team A has the stronger defensive profile.' : 'Team B has the stronger defensive profile.',
  ];
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
