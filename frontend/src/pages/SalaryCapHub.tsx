import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, CalendarClock, FileSignature, Landmark, TrendingDown, TrendingUp } from 'lucide-react';
import { nbaApi, getPlayerHeadshotUrl, getTeamLogoUrl, getPlayerId, getPlayerName, getPlayerSalary, estimateYears, estimateStatus, type NbaTeam, type Player, type Standing } from '../lib/api';
import BasketballLoader from '../components/BasketballLoader';

type CapTeam = {
  id: number;
  name: string;
  abbr: string;
  payroll: number;
  guaranteed: number;
  capSpace: number;
  taxBill: number;
  apron: 'clear' | 'first' | 'second';
  wins: number;
};

const SALARY_CAP = 141.0;
const LUXURY_TAX = 171.3;
const FIRST_APRON = 178.1;
const SECOND_APRON = 188.9;

export default function SalaryCapHub() {
  const [teamId, setTeamId] = useState(1610612747);
  const [teams, setTeams] = useState<NbaTeam[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [roster, setRoster] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  const nbaTeam = teams.find(item => item.id === teamId) ?? teams[0];

  useEffect(() => {
    nbaApi.getTeams().then(items => {
      const sorted = items.slice().sort((a, b) => a.full_name.localeCompare(b.full_name));
      setTeams(sorted);
      if (!sorted.some(item => item.id === teamId) && sorted[0]) setTeamId(sorted[0].id);
    }).catch(() => setTeams([]));
    nbaApi.getStandings().then(setStandings).catch(() => setStandings([]));
  }, []);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    nbaApi.getTeamRoster(teamId).then(setRoster).catch(() => setRoster([])).finally(() => setLoading(false));
  }, [teamId]);

  const rosterContracts = useMemo(() => roster.slice(0, 12).map(player => ({
    player,
    salary: getPlayerSalary(player),
    years: estimateYears(player),
    status: estimateStatus(player),
  })).sort((a, b) => b.salary - a.salary), [roster]);

  const capUsage = Math.round(Math.min(100, (rosterContracts.reduce((sum, item) => sum + item.salary, 0) / SECOND_APRON) * 100));
  const exceptionStatus = rosterContracts.reduce((sum, item) => sum + item.salary, 0) <= SALARY_CAP
    ? 'Full MLE available'
    : rosterContracts.reduce((sum, item) => sum + item.salary, 0) <= LUXURY_TAX
      ? 'Tax line / Room Exception'
      : 'Taxed / Apron risk';
  const salaryTiers = {
    low: rosterContracts.filter(item => item.salary < 8).length,
    mid: rosterContracts.filter(item => item.salary >= 8 && item.salary < 18).length,
    high: rosterContracts.filter(item => item.salary >= 18).length,
  };
  const topSalaryPlayers = rosterContracts.slice(0, 4);
  const activeStanding = standings.find(item => item.TeamID === teamId);
  const team = buildCapTeam(nbaTeam, rosterContracts.reduce((sum, item) => sum + item.salary, 0), Number(activeStanding?.Wins ?? 0));
  const topSalary = rosterContracts[0];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-white mb-1">Contract & Salary Cap Hub</h2>
          <p className="text-sm text-gray-400">All NBA teams from `nba_api`, with roster-driven cap estimates and contract pressure.</p>
        </div>
        <select value={teamId} onChange={event => setTeamId(Number(event.target.value))} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50 w-full sm:w-auto">
          {teams.map(option => <option key={option.id} value={option.id}>{option.full_name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metric icon={<Landmark size={18} className="text-orange-400 mx-auto mb-1" />} label="Payroll" value={`$${team.payroll.toFixed(1)}M`} />
        <Metric icon={<Banknote size={18} className="text-green-400 mx-auto mb-1" />} label="Cap Space" value={`${team.capSpace >= 0 ? '+' : ''}$${team.capSpace.toFixed(1)}M`} />
        <Metric icon={<AlertTriangle size={18} className="text-yellow-400 mx-auto mb-1" />} label="Tax Bill" value={`$${team.taxBill.toFixed(1)}M`} />
        <Metric icon={<TrendingUp size={18} className="text-cyan-400 mx-auto mb-1" />} label="Apron" value={getApronLabel(team)} />
        <Metric icon={<CalendarClock size={18} className="text-blue-400 mx-auto mb-1" />} label="Wins" value={`${team.wins}`} />
        <Metric icon={<FileSignature size={18} className="text-blue-400 mx-auto mb-1" />} label="Top Contract" value={topSalary ? `$${topSalary.salary.toFixed(1)}M*` : '--'} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric icon={<Banknote size={18} className="text-cyan-400 mx-auto mb-1" />} label="Cap Usage" value={`${capUsage}%`} />
        <Metric icon={<CalendarClock size={18} className="text-yellow-400 mx-auto mb-1" />} label="MLE Status" value={exceptionStatus} />
        <Metric icon={<TrendingDown size={18} className="text-green-400 mx-auto mb-1" />} label="High Salary Slots" value={`${salaryTiers.high}`} />
        <Metric icon={<FileSignature size={18} className="text-blue-400 mx-auto mb-1" />} label="Mid Salary Slots" value={`${salaryTiers.mid}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <img src={getTeamLogoUrl(team.id)} alt={team.abbr} className="h-10 w-10 object-contain" />
            <div>
              <h3 className="text-sm font-medium text-white">{team.name} Payroll Sheet</h3>
              <p className="text-xs text-gray-500">Estimated contracts layered on live roster data.</p>
            </div>
          </div>
          <div className="space-y-2">
            {rosterContracts.map(({ player, salary, years, status }) => (
              <div key={getPlayerId(player)} className="flex flex-wrap sm:grid sm:grid-cols-[1fr_80px_70px_92px] items-center gap-2 sm:gap-3 rounded-lg bg-gray-800/40 p-3 hover:scale-[1.01] hover:bg-gray-800/60 transition-all duration-200 shadow-none hover:shadow-none">
                <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                  <img src={getPlayerHeadshotUrl(getPlayerId(player))} alt="" className="h-9 w-9 rounded-full object-cover object-top bg-white dark:bg-zinc-900 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{getPlayerName(player)}</div>
                    <div className="text-xs text-gray-500">{player.POSITION || 'G/F'} / {player.TEAM_ABBREVIATION}</div>
                  </div>
                </div>
                <div className="text-right text-sm font-medium text-white">${salary.toFixed(1)}M<span className="text-[10px] ml-1 text-gray-400">*</span></div>
                <div className="text-center text-xs text-gray-300">{years} yrs</div>
                <div className={`text-center text-[10px] font-medium uppercase ${status === 'FA' ? 'text-orange-300' : status === 'Option' ? 'text-yellow-300' : 'text-green-300'}`}>{status}</div>
              </div>
            ))}
            {!loading && rosterContracts.length === 0 && <div className="text-center py-10 text-xs text-gray-500">No roster contracts available</div>}
            {loading && <BasketballLoader />}
          </div>
          <div className="mt-3 text-[11px] text-gray-400">* Salary values are estimates derived from public stats and heuristics.</div>
        </div>

        <div className="space-y-4">
          <CapGauge team={team} />
          <ListPanel title="Top Contracts" icon={<CalendarClock size={14} className="text-orange-400" />}>
            {topSalaryPlayers.map(item => <ListRow key={getPlayerId(item.player)} primary={getPlayerName(item.player)} secondary={`${team.abbr} / ${item.status}`} value={`$${item.salary.toFixed(1)}M`} />)}
            {topSalaryPlayers.length === 0 && <ListRow primary="No top contracts" secondary="Current roster estimate" value="--" />}
          </ListPanel>
          <ListPanel title="Contract Stress" icon={<FileSignature size={14} className="text-blue-400" />}>
            <ListRow primary={`${salaryTiers.high} high salaries`} secondary="$18M+ players" value="High" />
            <ListRow primary={`${salaryTiers.mid} mid salaries`} secondary="$8M–$18M players" value="Medium" />
            <ListRow primary={`${salaryTiers.low} low salaries`} secondary="Under $8M players" value="Low" />
          </ListPanel>
        </div>
      </div>
    </div>
  );
}

function CapGauge({ team }: { team: CapTeam }) {
  const markers = [
    { label: 'Cap', value: SALARY_CAP },
    { label: 'Tax', value: LUXURY_TAX },
    { label: '1st', value: FIRST_APRON },
    { label: '2nd', value: SECOND_APRON },
  ];
  const pct = Math.min(100, (team.payroll / SECOND_APRON) * 100);
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-xl p-4">
      <h3 className="text-sm font-medium text-white mb-4">Apron Tracker</h3>
      <div className="h-3 bg-gray-800 rounded-full overflow-hidden mb-3">
        <div className={`h-full ${team.apron === 'second' ? 'bg-red-500' : team.apron === 'first' ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {markers.map(marker => (
          <div key={marker.label} className="rounded bg-gray-800/50 p-2 text-center">
            <div className="text-[10px] text-gray-500">{marker.label}</div>
            <div className="text-xs font-medium text-white">${marker.value.toFixed(0)}M</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        {team.payroll > LUXURY_TAX ? <TrendingUp size={13} className="text-red-400" /> : <TrendingDown size={13} className="text-green-400" />}
        {team.payroll > LUXURY_TAX ? 'Operating above the tax line.' : 'Below luxury tax pressure.'}
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-xl p-4 text-center hover:scale-105 transition-transform duration-200 shadow-none hover:shadow-none">{icon}<div className="text-2xl font-medium text-white truncate">{value}</div><div className="text-xs text-gray-400">{label}</div></div>;
}

function ListPanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-xl p-4"><h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">{icon}{title}</h3><div className="space-y-2">{children}</div></div>;
}

function ListRow({ primary, secondary, value }: { primary: string; secondary: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-800/40 p-3 hover:scale-[1.02] hover:bg-gray-800/60 transition-all duration-200 shadow-none hover:shadow-none"><div className="min-w-0"><div className="text-xs font-medium text-white truncate">{primary}</div><div className="text-[10px] text-gray-500 truncate">{secondary}</div></div><div className="text-xs font-medium text-orange-300 flex-shrink-0">{value}</div></div>;
}

function buildCapTeam(team: NbaTeam | undefined, payroll: number, wins: number): CapTeam {
  const normalizedPayroll = Math.round(payroll * 10) / 10;
  const taxBill = Math.max(0, Math.round((normalizedPayroll - LUXURY_TAX) * 1.5 * 10) / 10);
  return {
    id: team?.id ?? 0,
    name: team?.full_name ?? 'Loading team',
    abbr: team?.abbreviation ?? '--',
    payroll: normalizedPayroll,
    guaranteed: Math.round(normalizedPayroll * 0.92 * 10) / 10,
    capSpace: Math.round((SALARY_CAP - normalizedPayroll) * 10) / 10,
    taxBill,
    apron: normalizedPayroll >= SECOND_APRON ? 'second' : normalizedPayroll >= FIRST_APRON ? 'first' : 'clear',
    wins,
  };
}

function getApronLabel(team: CapTeam) {
  if (team.apron === 'second') return '2nd Apron';
  if (team.apron === 'first') return '1st Apron';
  return team.payroll > LUXURY_TAX ? 'Tax' : 'Clear';
}


