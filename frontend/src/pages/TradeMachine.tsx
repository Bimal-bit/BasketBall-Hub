import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CheckCircle, Repeat2, Scale, Search, Ticket, TrendingUp, XCircle } from 'lucide-react';
import { nbaApi, getPlayerHeadshotUrl, getTeamLogoUrl, type NbaTeam, type Player, type Standing } from '../lib/api';
import BasketballLoader from '../components/BasketballLoader';

type TeamOption = { id: number; name: string; abbr: string; wins: number; color: string };
type DraftPick = { id: string; label: string; round: 1 | 2; year: number; protection: string; value: number; sourceUrl: string };

const PICK_SOURCE_URL = 'https://basketball.realgm.com/nba/draft/future_drafts/team';

export default function TradeMachine() {
  const [leftTeamId, setLeftTeamId] = useState(1610612747);
  const [rightTeamId, setRightTeamId] = useState(1610612743);
  const [teams, setTeams] = useState<NbaTeam[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [leftRoster, setLeftRoster] = useState<Player[]>([]);
  const [rightRoster, setRightRoster] = useState<Player[]>([]);
  const [leftSelected, setLeftSelected] = useState<number[]>([]);
  const [rightSelected, setRightSelected] = useState<number[]>([]);
  const [leftPicks, setLeftPicks] = useState<string[]>([]);
  const [rightPicks, setRightPicks] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      nbaApi.getTeams().catch(() => []),
      nbaApi.getStandings().catch(() => []),
    ]).then(([items, standingItems]) => {
      setTeams(items);
      setStandings(standingItems);
      if (items[0] && !items.some(team => team.id === leftTeamId)) setLeftTeamId(items[0].id);
      if (items[1] && !items.some(team => team.id === rightTeamId)) setRightTeamId(items[1].id);
    });
  }, []);

  const teamOptions = useMemo(() => {
    const winsById = Object.fromEntries(standings.map(item => [item.TeamID, Number(item.Wins ?? 0)]));
    return teams.map(team => toTeamOption(team, winsById[team.id] ?? 0)).sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, standings]);

  useEffect(() => {
    loadRoster(leftTeamId, setLeftRoster);
    setLeftSelected([]);
    setLeftPicks([]);
  }, [leftTeamId]);

  useEffect(() => {
    loadRoster(rightTeamId, setRightRoster);
    setRightSelected([]);
    setRightPicks([]);
  }, [rightTeamId]);

  async function loadRoster(teamId: number, setter: (players: Player[]) => void) {
    setLoading(true);
    try {
      setter(await nbaApi.getTeamRoster(teamId));
    } catch {
      setter([]);
    } finally {
      setLoading(false);
    }
  }

  const leftTeam = teamOptions.find(team => team.id === leftTeamId) ?? teamOptions[0] ?? toTeamOption();
  const rightTeam = teamOptions.find(team => team.id === rightTeamId) ?? teamOptions.find(team => team.id !== leftTeam.id) ?? leftTeam;
  const draftPicks = useMemo(() => Object.fromEntries(teamOptions.map(team => [team.id, buildDraftPicks(team)])), [teamOptions]);
  const leftOutgoing = leftRoster.filter(player => leftSelected.includes(getPlayerId(player)));
  const rightOutgoing = rightRoster.filter(player => rightSelected.includes(getPlayerId(player)));
  const leftOutgoingPicks = (draftPicks[leftTeamId] || []).filter(pick => leftPicks.includes(pick.id));
  const rightOutgoingPicks = (draftPicks[rightTeamId] || []).filter(pick => rightPicks.includes(pick.id));
  const leftSalary = sumSalary(leftOutgoing);
  const rightSalary = sumSalary(rightOutgoing);
  const leftImpact = sumImpact(leftOutgoing) + sumPickValue(leftOutgoingPicks);
  const rightImpact = sumImpact(rightOutgoing) + sumPickValue(rightOutgoingPicks);
  const salaryGap = Math.abs(leftSalary - rightSalary);
  const legalTrade = leftSalary > 0 && rightSalary > 0 && salaryGap <= Math.max(leftSalary, rightSalary) * 0.25 + 0.25;
  const leftWinDelta = estimateWinDelta(rightImpact - leftImpact);
  const rightWinDelta = estimateWinDelta(leftImpact - rightImpact);

  const filteredLeft = useMemo(() => filterRoster(leftRoster, query), [leftRoster, query]);
  const filteredRight = useMemo(() => filterRoster(rightRoster, query), [rightRoster, query]);

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-4 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-4xl font-black text-white italic uppercase tracking-tighter mb-1">Trade Hub</h2>
          <p className="text-sm text-gray-400">Build two-team trades with live rosters, salary checks, picks, and asset estimates.</p>
        </div>
        <div className="relative w-full lg:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search roster" className="w-full bg-gray-900 border border-gray-800 rounded-lg py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-orange-500/50" />
        </div>
      </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px_minmax(0,1fr)] gap-4 items-start">
        <TeamTradePanel team={leftTeam} teams={teamOptions} selectedTeamId={leftTeamId} onTeamChange={setLeftTeamId} roster={filteredLeft} selected={leftSelected} onToggle={id => toggleSelected(id, leftSelected, setLeftSelected)} picks={draftPicks[leftTeamId] || []} selectedPicks={leftPicks} onTogglePick={id => toggleSelected(id, leftPicks, setLeftPicks)} />

        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-4 space-y-4 order-first xl:order-none xl:sticky xl:top-24">
          <div className="flex items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-orange-500/15 text-orange-300 flex items-center justify-center border border-orange-500/30">
              <ArrowLeftRight size={22} />
            </div>
          </div>
          {loading ? <div className="py-6 flex justify-center"><BasketballLoader /></div> : (
            <>
              <TradeMetric icon={<Scale size={16} />} label="Salary Gap" value={`$${salaryGap.toFixed(1)}M`} />
              <TradeMetric icon={legalTrade ? <CheckCircle size={16} /> : <XCircle size={16} />} label="Trade Check" value={legalTrade ? 'Passes' : 'Needs balance'} good={legalTrade} />
              <TradeMetric icon={<TrendingUp size={16} />} label={`${leftTeam.abbr} Win Change`} value={formatDelta(leftWinDelta)} good={leftWinDelta >= 0} />
              <TradeMetric icon={<TrendingUp size={16} />} label={`${rightTeam.abbr} Win Change`} value={formatDelta(rightWinDelta)} good={rightWinDelta >= 0} />
              <div className="rounded-2xl bg-gray-800/50 p-3 text-xs text-gray-400 leading-relaxed">
                Draft picks do not count toward salary matching, but they do move the projected asset value and win-window balance.
                <a href={PICK_SOURCE_URL} target="_blank" rel="noreferrer" className="ml-1 text-orange-300 hover:text-orange-200">Verify pick rights on RealGM.</a>
              </div>
            </>
          )}
        </div>

        <TeamTradePanel team={rightTeam} teams={teamOptions} selectedTeamId={rightTeamId} onTeamChange={setRightTeamId} roster={filteredRight} selected={rightSelected} onToggle={id => toggleSelected(id, rightSelected, setRightSelected)} picks={draftPicks[rightTeamId] || []} selectedPicks={rightPicks} onTogglePick={id => toggleSelected(id, rightPicks, setRightPicks)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PackageSummary title={`${leftTeam.abbr} sends`} players={leftOutgoing} picks={leftOutgoingPicks} salary={leftSalary} impact={leftImpact} />
        <PackageSummary title={`${rightTeam.abbr} sends`} players={rightOutgoing} picks={rightOutgoingPicks} salary={rightSalary} impact={rightImpact} />
      </div>
    </div>
  );
}

function TeamTradePanel({ team, teams, selectedTeamId, onTeamChange, roster, selected, onToggle, picks, selectedPicks, onTogglePick }: {
  team: TeamOption; teams: TeamOption[]; selectedTeamId: number; onTeamChange: (id: number) => void; roster: Player[]; selected: number[]; onToggle: (id: number) => void; picks: DraftPick[]; selectedPicks: string[]; onTogglePick: (id: string) => void;
}) {
  return (
    <div className="min-w-0 bg-gray-900 border border-gray-800 rounded-3xl p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-12 w-12 rounded-2xl border border-gray-800 bg-black/30 p-1.5 shrink-0">
          <img src={getTeamLogoUrl(team.id)} alt={team.abbr} className="h-full w-full object-contain" />
        </div>
        <select value={selectedTeamId} onChange={event => onTeamChange(Number(event.target.value))} className="w-full min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-orange-500">
          {teams.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </div>
      <div className="mb-4 rounded-2xl border border-gray-800 bg-gray-800/30 p-3">
        <div className="text-xs font-semibold text-white mb-2 flex items-center gap-2"><Ticket size={13} className="text-orange-400" />Draft Picks</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {picks.map(pick => {
            const checked = selectedPicks.includes(pick.id);
            return (
              <button key={pick.id} onClick={() => onTogglePick(pick.id)} className={`w-full min-w-0 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-transform duration-200 hover:scale-105 shadow-md hover:shadow-lg ${checked ? 'bg-orange-500/10 border-orange-500/40 shadow-orange-500/5' : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'}`}>
                <div>
                  <div className="text-xs font-medium text-white">{pick.label}</div>
                  <div className="text-[10px] text-gray-500">{pick.protection}</div>
                </div>
                <a href={pick.sourceUrl} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="text-xs font-bold text-orange-300 hover:text-orange-200">{pick.value.toFixed(1)}</a>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid max-h-[520px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-1">
        {roster.map(player => {
          const playerId = getPlayerId(player);
          const checked = selected.includes(playerId);
          return (
            <button key={`${team.id}-${playerId}`} onClick={() => onToggle(playerId)} className={`w-full min-w-0 flex items-center gap-3 p-3 rounded-2xl border text-left transition-transform duration-200 hover:scale-105 shadow-md hover:shadow-lg ${checked ? 'bg-orange-500/10 border-orange-500/40 shadow-orange-500/5' : 'bg-gray-800/40 border-gray-800 hover:border-gray-700'}`}>
              <img src={getPlayerHeadshotUrl(playerId)} alt="" className="h-10 w-10 rounded-full object-cover object-top bg-gray-950" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{getPlayerName(player)}</div>
                <div className="text-xs text-gray-500">{player.POSITION || 'G/F'} / ${getSalary(player).toFixed(1)}M</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-white">{Number(player.PTS ?? 0).toFixed(1)}</div>
                <div className="text-[10px] text-gray-500">PTS</div>
              </div>
            </button>
          );
        })}
        {roster.length === 0 && <div className="text-center py-10 text-xs text-gray-500 sm:col-span-2 xl:col-span-1">No roster data available</div>}
      </div>
    </div>
  );
}

function PackageSummary({ title, players, picks, salary, impact }: { title: string; players: Player[]; picks: DraftPick[]; salary: number; impact: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-3xl p-4">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Repeat2 size={14} className="text-orange-400" />{title}</h3>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <MiniStat label="Assets" value={players.length + picks.length} />
        <MiniStat label="Salary" value={`$${salary.toFixed(1)}M`} />
        <MiniStat label="Impact" value={impact.toFixed(1)} />
      </div>
      <div className="text-xs leading-relaxed text-gray-400">{[...players.map(getPlayerName), ...picks.map(pick => pick.label)].join(', ') || 'No assets selected'}</div>
    </div>
  );
}

function TradeMetric({ icon, label, value, good }: { icon: ReactNode; label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-gray-800/50 p-3">
      <div className="flex items-center gap-2 text-xs text-gray-400">{icon}{label}</div>
      <div className={`text-sm font-bold ${good === undefined ? 'text-white' : good ? 'text-green-400' : 'text-red-400'}`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl bg-gray-800/50 p-3 text-center"><div className="text-sm font-bold text-white">{value}</div><div className="text-[10px] text-gray-500">{label}</div></div>;
}

function toggleSelected<T>(id: T, selected: T[], setter: (value: T[]) => void) {
  setter(selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id]);
}

function filterRoster(roster: Player[], query: string) {
  const trimmed = query.toLowerCase().trim();
  return roster.filter(player => !trimmed || getPlayerName(player).toLowerCase().includes(trimmed));
}

function getPlayerId(player: Player) {
  return Number(player.PLAYER_ID ?? player.PERSON_ID);
}

function getPlayerName(player: Player) {
  return player.PLAYER_NAME || player.PLAYER || `${player.PLAYER_FIRST_NAME ?? ''} ${player.PLAYER_LAST_NAME ?? ''}`.trim() || 'Unknown Player';
}

function getSalary(player: Player) {
  const production = Number(player.PTS ?? 0) * 0.72 + Number(player.REB ?? 0) * 0.32 + Number(player.AST ?? 0) * 0.45;
  return Math.max(2.1, Math.min(42, Math.round((production + 4) * 10) / 10));
}

function sumSalary(players: Player[]) {
  return players.reduce((sum, player) => sum + getSalary(player), 0);
}

function sumImpact(players: Player[]) {
  return players.reduce((sum, player) => sum + Number(player.PTS ?? 0) + Number(player.REB ?? 0) * 0.45 + Number(player.AST ?? 0) * 0.7 + Number(player.STL ?? 0) * 1.4 + Number(player.BLK ?? 0) * 1.2, 0);
}

function sumPickValue(picks: DraftPick[]) {
  return picks.reduce((sum, pick) => sum + pick.value, 0);
}

function estimateWinDelta(impactDelta: number) {
  return Math.round((impactDelta / 8) * 10) / 10;
}

function formatDelta(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
}

function toTeamOption(team?: NbaTeam, wins = 0): TeamOption {
  return {
    id: team?.id ?? 0,
    name: team?.full_name ?? 'Loading team',
    abbr: team?.abbreviation ?? '--',
    wins,
    color: getTeamColor(team?.abbreviation),
  };
}

function buildDraftPicks(team: TeamOption): DraftPick[] {
  const baseValue = Math.max(4.0, Math.min(9.0, 9.2 - (team.wins / 82) * 4.5));
  const firstValue = Math.round(baseValue * 10) / 10;
  const secondValue = Math.min(3.5, Math.max(1.1, Math.round((firstValue * 0.22) * 10) / 10));
  return [
    { id: `${team.id}-2027-1`, label: `${team.abbr} 2027 1st (Predicted)`, round: 1, year: 2027, protection: 'Future pick rights based on standings; verify externally', value: firstValue, sourceUrl: PICK_SOURCE_URL },
    { id: `${team.id}-2028-1`, label: `${team.abbr} 2028 1st (Predicted)`, round: 1, year: 2028, protection: 'Future pick rights based on standings; verify externally', value: Math.round((firstValue + 0.3) * 10) / 10, sourceUrl: PICK_SOURCE_URL },
    { id: `${team.id}-2029-1`, label: `${team.abbr} 2029 1st (Predicted)`, round: 1, year: 2029, protection: 'Future pick rights based on standings; verify externally', value: Math.round((firstValue + 0.5) * 10) / 10, sourceUrl: PICK_SOURCE_URL },
    { id: `${team.id}-2028-2`, label: `${team.abbr} 2028 2nd (Predicted)`, round: 2, year: 2028, protection: 'Future second-round pick placeholder', value: secondValue, sourceUrl: PICK_SOURCE_URL },
  ];
}

function getTeamColor(abbreviation?: string) {
  const colors: Record<string, string> = {
    ATL: '#E03A3E', BOS: '#007A33', BKN: '#000000', CHA: '#1D1160', CHI: '#CE1141', CLE: '#860038',
    DAL: '#00538C', DEN: '#0E2240', DET: '#C8102E', GSW: '#1D428A', HOU: '#CE1141', IND: '#002D62',
    LAC: '#C8102E', LAL: '#552583', MEM: '#5D76A9', MIA: '#98002E', MIL: '#00471B', MIN: '#0C2340',
    NOP: '#0C2340', NYK: '#006BB6', OKC: '#007AC1', ORL: '#0077C0', PHI: '#006BB6', PHX: '#1D1160',
    POR: '#E03A3E', SAC: '#5A2D81', SAS: '#C4CED4', TOR: '#CE1141', UTA: '#002B5C', WAS: '#002B5C',
  };
  return colors[abbreviation ?? ''] ?? '#374151';
}
