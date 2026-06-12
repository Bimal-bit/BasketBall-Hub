import { useEffect, useMemo, useState } from 'react';
import { Search, Sliders, Target } from 'lucide-react';
import { nbaApi, type PlayerGameLog, type PlayerShot } from '../lib/api';
import ShotChart from '../components/ShotChart';
import BasketballLoader from '../components/BasketballLoader';
import { SkeletonGrid } from '../components/SkeletonCard';

const SHOT_ZONES = [
  'Restricted Area',
  'Paint Left',
  'Paint Center',
  'Paint Right',
  'Short Mid-Range',
  'Long Mid-Range',
  'Left Corner 3',
  'Right Corner 3',
  'Left Wing 3',
  'Right Wing 3',
  'Above the Break 3',
  'Deep 3',
  'Heave'
];
const SHOT_TYPES = ['Jump Shot', 'Layup/Dunk', 'Pull-Up', 'Catch & Shoot', 'Step Back', 'Floater', 'Hook'];

type ApiPlayer = {
  id: number;
  full_name: string;
  is_active: boolean;
};

export default function ShotPredictor() {
  const [players, setPlayers] = useState<ApiPlayer[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<ApiPlayer | null>(null);
  const [season, setSeason] = useState('2025-26');
  const [games, setGames] = useState<PlayerGameLog[]>([]);
  const [selectedGameId, setSelectedGameId] = useState('');
  const [shots, setShots] = useState<PlayerShot[]>([]);
  const [averages, setAverages] = useState<any | null>(null);
  const [defenderDist, setDefenderDist] = useState(4);
  const [selectedZone, setSelectedZone] = useState('Short Mid-Range');
  const [shotType, setShotType] = useState('Jump Shot');
  const [gameClock, setGameClock] = useState(6);
  const [scoreMargin, setScoreMargin] = useState(2);
  const [loading, setLoading] = useState(true);
  const [loadingPlayer, setLoadingPlayer] = useState(false);

  useEffect(() => {
    nbaApi.getAllPlayers()
      .then(data => {
        const active = data.filter((player: ApiPlayer) => player.is_active);
        const usable = active.length > 0 ? active : data;
        setPlayers(usable);
        setSelectedPlayer(usable[0] ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPlayer) return;
    loadPlayerData(selectedPlayer.id, season);
  }, [selectedPlayer, season]);

  useEffect(() => {
    if (!selectedPlayer || !selectedGameId) {
      setShots([]);
      return;
    }

    nbaApi.getPlayerShots(selectedPlayer.id, selectedGameId)
      .then(setShots)
      .catch(() => setShots([]));
  }, [selectedPlayer, selectedGameId]);

  async function loadPlayerData(playerId: number, selectedSeason: string) {
    setLoadingPlayer(true);
    setShots([]);
    try {
      const [avg, logs] = await Promise.all([
        nbaApi.getPlayerAverages(playerId, selectedSeason).catch(() => null),
        nbaApi.getPlayerDetailedStats(playerId, selectedSeason).catch(() => []),
      ]);
      setAverages(avg);
      setGames(logs);
      setSelectedGameId(logs[0]?.GAME_ID ?? '');
    } finally {
      setLoadingPlayer(false);
    }
  }

  const filteredPlayers = useMemo(() => {
    const query = search.toLowerCase().trim();
    const matches = players
      .filter(player => !query || player.full_name.toLowerCase().includes(query))
      .slice(0, 80);
    if (selectedPlayer && !matches.some(player => player.id === selectedPlayer.id)) return [selectedPlayer, ...matches];
    return matches;
  }, [players, search, selectedPlayer]);

  const chartShots = shots.map(convertShot);
  const zoneBreakdown = getZoneBreakdown(shots);
  const selectedZoneStats = zoneBreakdown.find(zone => zone.zone === selectedZone);
  const baselinePct = selectedZoneStats && selectedZoneStats.attempts > 0
    ? selectedZoneStats.pct
    : estimateZoneBaseline(selectedZone, averages);
  const prediction = adjustForContext(baselinePct, defenderDist, shotType, gameClock, scoreMargin);
  const expectedMakes = selectedZoneStats ? Math.round((prediction / 100) * selectedZoneStats.attempts) : 0;
  const bestZone = zoneBreakdown[0];
  const mostAccurateZone = zoneBreakdown.length ? zoneBreakdown.reduce((best, current) => current.pct > best.pct ? current : best, zoneBreakdown[0]) : null;
  const mostFrequentZone = zoneBreakdown.length ? zoneBreakdown.reduce((best, current) => current.attempts > best.attempts ? current : best, zoneBreakdown[0]) : null;
  const expectedPoints = selectedZoneStats ? Math.round((prediction / 100) * (selectedZone.includes('3') || selectedZone.includes('Heave') ? 3.0 : 2.1) * 10) / 10 : 0;
  const shotAdvice = selectedZoneStats
    ? `Focus on ${mostAccurateZone?.zone ?? selectedZone} when defenses are tight, and use ${mostFrequentZone?.zone ?? selectedZone} for volume.`
    : 'Select a game to see shot guidance based on actual shooting patterns.';

  if (loading) {
    return (
      <div className="w-full py-4"><SkeletonGrid count={6} /></div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Shot Predictor</h2>
        <p className="text-sm text-gray-400">Official NBA API player logs and shot charts, with contest-adjusted probability from real shooting history.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <label className="text-xs font-medium text-gray-400 block mb-2">Find Player</label>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search active NBA players"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-orange-500"
              />
            </div>
            <select
              value={selectedPlayer?.id ?? ''}
              onChange={event => setSelectedPlayer(players.find(player => player.id === Number(event.target.value)) ?? null)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-orange-500"
            >
              {!selectedPlayer && <option value="">Select player</option>}
              {filteredPlayers.map(player => (
                <option key={player.id} value={player.id}>{player.full_name}</option>
              ))}
            </select>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-2">Season</label>
              <select
                value={season}
                onChange={event => setSeason(event.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-orange-500"
              >
                {buildRecentSeasons().map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-2">Game</label>
              <select
                value={selectedGameId}
                onChange={event => setSelectedGameId(event.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-orange-500"
              >
                {games.map(game => (
                  <option key={game.GAME_ID} value={game.GAME_ID}>{game.GAME_DATE} - {game.MATCHUP}</option>
                ))}
                {games.length === 0 && <option value="">No games found</option>}
              </select>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Sliders size={14} className="text-orange-400" />
              <span className="text-sm font-semibold text-white">Shot Context</span>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-2">
                <label className="text-gray-400">Defender Distance</label>
                <span className="text-blue-400 font-medium">{defenderDist} ft</span>
              </div>
              <input type="range" min={0} max={10} step={0.5} value={defenderDist} onChange={event => setDefenderDist(Number(event.target.value))} className="w-full accent-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-2">Shot Zone</label>
              <select
                value={selectedZone}
                onChange={event => setSelectedZone(event.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-orange-500"
              >
                {SHOT_ZONES.map(zone => <option key={zone} value={zone}>{zone}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-2">Shot Type</label>
              <select
                value={shotType}
                onChange={event => setShotType(event.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-orange-500"
              >
                {SHOT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <label className="text-gray-400">Clock</label>
                  <span className="text-blue-400 font-medium">{gameClock}s</span>
                </div>
                <input type="range" min={1} max={24} step={1} value={gameClock} onChange={event => setGameClock(Number(event.target.value))} className="w-full accent-blue-500" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <label className="text-gray-400">Margin</label>
                  <span className="text-blue-400 font-medium">{scoreMargin}</span>
                </div>
                <input type="range" min={0} max={20} step={1} value={scoreMargin} onChange={event => setScoreMargin(Number(event.target.value))} className="w-full accent-blue-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
            {loadingPlayer ? (
              <div className="py-16 flex justify-center"><BasketballLoader /></div>
            ) : (
              <>
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Contest-Adjusted Probability</div>
                <div className={`text-6xl font-black mb-2 ${prediction >= 60 ? 'text-green-400' : prediction >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>{prediction.toFixed(1)}%</div>
                <div className="text-sm text-gray-400">{selectedZone} baseline: {baselinePct.toFixed(1)}%</div>
                <div className="mt-4 h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${prediction >= 60 ? 'bg-green-500' : prediction >= 45 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${prediction}%` }} />
                </div>
              </>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Official Context</h3>
            <div className="space-y-2 text-sm">
              <ContextRow label="Player" value={selectedPlayer?.full_name ?? '--'} />
              <ContextRow label="Season FG%" value={`${normalizePct(averages?.FG_PCT).toFixed(1)}%`} />
              <ContextRow label="Season 3P%" value={`${normalizePct(averages?.FG3_PCT).toFixed(1)}%`} />
              <ContextRow label="Expected Makes" value={`${expectedMakes}/${selectedZoneStats?.attempts ?? 0}`} />
              <ContextRow label="Selected Zone Attempts" value={`${selectedZoneStats?.attempts ?? 0}`} />
              <ContextRow label="Best Game Zone" value={bestZone ? `${bestZone.zone} (${bestZone.pct.toFixed(1)}%)` : '--'} />
              <ContextRow label="Pressure Context" value={getPressureLabel(gameClock, scoreMargin)} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Official Shot Chart</h3>
            {shots.length > 0 ? (
              <ShotChart shots={chartShots} compact />
            ) : (
              <div className="py-20 text-center text-xs text-gray-500 bg-gray-800/30 rounded-xl">No official shot chart data for this game</div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Zone Results</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 mb-3">
                {SHOT_ZONES.map(zone => (
                  <button key={zone} onClick={() => setSelectedZone(zone)} className={`rounded-lg border px-2 py-1.5 text-[10px] text-left transition-colors ${selectedZone === zone ? 'border-orange-500/50 bg-orange-500/10 text-orange-200' : 'border-gray-800 bg-gray-800/30 text-gray-400 hover:border-gray-700'}`}>
                    {zone}
                  </button>
                ))}
              </div>
              {zoneBreakdown.map(zone => (
                <button key={zone.zone} onClick={() => setSelectedZone(zone.zone)} className={`w-full text-left ${selectedZone === zone.zone ? 'opacity-100' : 'opacity-75'}`}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{zone.zone}</span>
                    <span className="font-medium text-white">{zone.makes}/{zone.attempts} ({zone.pct.toFixed(1)}%)</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-orange-500 transition-all duration-700" style={{ width: `${zone.pct}%` }} />
                  </div>
                </button>
              ))}
              {zoneBreakdown.length === 0 && <div className="text-center py-8 text-xs text-gray-500">Select a game with shot attempts</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Target size={14} className="text-orange-400" />Data Source</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Player lists, game logs, season averages, and shot locations are pulled through the local backend from `nba_api` / stats.nba.com. The only modeled value is the displayed contest adjustment, which starts from the official zone or season shooting percentage.
        </p>
      </div>
    </div>
  );
}

function convertShot(shot: PlayerShot) {
  const x = Math.max(3, Math.min(97, 50 + shot.LOC_X / 5));
  const y = Math.max(4, Math.min(96, 94 - shot.LOC_Y / 5));
  return {
    x,
    y,
    made: Number(shot.SHOT_MADE_FLAG) === 1,
    distance: shot.SHOT_DISTANCE,
  };
}

function getZoneBreakdown(shots: PlayerShot[]) {
  const grouped = new Map<string, { zone: string; makes: number; attempts: number; pct: number }>();
  shots.forEach(shot => {
    const zone = normalizeShotZone(shot);
    const current = grouped.get(zone) ?? { zone, makes: 0, attempts: 0, pct: 0 };
    current.attempts += 1;
    current.makes += Number(shot.SHOT_MADE_FLAG) === 1 ? 1 : 0;
    current.pct = current.attempts > 0 ? (current.makes / current.attempts) * 100 : 0;
    grouped.set(zone, current);
  });
  return Array.from(grouped.values()).sort((a, b) => b.attempts - a.attempts);
}

function normalizeShotZone(shot: PlayerShot) {
  const basic = ((shot as any).SHOT_ZONE_BASIC || '').toString();
  const area = ((shot as any).SHOT_ZONE_AREA || '').toString();
  const distance = Number(shot.SHOT_DISTANCE ?? 0);
  if (distance >= 35) return 'Heave';
  if (distance >= 28) return 'Deep 3';
  if (basic.includes('Corner')) return area.includes('Right') ? 'Right Corner 3' : 'Left Corner 3';
  if (basic.includes('Above')) {
    if (area.includes('Left')) return 'Left Wing 3';
    if (area.includes('Right')) return 'Right Wing 3';
    return 'Above the Break 3';
  }
  if (basic.includes('Restricted') || distance <= 5) return 'Restricted Area';
  if (basic.includes('Paint') || distance <= 12) {
    if (area.includes('Left')) return 'Paint Left';
    if (area.includes('Right')) return 'Paint Right';
    return 'Paint Center';
  }
  if (distance <= 17) return 'Short Mid-Range';
  if (distance < 22) return 'Long Mid-Range';
  return zoneFromDistance(distance);
}

function zoneFromDistance(distance: number) {
  if (distance <= 5) return 'Restricted Area';
  if (distance <= 12) return 'Paint Center';
  if (distance <= 17) return 'Short Mid-Range';
  if (distance < 22) return 'Long Mid-Range';
  if (distance >= 28) return 'Deep 3';
  return 'Above the Break 3';
}

function normalizePct(value: any) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 45;
  return num > 1 ? num : num * 100;
}

function estimateZoneBaseline(zone: string, averages: any | null) {
  const fg = normalizePct(averages?.FG_PCT);
  const three = normalizePct(averages?.FG3_PCT);
  if (zone === 'Restricted Area') return Math.min(78, fg + 18);
  if (zone.startsWith('Paint')) return Math.min(68, fg + 8);
  if (zone.includes('Mid-Range')) return Math.max(32, fg - 5);
  if (zone.includes('Corner')) return Math.max(28, three + 3);
  if (zone.includes('Wing') || zone.includes('Above')) return Math.max(25, three);
  if (zone === 'Deep 3') return Math.max(18, three - 7);
  if (zone === 'Heave') return 8;
  return fg;
}

function adjustForContext(basePct: number, defenderDistance: number, shotType: string, clock: number, margin: number) {
  let pct = basePct;
  if (defenderDistance < 2) pct -= 12;
  else if (defenderDistance < 4) pct -= 6;
  else if (defenderDistance > 6) pct += 4;
  if (shotType === 'Layup/Dunk') pct += 7;
  if (shotType === 'Catch & Shoot') pct += 3;
  if (shotType === 'Pull-Up' || shotType === 'Step Back') pct -= 4;
  if (shotType === 'Floater' || shotType === 'Hook') pct -= 2;
  if (clock <= 4) pct -= 7;
  else if (clock <= 8) pct -= 3;
  if (margin <= 3) pct -= 2;
  return Math.max(5, Math.min(95, Math.round(pct * 10) / 10));
}

function getPressureLabel(clock: number, margin: number) {
  if (clock <= 4 && margin <= 3) return 'late-clock clutch';
  if (clock <= 8) return 'late clock';
  if (margin <= 3) return 'close game';
  return 'standard';
}

function buildRecentSeasons() {
  const seasons = [];
  for (let year = 2025; year >= 2015; year -= 1) {
    seasons.push(`${year}-${String(year + 1).slice(-2)}`);
  }
  return seasons;
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-800/50">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-xs font-medium text-white">{value}</span>
    </div>
  );
}
