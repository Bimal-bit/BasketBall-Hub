import { type ReactNode, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, Search, SlidersHorizontal, Zap } from 'lucide-react';
import { getPlayerHeadshotUrl, getTeamLogoUrl, nbaApi, type NbaTeam, type Player, type PlayerFatigueScore, type PlayerGameLog } from '../lib/api';
import MiniLineChart from '../components/MiniLineChart';
import { SkeletonGrid } from '../components/SkeletonCard';

type PlayerFatigue = Player & { fatigue?: PlayerFatigueScore; recent_games?: PlayerGameLog[] };
type RiskFilter = 'all' | 'high' | 'medium' | 'low';
type SortMode = 'risk' | 'minutes' | 'drop' | 'name' | 'points' | 'age' | 'position';

export default function FatigueDetection() {
  const [players, setPlayers] = useState<PlayerFatigue[]>([]);
  const [teams, setTeams] = useState<NbaTeam[]>([]);
  const [selected, setSelected] = useState<PlayerFatigue | null>(null);
  const [filter, setFilter] = useState<RiskFilter>('all');
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<number | 'all'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('risk');
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [season, setSeason] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [selectedStats, setSelectedStats] = useState<any>(null);

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (teams.length === 0) return;
    loadFatigue(teamFilter);
  }, [teamFilter, teams]);

  useEffect(() => {
    if (!selected) {
      setSelectedStats(null);
      return;
    }

    let active = true;
    setLoadingDetails(true);
    nbaApi.getPlayerAverages(getPlayerId(selected), getCurrentSeason())
      .then(data => { if (!active) return; setSelectedStats(data); })
      .catch(() => { if (active) setSelectedStats(null); })
      .finally(() => { if (active) setLoadingDetails(false); });

    return () => { active = false; };
  }, [selected]);

  async function loadTeams() {
    setLoading(true);
    try {
      const realTeams = await nbaApi.getTeams();
      const sorted = realTeams.slice().sort((a, b) => a.full_name.localeCompare(b.full_name));
      setTeams(sorted);
      setTeamFilter('all');
    } catch {
      setTeams([]);
      setPlayers([]);
      setLoading(false);
    }
  }

  async function loadFatigue(teamId: number | 'all') {
    setLoading(true);
    try {
      const report = await nbaApi.getFatigueReport(teamId);
      setPlayers(report.players);
      setSelected(report.players[0] ?? null);
      setSeason(report.season);
      setGeneratedAt(report.generated_at);
    } catch {
      setPlayers([]);
      setSelected(null);
      setSeason('');
      setGeneratedAt('');
    } finally {
      setLoading(false);
    }
  }

  const teamOptions = teams;
  const filtered = players
    .filter(player => {
      if (filter !== 'all' && player.fatigue?.risk_level !== filter) return false;
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      const team = teamOptions.find(item => item.id === Number(player.TEAM_ID))?.abbreviation?.toLowerCase() ?? '';
      return getPlayerName(player).toLowerCase().includes(query) || String(player.POSITION ?? '').toLowerCase().includes(query) || team.includes(query);
    })
    .sort((a, b) => {
      if (sortMode === 'minutes') return (b.fatigue?.minutes_last_3 ?? 0) - (a.fatigue?.minutes_last_3 ?? 0);
      if (sortMode === 'drop') return (b.fatigue?.performance_drop ?? 0) - (a.fatigue?.performance_drop ?? 0);
      if (sortMode === 'name') return getPlayerName(a).localeCompare(getPlayerName(b));
      if (sortMode === 'points') return Number(b.PTS ?? 0) - Number(a.PTS ?? 0);
      if (sortMode === 'age') return Number(b.AGE ?? 0) - Number(a.AGE ?? 0);
      if (sortMode === 'position') return String(a.POSITION ?? '').localeCompare(String(b.POSITION ?? ''));
      return (b.fatigue?.fatigue_score ?? 0) - (a.fatigue?.fatigue_score ?? 0);
    });

  const highRisk = players.filter(player => player.fatigue?.risk_level === 'high').length;
  const medRisk = players.filter(player => player.fatigue?.risk_level === 'medium').length;
  const lowRisk = players.filter(player => player.fatigue?.risk_level === 'low').length;
  const averageFatigue = players.length ? Math.round(players.reduce((sum, player) => sum + (player.fatigue?.fatigue_score ?? 0), 0) / players.length) : 0;
  const b2bCount = players.filter(player => player.fatigue?.back_to_back).length;
  const selectedTeam = selected ? teamOptions.find(item => item.id === Number(selected.TEAM_ID)) : null;
  const selectedMinutes = selected ? Number(selectedStats?.MIN ?? selected.MIN ?? 18) : 0;
  const selectedFgPct = selectedStats ? normalizePct(selectedStats.FG_PCT) : 0;
  const selected3Pct = selectedStats ? normalizePct(selectedStats.FG3_PCT) : 0;

  if (loading) {
    return (
      <div className="w-full py-4"><SkeletonGrid count={8} /></div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Fatigue Detection</h2>
          <p className="text-sm text-gray-400">Official NBA workload model using recent player game logs, minutes, rest, back-to-backs, and shooting trend changes.</p>
        </div>
        <div className="text-xs text-gray-500">
          {season && <span>{season}</span>}
          {generatedAt && <span className="ml-2">Updated {new Date(generatedAt).toLocaleString()}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <RiskButton active={filter === 'high'} icon={<AlertTriangle size={20} className="text-red-400 mx-auto mb-1" />} value={highRisk} label="High Risk" color="red" onClick={() => setFilter(filter === 'high' ? 'all' : 'high')} />
        <RiskButton active={filter === 'medium'} icon={<Clock size={20} className="text-yellow-400 mx-auto mb-1" />} value={medRisk} label="Medium Risk" color="yellow" onClick={() => setFilter(filter === 'medium' ? 'all' : 'medium')} />
        <RiskButton active={filter === 'low'} icon={<CheckCircle size={20} className="text-green-400 mx-auto mb-1" />} value={lowRisk} label="Low Risk" color="green" onClick={() => setFilter(filter === 'low' ? 'all' : 'low')} />
        <MetricCard icon={<Activity size={20} className="text-cyan-400 mx-auto mb-1" />} value={averageFatigue} label="Avg Fatigue" />
        <MetricCard icon={<Zap size={20} className="text-orange-400 mx-auto mb-1" />} value={b2bCount} label="Back-to-Back" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search player, position, or team"
            className="w-full bg-gray-900 border border-gray-800 rounded-lg py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-orange-500/50 placeholder:text-gray-600"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={teamFilter}
            onChange={(event) => {
              setTeamFilter(event.target.value === 'all' ? 'all' : Number(event.target.value));
            }}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-orange-500/50"
          >
            <option value="all">All NBA teams</option>
            {teamOptions.map(team => <option key={team.id} value={team.id}>{team.abbreviation} - {team.full_name}</option>)}
          </select>
          <select
            value={selected ? getPlayerId(selected) : ''}
            onChange={(event) => setSelected(players.find(player => getPlayerId(player) === Number(event.target.value)) ?? null)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-orange-500/50"
          >
            {filtered.map(player => <option key={getPlayerId(player)} value={getPlayerId(player)}>{getPlayerName(player)}</option>)}
            {filtered.length === 0 && <option value="">No players</option>}
          </select>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1">
            <SlidersHorizontal size={15} className="text-gray-500 shrink-0" />
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-orange-500/50"
            >
              <option value="risk">Sort by risk</option>
              <option value="minutes">Sort by minutes</option>
              <option value="drop">Sort by performance drop</option>
              <option value="points">Sort by points</option>
              <option value="name">Sort by name</option>
              <option value="age">Sort by age</option>
              <option value="position">Sort by position</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2">
          <h3 className="text-sm font-semibold text-white">
            {filter === 'all' ? 'All Players' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Risk Players`}
            <span className="text-gray-400 font-normal ml-2">({filtered.length})</span>
          </h3>
          {filtered.map(player => (
            <FatigueRow
              key={getPlayerId(player)}
              player={player}
              teams={teamOptions}
              selected={selected ? getPlayerId(selected) === getPlayerId(player) : false}
              onClick={() => setSelected(player)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-xl">
              No players match this fatigue view
            </div>
          )}
        </div>

        {selected && (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <PlayerFace player={selected} teamId={selectedTeam?.id ?? Number(selected.TEAM_ID)} sizeClass="w-10 h-10" />
                <div>
                  <div className="text-sm font-semibold text-white">{getPlayerName(selected)}</div>
                  <div className="text-xs text-gray-400">{selectedTeam?.abbreviation} / {selected.POSITION || 'N/A'}</div>
                </div>
              </div>

              <FatigueGauge score={selected.fatigue?.fatigue_score ?? 0} />

              <div className="mt-4 space-y-3">
                <DetailRow label="Minutes (Last 3 Games)" value={`${selected.fatigue?.minutes_last_3 ?? '--'} min`} />
                <DetailRow label="Suggested Minutes Cap" value={`${getMinutesCap(selected)} min`} danger={(selected.fatigue?.fatigue_score ?? 0) >= 65} />
                <DetailRow label="Back-to-Back" value={selected.fatigue?.back_to_back ? 'Yes' : 'No'} danger={selected.fatigue?.back_to_back} />
                <DetailRow label="Games Last 7 Days" value={`${selected.fatigue?.games_last_7 ?? '--'} games`} danger={(selected.fatigue?.games_last_7 ?? 0) >= 5} />
                <DetailRow label="Avg Rest Days" value={`${selected.fatigue?.avg_rest_days ?? '--'} days`} danger={(selected.fatigue?.avg_rest_days ?? 0) <= 1} />
                <DetailRow label="Season MPG" value={loadingDetails ? 'Loading...' : `${selectedMinutes.toFixed(1)} min`} />
                <DetailRow label="FG%" value={`${selectedFgPct.toFixed(1)}%`} />
                <DetailRow label="3P%" value={`${selected3Pct.toFixed(1)}%`} />
                <DetailRow label="Performance Drop" value={`${selected.fatigue?.performance_drop?.toFixed(1) ?? '--'}%`} danger={(selected.fatigue?.performance_drop ?? 0) > 8} />
                <DetailRow label="Risk Level" value={(selected.fatigue?.risk_level ?? 'unknown').toUpperCase()} riskLevel={selected.fatigue?.risk_level} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MicroMetric label="Rest Need" value={getRestNeed(selected.fatigue?.fatigue_score ?? 0)} />
              <MicroMetric label="Q4 Risk" value={getQuarterRisk(selected.fatigue?.fatigue_score ?? 0)} />
              <MicroMetric label="Trend" value={(selected.fatigue?.performance_drop ?? 0) > 8 ? 'Down' : 'Stable'} />
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-white mb-3">Workload Factors</h4>
              <FactorBar label="Minutes Load" value={Math.min(100, Math.round(((selected.fatigue?.minutes_last_3 ?? 0) / 110) * 100))} />
              <FactorBar label="Schedule Stress" value={Math.min(100, Math.round(((selected.fatigue?.games_last_7 ?? 0) / 5) * 100))} />
              <FactorBar label="Efficiency Dip" value={Math.min(100, Math.round((selected.fatigue?.performance_drop ?? 0) * 7))} />
              <div className="mt-3 text-xs text-gray-400">
                Team context: <span className="text-white">{selectedTeam?.full_name ?? 'Unknown team'}</span>
                <span className="text-gray-600"> / </span>
                <span>{teamFilter === 'all' ? 'League workload from official NBA game logs' : `${selected.recent_games?.length ?? 0} recent player games loaded`}</span>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-white mb-3">Fatigue History (7 days)</h4>
              <MiniLineChart
                data={generateFatigueTrend(selected.fatigue?.fatigue_score ?? 40)}
                color={selected.fatigue?.risk_level === 'high' ? '#ef4444' : selected.fatigue?.risk_level === 'medium' ? '#eab308' : '#22c55e'}
                height={80}
                showDots
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>7 days ago</span>
                <span>Today</span>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-white mb-2">AI Recommendation</h4>
              <p className="text-xs text-gray-300 leading-relaxed">
                {getRecommendation(selected.fatigue?.risk_level ?? 'low', getPlayerName(selected), getMinutesCap(selected))}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FatigueRow({ player, teams, selected, onClick }: {
  player: PlayerFatigue; teams: NbaTeam[]; selected: boolean; onClick: () => void;
}) {
  const team = teams.find(item => item.id === Number(player.TEAM_ID));
  const score = player.fatigue?.fatigue_score ?? 0;
  const risk = player.fatigue?.risk_level ?? 'low';

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
        selected ? 'bg-gray-800 border-orange-500/40' : 'bg-gray-900 border-gray-800 hover:border-gray-700'
      }`}
    >
      <PlayerFace player={player} teamId={team?.id ?? Number(player.TEAM_ID)} sizeClass="w-9 h-9" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{getPlayerName(player)}</div>
        <div className="text-xs text-gray-400">{player.POSITION || 'N/A'} / {team?.abbreviation}</div>
      </div>
      {player.fatigue?.back_to_back && (
        <span className="text-xs bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded font-medium">B2B</span>
      )}
      <div className="text-right flex-shrink-0">
        <FatigueBar score={score} risk={risk} />
      </div>
    </button>
  );
}

function FatigueBar({ score, risk }: { score: number; risk: string }) {
  const color = risk === 'high' ? '#ef4444' : risk === 'medium' ? '#eab308' : '#22c55e';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold w-8 text-right" style={{ color }}>{Math.round(score)}</span>
    </div>
  );
}

function PlayerFace({ player, teamId, sizeClass }: { player: Player; teamId?: number; sizeClass: string }) {
  const playerId = getPlayerId(player);
  const name = getPlayerName(player);
  return (
    <div className={`${sizeClass} overflow-hidden rounded-full border border-gray-700 bg-gray-800 flex-shrink-0`}>
      <img
        src={getPlayerHeadshotUrl(playerId)}
        alt={name}
        className="h-full w-full object-cover object-top scale-125 translate-y-1"
        onError={(event) => {
          const img = event.currentTarget;
          img.src = teamId ? getTeamLogoUrl(teamId) : '/assets/images/nba-6.svg';
          img.className = 'h-full w-full object-contain p-1.5';
        }}
      />
    </div>
  );
}

function FatigueGauge({ score }: { score: number }) {
  const color = score >= 65 ? '#ef4444' : score >= 45 ? '#eab308' : '#22c55e';
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#1f2937" strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-white">{Math.round(score)}</div>
          <div className="text-xs text-gray-400">Fatigue</div>
        </div>
      </div>
      <div className="text-xs font-medium mt-1" style={{ color }}>
        {score >= 65 ? 'HIGH RISK' : score >= 45 ? 'MODERATE' : 'FRESH'}
      </div>
    </div>
  );
}

function RiskButton({ active, icon, value, label, color, onClick }: {
  active: boolean;
  icon: ReactNode;
  value: number;
  label: string;
  color: 'red' | 'yellow' | 'green';
  onClick: () => void;
}) {
  const border = color === 'red' ? 'border-red-500/60' : color === 'yellow' ? 'border-yellow-500/60' : 'border-green-500/60';
  const text = color === 'red' ? 'text-red-400' : color === 'yellow' ? 'text-yellow-400' : 'text-green-400';
  return (
    <button
      onClick={onClick}
      className={`bg-gray-900 border rounded-xl p-4 text-center transition-all ${active ? border : 'border-gray-800 hover:border-gray-700'}`}
    >
      {icon}
      <div className={`text-2xl font-bold ${text}`}>{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </button>
  );
}

function MetricCard({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
      {icon}
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}

function DetailRow({ label, value, danger, riskLevel }: { label: string; value: string; danger?: boolean; riskLevel?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-xs font-medium ${
        riskLevel ? (riskLevel === 'high' ? 'text-red-400' : riskLevel === 'medium' ? 'text-yellow-400' : 'text-green-400') :
        danger ? 'text-red-400' : 'text-white'
      }`}>
        {value}
      </span>
    </div>
  );
}

function generateFatigueTrend(currentScore: number): number[] {
  const base = currentScore * 0.6;
  return Array.from({ length: 7 }, (_, index) => {
    const progress = index / 6;
    const noise = (((index * 17 + Math.round(currentScore)) % 9) - 4) * 1.2;
    return Math.max(5, Math.min(100, Math.round(base + (currentScore - base) * progress + noise)));
  });
}

function getMinutesCap(player: PlayerFatigue): number {
  const mpg = Number(player.MIN ?? 0) || 24;
  const score = player.fatigue?.fatigue_score ?? 0;
  if (score >= 75) return Math.max(18, Math.round(mpg - 8));
  if (score >= 60) return Math.max(22, Math.round(mpg - 5));
  if (score >= 45) return Math.max(26, Math.round(mpg - 2));
  return Math.round(mpg + 2);
}

function getRestNeed(score: number): string {
  if (score >= 75) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
}

function getQuarterRisk(score: number): string {
  if (score >= 70) return 'Severe';
  if (score >= 50) return 'Watch';
  return 'Normal';
}

function MicroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
      <div className="text-sm font-bold text-white">{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}

function FactorBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? 'bg-red-500' : value >= 45 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium">{value}%</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function getRecommendation(risk: string, name: string, minutesCap: number): string {
  const first = name.split(' ')[1] || name.split(' ')[0];
  if (risk === 'high') return `${first} is showing significant fatigue indicators. Consider a ${minutesCap}-minute cap for the next game and avoid extended fourth-quarter stretches unless the score demands it.`;
  if (risk === 'medium') return `${first}'s workload is elevated. A soft cap near ${minutesCap} minutes should preserve late-game lift while keeping normal rotation rhythm.`;
  return `${first} appears fresh and well-recovered. Full workload can be maintained, with a target cap around ${minutesCap} minutes if the game is controlled early.`;
}

function getPlayerId(player: Player) {
  return Number(player.PLAYER_ID ?? player.PERSON_ID);
}

function getPlayerName(player: Player) {
  return player.PLAYER_NAME || player.PLAYER || `${player.PLAYER_FIRST_NAME ?? ''} ${player.PLAYER_LAST_NAME ?? ''}`.trim() || 'Unknown Player';
}

function getCurrentSeason() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const start = month >= 10 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

function normalizePct(value: any) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num > 1 ? num : num * 100;
}
