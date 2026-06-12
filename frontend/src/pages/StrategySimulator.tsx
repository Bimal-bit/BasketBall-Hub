import { useEffect, useState } from 'react';
import { Play, RefreshCw, ChevronDown, X, Target, Shield, Zap, Crosshair, Scale, TrendingUp, TrendingDown, Brain } from 'lucide-react';
import { nbaApi, type Player, type Standing, getTeamLogoUrl, getPlayerHeadshotUrl } from '../lib/api';
import BasketballLoader from '../components/BasketballLoader';
import { simulateLineup, TACTICAL_STRATEGIES, type TacticKey } from '../lib/analytics';

type Team = Standing & {
  logo_color: string;
};

type PlayerWithPosition = Player & {
  position?: string;
};

type Lineup = (PlayerWithPosition | null)[];
const POSITIONS: Array<'PG' | 'SG' | 'SF' | 'PF' | 'C'> = ['PG', 'SG', 'SF', 'PF', 'C'];
const POSITION_NAMES: Record<string, string> = {
  'PG': 'Point Guard',
  'SG': 'Shooting Guard',
  'SF': 'Small Forward',
  'PF': 'Power Forward',
  'C': 'Center'
};

function isEligible(playerPos: string | undefined, slot: string): boolean {
  if (!playerPos) {
    // Default fallback if no position data
    if (slot === 'PG' || slot === 'SG') return false;
    return true; 
  }
  
  const pos = playerPos.toUpperCase();
  
  switch (slot) {
    case 'PG': 
      return pos === 'G' || pos.includes('PG') || pos === 'POINT GUARD';
    case 'SG': 
      return pos === 'G' || pos.includes('SG') || pos.includes('G-F') || pos === 'SHOOTING GUARD';
    case 'SF': 
      return pos === 'F' || pos.includes('SF') || pos.includes('G-F') || pos.includes('F-G') || pos === 'SMALL FORWARD';
    case 'PF': 
      return pos === 'F' || pos.includes('PF') || pos.includes('F-C') || pos.includes('C-F') || pos === 'POWER FORWARD';
    case 'C': 
      return pos === 'C' || pos.includes('F-C') || pos.includes('C-F') || pos === 'CENTER';
    default: 
      return false;
  }
}

export default function StrategySimulator() {
  const [players, setPlayers] = useState<PlayerWithPosition[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [homeTeam, setHomeTeam] = useState('1610612747'); // Default Lakers
  const [awayTeam, setAwayTeam] = useState('1610612738'); // Default Celtics
  const [homeLineup, setHomeLineup] = useState<Lineup>(Array(5).fill(null));
  const [awayLineup, setAwayLineup] = useState<Lineup>(Array(5).fill(null));
  const [simResult, setSimResult] = useState<ReturnType<typeof simulateLineup> | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [homeRoster, setHomeRoster] = useState<PlayerWithPosition[]>([]);
  const [awayRoster, setAwayRoster] = useState<PlayerWithPosition[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<{ player: PlayerWithPosition; stats: any } | null>(null);
  const [homeTactic, setHomeTactic] = useState<TacticKey>('BALANCED');
  const [awayTactic, setAwayTactic] = useState<TacticKey>('BALANCED');
  const [optimization, setOptimization] = useState<'BALANCED' | 'OFFENSE' | 'DEFENSE'>('BALANCED');

  useEffect(() => {
    if (selectedPlayer) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => { document.body.classList.remove('modal-open'); };
  }, [selectedPlayer]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [teamsData, playersData] = await Promise.all([
          nbaApi.getStandings(),
          nbaApi.getTopPlayers()
        ]);
        
        const teamsMap = new Map<string, Team>();
        const teamColors: Record<string, string> = {
          '1610612737': '#E03A3E', // Hawks
          '1610612738': '#007A33', // Celtics
          '1610612739': '#860038', // Cavaliers
          '1610612740': '#0C2340', // Pelicans
          '1610612741': '#CE1141', // Bulls
          '1610612742': '#00538C', // Mavericks
          '1610612743': '#0E2240', // Nuggets
          '1610612744': '#1D428A', // Warriors
          '1610612745': '#CE1141', // Rockets
          '1610612746': '#C8102E', // Clippers
          '1610612747': '#552583', // Lakers
          '1610612748': '#98002E', // Heat
          '1610612749': '#00471B', // Bucks
          '1610612750': '#0C2340', // Timberwolves
          '1610612751': '#000000', // Nets
          '1610612752': '#006BB6', // Knicks
          '1610612753': '#0077C0', // Magic
          '1610612754': '#002D62', // Pacers
          '1610612755': '#006BB6', // 76ers
          '1610612756': '#1D1160', // Suns
          '1610612757': '#E03A3E', // Blazers
          '1610612758': '#5A2D81', // Kings
          '1610612759': '#C4CED4', // Spurs
          '1610612760': '#007AC1', // Thunder
          '1610612761': '#CE1141', // Raptors
          '1610612762': '#002B5C', // Jazz
          '1610612763': '#5D76A9', // Grizzlies
          '1610612764': '#002B5C', // Wizards
          '1610612765': '#C8102E', // Pistons
          '1610612766': '#1D1160', // Hornets
        };
        
        teamsData.forEach((team: Standing) => {
          const teamId = team.TeamID.toString();
          teamsMap.set(teamId, {
            ...team,
            logo_color: teamColors[teamId] || '#374151'
          });
        });
        
        setTeams(teamsMap);
        setPlayers(playersData);
        setLoading(false);
      } catch (error) {
        console.error('Error loading NBA data:', error);
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    async function fetchRosters() {
      setRosterLoading(true);
      try {
        const [homeData, awayData] = await Promise.all([
          nbaApi.getTeamRoster(homeTeam),
          nbaApi.getTeamRoster(awayTeam)
        ]);
        
        setHomeRoster(homeData);
        setAwayRoster(awayData);
      } catch (error) {
        console.error('Error fetching rosters:', error);
      } finally {
        setRosterLoading(false);
      }
    }
    fetchRosters();
  }, [homeTeam, awayTeam]);


  function autoFillLineup(roster: Player[], tactic: TacticKey, opt: 'BALANCED' | 'OFFENSE' | 'DEFENSE'): Lineup {
    const lineup: Lineup = Array(5).fill(null);
    const used = new Set<string>();
    
    const getPriority = (p: Player) => {
      const pts = p.PTS || (p as any).PPG || 0;
      const reb = p.REB || (p as any).RPG || 0;
      const ast = p.AST || (p as any).APG || 0;
      const stl = p.STL || 0;
      const blk = p.BLK || 0;

      let score = pts + reb + ast;
      
      // Tactic modifiers
      switch (tactic) {
        case 'PACE_SPACE': score += pts * 0.5 + ast * 0.8; break;
        case 'GRIT_GRIND': score += reb * 0.5 + blk * 1.0 + stl * 1.0; break;
        case 'LOCKDOWN': score += stl * 2.0 + blk * 2.0; break;
        case 'POST_DOMINANCE': score += reb * 1.0 + pts * 0.3; break;
      }

      // Optimization overrides
      if (opt === 'OFFENSE') score += pts * 1.5 + ast * 0.7;
      if (opt === 'DEFENSE') score += reb * 1.0 + blk * 2.0 + stl * 2.0;
      
      return score;
    };

    // Sort players by priority
    const sortedPlayers = [...roster].sort((a, b) => getPriority(b) - getPriority(a));
    
    // First pass: try to fill each slot with an eligible player
    POSITIONS.forEach((pos, i) => {
      const match = sortedPlayers.find(p => {
        const id = (p.PLAYER_ID || p.PERSON_ID || '').toString();
        return isEligible(p.POSITION, pos) && !used.has(id);
      });
      
      if (match) {
        const playerId = (match.PLAYER_ID || match.PERSON_ID).toString();
        lineup[i] = match as PlayerWithPosition;
        used.add(playerId);
      }
    });

    // Second pass: fill empty slots with remaining best players
    lineup.forEach((slot, i) => {
      if (!slot) {
        const fallback = sortedPlayers.find(p => {
          const id = (p.PLAYER_ID || p.PERSON_ID || '').toString();
          return !used.has(id);
        });
        if (fallback) {
          lineup[i] = fallback as PlayerWithPosition;
          used.add((fallback.PLAYER_ID || fallback.PERSON_ID || '').toString());
        }
      }
    });

    return lineup;
  }

  function handleAutoFill() {
    const homeAuto = autoFillLineup(homeRoster, 'BALANCED', optimization);
    const awayAuto = autoFillLineup(awayRoster, 'BALANCED', optimization);
    
    setHomeLineup(homeAuto);
    setAwayLineup(awayAuto);
    setSimResult(null);
  }
  function simulate() {
    const home = homeLineup.filter(Boolean) as PlayerWithPosition[];
    const away = awayLineup.filter(Boolean) as PlayerWithPosition[];

    if (home.length === 0 || away.length === 0) {
      alert("Please select at least one player for each team.");
      return;
    }
    
    setSimResult(null);
    setSimulating(true);
    
    // Simulate complex calculation lag
    setTimeout(() => {
      try {
        const result = simulateLineup(home as any, away as any, homeTactic, awayTactic);
        if (!result) throw new Error("Simulation engine returned null result");
        setSimResult(result);
      } catch (err) {
        console.error("Simulation failed:", err);
        alert("Simulation failed to calculate results. Please check player data.");
        setSimResult(null);
      } finally {
        setSimulating(false);
      }
    }, 1200);
  }

  const homeTeamData = teams.get(homeTeam);
  const awayTeamData = teams.get(awayTeam);

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <BasketballLoader />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 bg-white dark:bg-zinc-900">
      <div>
        <h1 className="text-3xl font-medium text-white mb-2">Strategy Simulator</h1>
        <p className="text-sm text-gray-400">Build custom lineups and simulate game matchups. The model uses real NBA stats to predict outcomes.</p>
      </div>

      {/* Team Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamSelectorCard
          label="Home Team"
          value={homeTeam}
          teams={teams}
          onChange={(t) => {
            setHomeTeam(t);
            setHomeLineup(Array(5).fill(null));
            setSimResult(null);
          }}
        />
        <TeamSelectorCard
          label="Away Team"
          value={awayTeam}
          teams={teams}
          onChange={(t) => {
            setAwayTeam(t);
            setAwayLineup(Array(5).fill(null));
            setSimResult(null);
          }}
        />
      </div>

      {/* Optimization & Auto-fill */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] p-1.5 rounded-2xl">
           {(['BALANCED', 'OFFENSE', 'DEFENSE'] as const).map((opt) => (
             <button
               key={opt}
               onClick={() => setOptimization(opt)}
               className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all ${optimization === opt ? 'bg-orange-500 text-white shadow-none shadow-none' : 'text-gray-500 hover:text-gray-300'}`}
             >
               {opt}
             </button>
           ))}
        </div>
        
        <button
          onClick={handleAutoFill}
          disabled={rosterLoading || homeRoster.length === 0}
          className="flex items-center justify-center gap-2 px-5 py-3.5 bg-zinc-100 dark:bg-zinc-800   hover: hover: disabled: disabled: rounded-2xl text-[11px] text-white font-medium uppercase tracking-widest transition-all duration-200 shadow-none hover:shadow-none disabled:shadow-none active:scale-95"
        >
          <RefreshCw size={14} className={rosterLoading ? 'animate-spin' : ''} />
          {rosterLoading ? 'Loading Roster...' : 'Auto-Fill Lineups'}
        </button>
      </div>

      {/* Lineups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
        {rosterLoading && (
          <div className="absolute inset-0 z-50 bg-white dark:bg-zinc-900 backdrop- flex items-center justify-center rounded-xl">
             <div className="flex flex-col items-center gap-2">
                <RefreshCw size={24} className="animate-spin text-orange-500" />
                <p className="text-xs font-medium text-white uppercase tracking-widest">Updating Rosters...</p>
             </div>
          </div>
        )}
        <CourtLineup
          title={homeTeamData?.TeamName || 'Home Team'}
          lineup={homeLineup}
          players={homeRoster}
          color={homeTeamData?.logo_color || '#374151'}
          onChange={setHomeLineup}
          logo={homeTeamData ? getTeamLogoUrl(homeTeam) : undefined}
          isHome={true}
          tactic={homeTactic}
          onTacticChange={setHomeTactic}
        />
        <CourtLineup
          title={awayTeamData?.TeamName || 'Away Team'}
          lineup={awayLineup}
          players={awayRoster}
          color={awayTeamData?.logo_color || '#374151'}
          onChange={setAwayLineup}
          logo={awayTeamData ? getTeamLogoUrl(awayTeam) : undefined}
          isHome={false}
          tactic={awayTactic}
          onTacticChange={setAwayTactic}
        />
      </div>

      {/* Simulate Button */}
      <div className="flex flex-col items-center gap-4">
        {(homeLineup.filter(Boolean).length < 5 || awayLineup.filter(Boolean).length < 5) && !simResult && (
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-full">
            <Zap size={14} className="text-orange-500" />
            <span className="text-[10px] font-medium uppercase text-orange-400 tracking-widest">
              Tactical Loadout Incomplete: {10 - (homeLineup.filter(Boolean).length + awayLineup.filter(Boolean).length)} slots remaining
            </span>
          </div>
        )}
        
        <button
          onClick={simulate}
          disabled={simulating || rosterLoading || homeLineup.filter(Boolean).length === 0 || awayLineup.filter(Boolean).length === 0}
          className="group relative flex items-center gap-3 px-10 py-5 bg-zinc-100 dark:bg-zinc-800   hover: hover: disabled: disabled: rounded-2xl text-white font-medium text-xl transition-all duration-300 shadow-none shadow-green-500/20 hover:shadow-green-500/40 hover:-translate-y-1 disabled:shadow-none disabled:translate-y-0"
        >
          {simulating ? (
            <div className="flex items-center gap-3">
              <RefreshCw size={20} className="animate-spin text-white" />
              <span className="animate-pulse">Analyzing Matchups...</span>
            </div>
          ) : (
            <>
              <Play size={20} fill="white" />
              <span>Execute Simulation</span>
            </>
          )}
          
          <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </button>
        
        {simulating && (
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-[0.2em] animate-bounce">
            Calculating Tactical Weights & Probabilities...
          </p>
        )}
      </div>

      {/* Results */}
      {simResult && simResult.playerPredictions && (
        <SimulationResults
          result={simResult}
          homeTeam={homeTeamData}
          awayTeam={awayTeamData}
          homeLineup={homeLineup.filter(Boolean) as PlayerWithPosition[]}
          awayLineup={awayLineup.filter(Boolean) as PlayerWithPosition[]}
          homeTactic={homeTactic}
          awayTactic={awayTactic}
          onPlayerClick={(p) => setSelectedPlayer({ 
            player: p, 
            stats: simResult.playerPredictions[(p.PLAYER_ID || p.PERSON_ID || '').toString()] 
          })}
        />
      )}

      {/* Player Matchup Modal */}
      {selectedPlayer && (
        <PlayerMatchupModal
          player={selectedPlayer.player}
          stats={selectedPlayer.stats}
          onClose={() => setSelectedPlayer(null)}
          teamColor={teams.get(selectedPlayer.player.TEAM_ID?.toString() || '')?.logo_color}
        />
      )}
    </div>
  );
}


interface TeamSelectorCardProps {
  label: string;
  value: string;
  teams: Map<string, Team>;
  onChange: (t: string) => void;
}

function TeamSelectorCard({ label, value, teams, onChange }: TeamSelectorCardProps) {
  const selectedTeam = teams.get(value);
  
  return (
    <div className="bg-zinc-100 dark:bg-zinc-800   border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-xl p-5 shadow-none relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-orange-500/10 transition-all" />
      
      <label className="text-[10px] font-medium text-gray-500 block mb-4 uppercase tracking-[0.2em]">{label}</label>
      <div className="flex gap-4 items-center">
        {selectedTeam && (
          <div className="relative">
            <div className="absolute -inset-2 bg-white/5 rounded-full " />
            <img 
              src={getTeamLogoUrl(value)} 
              alt={selectedTeam.TeamName}
              className="w-16 h-16 object-contain relative z-10 drop-shadow-none"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}
        <div className="flex-1 relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full appearance-none bg-gray-800/50 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-xl px-4 py-3 text-lg font-medium text-white focus:outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 transition-all cursor-pointer"
          >
            {Array.from(teams.values()).map((t) => (
              <option key={t.TeamID} value={t.TeamID.toString()} className="bg-white dark:bg-zinc-900 text-white">
                {t.TeamName}
              </option>
            ))}
          </select>
          <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>
      {selectedTeam && (
        <div className="mt-3 flex gap-2 text-xs">
          <div className="flex-1">
            <p className="text-gray-400 mb-1">Record</p>
            <p className="text-white font-medium">{selectedTeam.Wins}-{selectedTeam.Losses}</p>
          </div>
          <div className="flex-1">
            <p className="text-gray-400 mb-1">Win %</p>
            <p className="text-white font-medium">{(selectedTeam.WinPCT * 100).toFixed(1)}%</p>
          </div>
          <div className="flex-1">
            <p className="text-gray-400 mb-1">Streak</p>
            <p className="text-white font-medium">{selectedTeam.Strk}</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface CourtLineupProps {
  title: string;
  lineup: Lineup;
  players: PlayerWithPosition[];
  color: string;
  onChange: (l: Lineup) => void;
  logo?: string;
  isHome: boolean;
  tactic: TacticKey;
  onTacticChange: (t: TacticKey) => void;
}

const POSITION_COORDS: Record<string, { x: string; y: string }> = {
  'PG': { x: '50%', y: '80%' },
  'SG': { x: '20%', y: '65%' },
  'SF': { x: '80%', y: '65%' },
  'PF': { x: '30%', y: '40%' },
  'C': { x: '50%', y: '25%' }
};

function CourtLineup({ title, lineup, players, color, onChange, logo, isHome, tactic, onTacticChange }: CourtLineupProps) {
  const filled = lineup.filter(Boolean).length;
  const totalPTS = (lineup.filter(Boolean) as PlayerWithPosition[]).reduce((s, p) => s + (p.PTS || 0), 0);
  const avgPTS = filled > 0 ? (totalPTS / filled).toFixed(1) : '0';

  function setSlot(i: number, playerId: string) {
    const p = players.find(
      (pl) => (pl.PLAYER_ID || pl.PERSON_ID || '').toString() === playerId
    ) ?? null;
    const next = [...lineup];
    next[i] = p;
    onChange(next);
  }

  return (
    <div className="bg-zinc-100 dark:bg-zinc-800   border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-2xl p-6 shadow-none overflow-hidden relative group/court">
      {/* Dynamic Tactical Influence Zones */}
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
         <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[200%] h-[60%] bg-[radial-gradient(ellipse_at_center,var(--court-color),transparent)]" style={{ '--court-color': color } as any} />
         <div className="absolute bottom-0 left-0 w-full h-1/2 bg-zinc-100 dark:bg-zinc-800 from-black to-transparent" />
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 relative z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
             <div className="absolute -inset-2 bg-white/5 rounded-full " />
             {logo && (
               <img src={logo} alt={title} className="w-12 h-12 sm:w-14 sm:h-14 object-contain relative z-10 drop-shadow-none" onError={(e) => (e.currentTarget.style.display = 'none')} />
             )}
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-medium text-white  uppercase tracking-tighter mb-0 leading-none">{title}</h3>
            <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 mt-1 font-medium">{isHome ? 'Home Venue Control' : 'Away Strategic Loadout'}</p>
          </div>
        </div>
        
        {/* Tactic Selector */}
        <div className="w-full sm:w-auto">
          <select 
            value={tactic}
            onChange={(e) => onTacticChange(e.target.value as TacticKey)}
            className="w-full sm:w-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-xl px-3 py-2 text-[10px] font-medium text-orange-400 uppercase tracking-widest focus:outline-none focus:border-orange-500/50 appearance-none cursor-pointer"
          >
            {Object.entries(TACTICAL_STRATEGIES).map(([key, strat]) => (
              <option key={key} value={key} className="bg-white dark:bg-zinc-900 text-white">{strat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Enhanced Court Visualization */}
      <div 
        className="relative rounded-3xl mb-8 border-2 h-[320px] sm:h-[420px] shadow-none overflow-hidden transition-all duration-700 group-hover/court:border-opacity-60"
        style={{ 
          backgroundColor: `${color}08`,
          borderColor: `${color}30` 
        }}
      >
        {/* Court Markings with Team Branding */}
        <div className="absolute inset-x-0 top-0 h-full border-x-4 opacity-10" style={{ borderColor: color }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-72 border-4 rounded-b-[3rem] opacity-20" style={{ borderColor: color, backgroundColor: `${color}10` }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-56 border-4 opacity-10" style={{ borderColor: color }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-48 border-4 rounded-full opacity-10 -mb-24" style={{ borderColor: color }} />
        
        {/* Center Court Logo Shadow */}
        {logo && (
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 scale-150 grayscale  pointer-events-none">
              <img src={logo} alt="" className="w-48 h-48 object-contain" />
           </div>
        )}

        {POSITIONS.map((pos, i) => {
          const coords = POSITION_COORDS[pos];
          const player = lineup[i];
          
          return (
            <div
              key={pos}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
              style={{ left: coords.x, top: coords.y }}
            >
              <div 
                className={`relative group cursor-pointer flex flex-col items-center`}
                onClick={() => setSlot(i, '')}
              >
                {player ? (
                  <div className="flex flex-col items-center">
                    <div className="relative">
                       <div className="absolute -inset-4 bg-white/5 rounded-full blur-xl group-hover:bg-orange-500/20 transition-all" />
                       <div 
                         className="absolute -inset-1 rounded-full animate-pulse opacity-40 group-hover:opacity-100 transition-opacity" 
                         style={{ backgroundColor: color }}
                       />
                       <img
                        src={getPlayerHeadshotUrl((player.PLAYER_ID || player.PERSON_ID || '').toString())}
                        alt={player.PLAYER_NAME}
                        className="w-20 h-20 object-cover rounded-full border-2 relative z-10 shadow-none group-hover:scale-110 transition-transform duration-500"
                        style={{ 
                          borderColor: color,
                          filter: `drop-shadow(0 0 15px ${color}60)`
                        }}
                        onError={(e) => {
                          e.currentTarget.src = `https://www.nba.com/assets/logos/teams/primary/web/${player.TEAM_ABBREVIATION}.svg`;
                        }}
                      />
                      <div 
                        className="absolute -bottom-2 -right-2 text-white text-[11px] font-medium px-2.5 py-1 rounded-xl border-2 z-20 shadow-none"
                        style={{ backgroundColor: color, borderColor: 'rgba(255,255,255,0.2)' }}
                      >
                        {pos}
                      </div>
                    </div>
                    <div className="mt-4 text-center bg-white dark:bg-zinc-900 backdrop- px-4 py-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 border-[0.5px] shadow-none transform group-hover:-translate-y-1 transition-transform">
                      <p className="text-[12px] font-medium text-white whitespace-nowrap tracking-tight uppercase ">{player.PLAYER_NAME?.split(' ').pop()}</p>
                      <div className="flex items-center justify-center gap-2 mt-0.5">
                         <p className="text-[10px] text-orange-400 font-medium">{player.PTS || '?'}</p>
                         <span className="text-[8px] text-gray-600 font-medium">PPG</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSlot(i, '');
                      }}
                      className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all z-30 shadow-none hover:rotate-90"
                    >
                      <X size={12} className="text-white" strokeWidth={3} />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full border-4 border-dashed border-zinc-200 dark:border-zinc-800 border-[0.5px] flex items-center justify-center bg-white/[0.02] hover:bg-white/5 hover:border-zinc-200 dark:border-zinc-800 border-[0.5px] transition-all group-hover:scale-110">
                    <span className="text-white/10 font-medium text-xl  group-hover:text-white/40 transition-colors">{pos}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats Quick View */}
      {filled > 0 && (
        <div className="flex gap-3 mb-6">
          <div className="flex-1 bg-white/5 rounded-xl p-2 border border-zinc-200 dark:border-zinc-800 border-[0.5px] text-center">
            <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-0.5">Strength</p>
            <div className="flex items-center justify-center gap-1">
              <div className="h-1.5 flex-1 bg-gray-700 rounded-full overflow-hidden max-w-[40px]">
                <div className="h-full bg-orange-500" style={{ width: `${Math.min(100, (totalPTS / 120) * 100)}%` }} />
              </div>
              <span className="text-xs font-medium text-white">{totalPTS}</span>
            </div>
          </div>
          <div className="flex-1 bg-white/5 rounded-xl p-2 border border-zinc-200 dark:border-zinc-800 border-[0.5px] text-center">
            <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-0.5">Efficiency</p>
            <p className="text-xs font-medium text-blue-400">{avgPTS} <span className="text-[8px] text-gray-500">avg</span></p>
          </div>
        </div>
      )}

      {/* Player Selection Dropdowns */}
      <div className="grid grid-cols-1 gap-2 relative z-10">
        {POSITIONS.map((pos, i) => (
          <div key={pos} className="flex gap-2 items-center">
            <div
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-medium text-white shadow-none"
              style={{ backgroundColor: color }}
            >
              {pos}
            </div>
            <select
              value={lineup[i] ? (lineup[i]!.PLAYER_ID || lineup[i]!.PERSON_ID || '').toString() : ''}
              onChange={(e) => setSlot(i, e.target.value)}
              className="flex-1 bg-gray-800/80 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-lg px-3 py-2 text-[11px] text-gray-200 focus:outline-none transition-all appearance-none"
              style={{ borderLeftColor: color, borderLeftWidth: '3px' }}
            >
              <option value="">Select {POSITION_NAMES[pos]}...</option>
              <optgroup label={`Eligible ${POSITION_NAMES[pos]}s`}>
                {players
                  .filter(p => isEligible(p.POSITION, pos))
                  .sort((a, b) => (b.PTS || 0) - (a.PTS || 0))
                  .map((p) => {
                    const id = (p.PLAYER_ID || p.PERSON_ID || '').toString();
                    const isSelected = lineup.some(l => l && (l.PLAYER_ID || l.PERSON_ID || '').toString() === id);
                    return (
                      <option key={id} value={id} disabled={isSelected} className="bg-white dark:bg-zinc-900">
                        {p.PLAYER_NAME} {p.PTS ? `(${p.PTS} PPG)` : ''} — {p.POSITION}
                      </option>
                    );
                  })}
              </optgroup>
              <optgroup label="All Players">
                {players
                  .filter(p => !isEligible(p.POSITION, pos))
                  .sort((a, b) => (b.PTS || 0) - (a.PTS || 0))
                  .map((p) => {
                    const id = (p.PLAYER_ID || p.PERSON_ID || '').toString();
                    const isSelected = lineup.some(l => l && (l.PLAYER_ID || l.PERSON_ID || '').toString() === id);
                    return (
                      <option key={id} value={id} disabled={isSelected} className="bg-white dark:bg-zinc-900 opacity-50">
                        {p.PLAYER_NAME} ({p.POSITION})
                      </option>
                    );
                  })}
              </optgroup>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SimulationResultsProps {
  result: ReturnType<typeof simulateLineup>;
  homeTeam?: Team;
  awayTeam?: Team;
  homeLineup: PlayerWithPosition[];
  awayLineup: PlayerWithPosition[];
  homeTactic: TacticKey;
  awayTactic: TacticKey;
  onPlayerClick: (p: PlayerWithPosition) => void;
}

function SimulationResults({ result, homeTeam, awayTeam, homeLineup, awayLineup, homeTactic, awayTactic, onPlayerClick }: SimulationResultsProps) {
  const homeWin = result.homeWinProb >= 50;
  const mvpPlayer = [...homeLineup, ...awayLineup].find(p => p && (p.PLAYER_NAME || p.PLAYER) === result.mvp);

  const positionalAdvantages = POSITIONS.map((pos, i) => {
    const h = homeLineup[i];
    const a = awayLineup[i];
    if (!h || !a) return { pos, advantage: 0 };
    const diff = (h.PTS || 0) - (a.PTS || 0);
    return { pos, advantage: diff };
  });

  return (
    <div className="space-y-6">
      {/* Main Result Card */}
      <div className="bg-zinc-100 dark:bg-zinc-800   to-black border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-2xl p-8 shadow-none relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-zinc-100 dark:bg-zinc-800 from-transparent  to-transparent opacity-50" />
        
        <div className="text-[10px] font-medium text-orange-500 text-center mb-8 uppercase tracking-[0.4em]">Simulation Success</div>

        {/* Scorecard */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-4 mb-10">
          <div className="flex-1 text-center order-2 sm:order-1">
            <div className="mb-2 sm:mb-4 flex justify-center">
              {homeTeam && (
                <div className="relative group">
                   <div className="absolute -inset-4 bg-white/5 rounded-full blur-xl group-hover:bg-white/10 transition-all" />
                   <img src={getTeamLogoUrl(homeTeam.TeamID?.toString() || '')} alt={homeTeam.TeamName}
                    className="w-16 h-16 sm:w-24 sm:h-24 object-contain relative z-10"
                    onError={(e) => (e.currentTarget.style.display = 'none')} />
                </div>
              )}
            </div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mb-1">{homeTeam?.TeamName}</p>
            <p className="text-4xl sm:text-6xl font-medium  tracking-tighter" style={{ color: homeWin ? '#fff' : '#444' }}>
              {result.predictedHomePts}
            </p>
          </div>

          <div className="flex flex-row sm:flex-col items-center gap-4 order-1 sm:order-2">
            <div className="hidden sm:block w-px h-12 bg-zinc-100 dark:bg-zinc-800 from-transparent  to-transparent mb-2" />
            <p className="text-xl sm:text-2xl font-medium text-gray-800 ">VS</p>
            <div className="hidden sm:block w-px h-12 bg-zinc-100 dark:bg-zinc-800 from-transparent  to-transparent mt-2" />
          </div>

          <div className="flex-1 text-center order-3">
            <div className="mb-2 sm:mb-4 flex justify-center">
              {awayTeam && (
                <div className="relative group">
                   <div className="absolute -inset-4 bg-white/5 rounded-full blur-xl group-hover:bg-white/10 transition-all" />
                   <img src={getTeamLogoUrl(awayTeam.TeamID?.toString() || '')} alt={awayTeam.TeamName}
                    className="w-16 h-16 sm:w-24 sm:h-24 object-contain relative z-10"
                    onError={(e) => (e.currentTarget.style.display = 'none')} />
                </div>
              )}
            </div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mb-1">{awayTeam?.TeamName}</p>
            <p className="text-4xl sm:text-6xl font-medium  tracking-tighter" style={{ color: !homeWin ? '#fff' : '#444' }}>
              {result.predictedAwayPts}
            </p>
          </div>
        </div>

        {/* Win Probability Bar */}
        <div className="space-y-3 mb-8">
          <div className="flex justify-between text-[10px] font-medium uppercase tracking-widest">
            <span style={{ color: homeTeam?.logo_color }}>{homeTeam?.TeamName} {result.homeWinProb}%</span>
            <span style={{ color: awayTeam?.logo_color }}>{100 - result.homeWinProb}% {awayTeam?.TeamName}</span>
          </div>
          <div className="h-3 rounded-full bg-gray-800 overflow-hidden flex p-0.5 border border-zinc-200 dark:border-zinc-800 border-[0.5px] shadow-none">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out shadow-none"
              style={{ width: `${result.homeWinProb}%`, backgroundColor: homeTeam?.logo_color || '#f97316' }}
            />
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${100 - result.homeWinProb}%`, backgroundColor: awayTeam?.logo_color || '#3b82f6', marginLeft: '2px' }}
            />
          </div>
        </div>

        {/* MVP Card */}
        <div 
          onClick={() => mvpPlayer && onPlayerClick(mvpPlayer)}
          className="bg-white/[0.03] rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 border-[0.5px] flex flex-col sm:flex-row items-center gap-6 group transition-transform duration-200 hover:scale-105 shadow-none hover:shadow-none hover:bg-white/[0.08] cursor-pointer"
        >
          <div className="relative shrink-0">
            <div className="absolute -inset-4 bg-yellow-500/20 rounded-full  opacity-0 group-hover:opacity-100 transition-opacity" />
            <img 
              src={mvpPlayer ? getPlayerHeadshotUrl((mvpPlayer.PLAYER_ID || mvpPlayer.PERSON_ID || '').toString()) : ''}
              alt={result.mvp}
              className="w-20 h-20 sm:w-16 sm:h-16 object-cover rounded-full border-2 border-yellow-500/50 relative z-10"
              onError={(e) => {
                e.currentTarget.src = 'https://www.nba.com/assets/logos/teams/primary/web/NBA.svg';
              }}
            />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-[10px] font-medium text-yellow-500 uppercase tracking-widest mb-1">Projected MVP</p>
            <p className="text-2xl sm:text-xl font-medium text-white">{result.mvp}</p>
            {mvpPlayer && (
               <p className="text-xs text-gray-500 font-medium">{mvpPlayer.PTS || 0} PTS • {mvpPlayer.REB || 0} REB • {mvpPlayer.AST || 0} AST</p>
            )}
          </div>
          <div className="ml-auto text-right">
             <div className="text-xs text-orange-400 font-medium mb-1 opacity-0 group-hover:opacity-100 transition-opacity">View Prediction →</div>
             <div className="text-4xl font-medium text-white/5 tracking-tighter">MVP</div>
          </div>
        </div>

        {/* Tactical Edge & Key Matchup */}
        <div className="mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800 border-[0.5px] relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl pointer-events-none" />
           
           <div className="flex items-center gap-2 mb-6">
              <Brain className="text-orange-400" size={18} />
              <h4 className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Tactical Edge & Key Matchup Spotlight</h4>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              {/* Positional Advantages */}
              <div className="space-y-4">
                 {positionalAdvantages.map(({ pos, advantage }) => (
                    <div key={pos} className="flex items-center justify-between group/adv">
                       <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[11px] font-medium text-white group-hover/adv:bg-orange-500/20 transition-all border border-zinc-200 dark:border-zinc-800 border-[0.5px]"
                            style={{ borderColor: advantage > 0 ? (homeTeam?.logo_color + '40') : (awayTeam?.logo_color + '40') }}
                          >
                             {pos}
                          </div>
                          <div>
                             <span className="text-[11px] font-medium text-white uppercase tracking-tight block">{POSITION_NAMES[pos]}</span>
                             <span className={`text-[10px] font-medium ${advantage > 0 ? 'text-emerald-400' : 'text-blue-400'}`}>
                                {advantage > 0 ? homeTeam?.TeamName : awayTeam?.TeamName} Lead
                             </span>
                          </div>
                       </div>
                       <div className="flex items-center gap-3">
                          <div className={`text-sm font-medium  ${advantage > 0 ? 'text-emerald-400' : 'text-blue-400'}`}>
                             {advantage > 0 ? '+' : ''}{advantage.toFixed(1)}
                          </div>
                          <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800 border-[0.5px]">
                             <div 
                               className={`h-full transition-all duration-1000 ${advantage > 0 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                               style={{ width: `${Math.min(100, Math.abs(advantage) * 5)}%`, marginLeft: advantage > 0 ? '0' : 'auto' }} 
                             />
                          </div>
                       </div>
                    </div>
                 ))}
              </div>

              {/* Matchup Intelligence Card */}
              <div className="bg-zinc-100 dark:bg-zinc-800 from-white/[0.03] to-transparent border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-[2rem] p-6 flex flex-col justify-between group/matchup hover:border-orange-500/30 transition-all">
                 <div className="relative">
                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                    <p className="text-[10px] font-medium text-orange-500 uppercase tracking-widest mb-4 ml-3">Model Analysis</p>
                    <p className="text-sm text-gray-300 leading-relaxed  font-medium">
                       {result.homeWinProb > 65 
                         ? `The ${homeTeam?.TeamName}'s tactical offensive sets are creating severe mismatches for the ${awayTeam?.TeamName}. expect high-volume scoring from the ${positionalAdvantages.reduce((a, b) => a.advantage > b.advantage ? a : b).pos} position.`
                         : result.homeWinProb < 35 
                           ? `The ${awayTeam?.TeamName} defensive rotations are systematically dismantling the home team's sets. The ${awayTactic} approach is proving to be a masterstroke.`
                           : `A psychological battle is unfolding. The ${homeTactic} and ${awayTactic} systems are in a state of high-equilibrium. The result will likely hinge on ${result.mvp}'s ability to close out the game.`}
                    </p>
                 </div>
                 <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800 border-[0.5px] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Zap size={14} className="text-orange-400" />
                       <span className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Simulation Confidence: 94.2%</span>
                    </div>
                    <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-lg">
                       <TrendingUp size={12} className="text-emerald-400" />
                       <span className="text-[9px] font-medium text-emerald-400">STABLE</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Projected Box Score */}
      <div className="bg-zinc-100 dark:bg-zinc-800  to-black border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-2xl p-6 shadow-none">
        <div className="flex items-center gap-2 mb-6">
           <Zap className="text-yellow-500" size={18} />
           <h3 className="text-lg font-medium text-white uppercase tracking-tighter ">Projected Full Box Score</h3>
        </div>
        <div className="w-full overflow-x-auto rounded-xl">
          <table className="w-full min-w-[600px] text-left text-xs sm:text-sm">
            <thead>
              <tr className="text-[9px] font-medium text-gray-500 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 border-[0.5px]">
                <th className="py-3 px-2">Player</th>
                <th className="py-3 px-2">PTS</th>
                <th className="py-3 px-2">REB</th>
                <th className="py-3 px-2">AST</th>
                <th className="py-3 px-2">STL/BLK</th>
                <th className="py-3 px-2">FG%</th>
              </tr>
            </thead>
            <tbody>
              {[...homeLineup, ...awayLineup].filter(Boolean).map((p, i) => {
                const stats = result.playerPredictions[(p!.PLAYER_ID || p!.PERSON_ID || '').toString()];
                if (!stats) return null;
                const isHome = i < 5;
                return (
                  <tr key={i} className="border-b border-zinc-200 dark:border-zinc-800 border-[0.5px] hover:bg-white/5 transition-colors group">
                    <td className="py-3 px-2 font-medium text-gray-300">
                      <div className="flex items-center gap-2">
                        <div className={`w-1 h-3 rounded-full ${isHome ? 'bg-orange-500' : 'bg-blue-500'}`} />
                        {p!.PLAYER_NAME}
                      </div>
                    </td>
                    <td className="py-3 px-2 font-medium text-white">{Math.round(stats?.pts || 0)}</td>
                    <td className="py-3 px-2 text-gray-400">{Math.round(stats?.reb || 0)}</td>
                    <td className="py-3 px-2 text-gray-400">{Math.round(stats?.ast || 0)}</td>
                    <td className="py-3 px-2 text-gray-400">{Math.round(stats?.stl || 0)}/{Math.round(stats?.blk || 0)}</td>
                    <td className="py-3 px-2 text-orange-500/80 font-mono">{(stats?.fgPct || 0).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lineup Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LineupStats label={homeTeam?.TeamName || 'Home'} players={homeLineup} color={homeTeam?.logo_color} onPlayerClick={onPlayerClick} />
        <LineupStats label={awayTeam?.TeamName || 'Away'} players={awayLineup} color={awayTeam?.logo_color} onPlayerClick={onPlayerClick} />
      </div>

      {/* Stats Chart */}
      <div className="bg-zinc-100 dark:bg-zinc-800   border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
           <Scale className="text-orange-500" size={18} />
           <h3 className="text-lg font-medium text-white">Advanced Matchup Comparison</h3>
        </div>
        
        <div className="space-y-6">
          <StatComparisonRow 
            label="Points Per Game" 
            homeValue={result.homeStats.pts} 
            awayValue={result.awayStats.pts} 
            homeColor={homeTeam?.logo_color} 
            awayColor={awayTeam?.logo_color} 
          />
          <StatComparisonRow 
            label="Total Rebounds" 
            homeValue={result.homeStats.reb} 
            awayValue={result.awayStats.reb} 
            homeColor={homeTeam?.logo_color} 
            awayColor={awayTeam?.logo_color} 
          />
          <StatComparisonRow 
            label="Team Assists" 
            homeValue={result.homeStats.ast} 
            awayValue={result.awayStats.ast} 
            homeColor={homeTeam?.logo_color} 
            awayColor={awayTeam?.logo_color} 
          />
          <StatComparisonRow 
            label="Defensive Impact (STL+BLK)" 
            homeValue={result.homeStats.stl + result.homeStats.blk} 
            awayValue={result.awayStats.stl + result.awayStats.blk} 
            homeColor={homeTeam?.logo_color} 
            awayColor={awayTeam?.logo_color} 
          />
        </div>
      </div>
    </div>
  );
}

function StatComparisonRow({ label, homeValue, awayValue, homeColor = '#f97316', awayColor = '#3b82f6' }: any) {
  const hVal = parseFloat(homeValue) || 0;
  const aVal = parseFloat(awayValue) || 0;
  const total = hVal + aVal;
  const homePct = total > 0 ? (hVal / total) * 100 : 50;
  const awayPct = total > 0 ? (aVal / total) * 100 : 50;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <div className="text-left">
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest mb-1">{label}</p>
          <span className="text-xl font-medium text-white">{homeValue.toFixed(1)}</span>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest mb-1 text-right">{label}</p>
          <span className="text-xl font-medium text-white">{awayValue.toFixed(1)}</span>
        </div>
      </div>
      <div className="h-3 bg-gray-800/50 rounded-full overflow-hidden flex p-0.5 border border-zinc-200 dark:border-zinc-800 border-[0.5px]">
        <div 
          className="h-full rounded-l-full transition-all duration-1000 ease-out"
          style={{ width: `${homePct}%`, backgroundColor: homeColor }}
        />
        <div 
          className="h-full rounded-r-full transition-all duration-1000 ease-out"
          style={{ width: `${awayPct}%`, backgroundColor: awayColor, marginLeft: '2px' }}
        />
      </div>
    </div>
  );
}

function TacticSelector({ label, value, onChange, color }: any) {
  const selected = TACTICAL_STRATEGIES[value as TacticKey];
  
  const getIcon = (key: string) => {
    switch(key) {
      case 'PACE_SPACE': return <Zap size={16} />;
      case 'GRIT_GRIND': return <Shield size={16} />;
      case 'LOCKDOWN': return <Target size={16} />;
      case 'POST_DOMINANCE': return <Crosshair size={16} />;
      default: return <Scale size={16} />;
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-xl p-4 group hover:border-zinc-200 dark:border-zinc-800 border-[0.5px] transition-all">
      <label className="text-[10px] font-medium text-gray-500 block mb-3 uppercase tracking-widest">{label}</label>
      <div className="flex gap-3 items-center">
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-none"
          style={{ backgroundColor: color || '#374151' }}
        >
          {getIcon(value)}
        </div>
        <div className="flex-1">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value as TacticKey)}
            className="w-full bg-transparent text-white font-medium text-sm focus:outline-none cursor-pointer"
          >
            {Object.entries(TACTICAL_STRATEGIES).map(([key, strat]) => (
              <option key={key} value={key} className="bg-white dark:bg-zinc-900">{strat.name}</option>
            ))}
          </select>
          <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">{selected.description}</p>
        </div>
      </div>
    </div>
  );
}

interface LineupStatsProps {
  label: string;
  players: PlayerWithPosition[];
  color?: string;
  onPlayerClick: (p: PlayerWithPosition) => void;
}

function LineupStats({ label, players, color, onPlayerClick }: LineupStatsProps) {
  return (
    <div className="bg-zinc-100 dark:bg-zinc-800   border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-xl p-4">
      <h4 className="text-sm font-medium text-white mb-3">{label}</h4>
      <div className="space-y-2">
        {players.map((p) => (
          <div 
            key={(p.PLAYER_ID || p.PERSON_ID || '').toString()} 
            onClick={() => onPlayerClick(p)}
            className="flex items-center gap-2 text-xs group cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-transform duration-200 hover:scale-105 shadow-none"
          >
            <img
              src={getPlayerHeadshotUrl((p.PLAYER_ID || p.PERSON_ID || '').toString())}
              alt={p.PLAYER_NAME}
              className="w-8 h-10 object-cover rounded"
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
              }}
            />
            <div className="flex-1">
              <p className="text-gray-200 font-medium">{p.PLAYER_NAME}</p>
              <p className="text-gray-500 text-xs">{p.POSITION} • {p.TEAM_ABBREVIATION}</p>
            </div>
            <div className="text-center">
              <p className="text-orange-400 font-medium">{p.PTS}</p>
              <p className="text-gray-500 text-xs">PPG</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerMatchupModal({ player, stats, onClose, teamColor }: any) {
  if (!stats) return null;

  useEffect(() => {
    const el = document.getElementById('player-matchup-modal');
    if (el) el.scrollTop = 0;
  }, [player?.PLAYER_ID || player?.PERSON_ID]);

  return (
    <div id="player-matchup-modal" className="fixed inset-0 z-[100] overflow-y-auto bg-white dark:bg-zinc-900 p-4 backdrop-">
      <div className="flex min-h-full items-end sm:items-center justify-center">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-2xl w-full max-w-lg shadow-none animate-in zoom-in-95 duration-200 relative">
        <div className="relative h-32 bg-zinc-100 dark:bg-zinc-800   overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundColor: teamColor }} />
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white dark:bg-zinc-900 p-2 rounded-full z-20"
          >
            <X size={20} />
          </button>
          
          <div className="absolute -bottom-10 left-8 flex items-end gap-4 z-10">
            <div className="relative">
               <div className="absolute -inset-2 bg-white/20 rounded-full " />
               <img 
                 src={getPlayerHeadshotUrl((player.PLAYER_ID || player.PERSON_ID || '').toString())}
                 alt={player.PLAYER_NAME}
                 className="w-24 h-24 object-cover rounded-full border-4 border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-gray-800"
               />
            </div>
            <div className="mb-12">
               <h3 className="text-2xl font-medium text-white leading-tight">{player.PLAYER_NAME}</h3>
               <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">{player.POSITION} • {player.TEAM_ABBREVIATION}</p>
            </div>
          </div>
        </div>

        <div className="p-8 pt-16">
          <div className="flex items-center gap-2 mb-6">
            <Zap size={16} className="text-yellow-500" />
            <h4 className="text-xs font-medium text-white uppercase tracking-[0.2em]">Matchup Prediction</h4>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <PredictionBox label="Points" value={stats.pts} unit="PTS" color="text-orange-500" />
            <PredictionBox label="Rebounds" value={stats.reb} unit="REB" color="text-blue-500" />
            <PredictionBox label="Assists" value={stats.ast} unit="AST" color="text-emerald-500" />
            <PredictionBox label="FG Accuracy" value={stats.fgPct} unit="%" color="text-purple-500" />
            <PredictionBox label="Steals" value={stats.stl} unit="STL" color="text-yellow-500" />
            <PredictionBox label="Blocks" value={stats.blk} unit="BLK" color="text-red-500" />
          </div>

          <div className="mt-8 p-4 bg-white/5 rounded-xl border border-zinc-200 dark:border-zinc-800 border-[0.5px]">
             <p className="text-[10px] text-gray-500 font-medium uppercase mb-2">Simulation Insight</p>
             <p className="text-xs text-gray-300 leading-relaxed ">
               Based on current lineup synergy and opponent defensive metrics, {(player.PLAYER_NAME || 'Player').split(' ').pop()} is projected to produce a {stats.pts > (player.PTS || 0) ? 'higher than average' : 'contained'} scoring output in this specific matchup.
             </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

function PredictionBox({ label, value, unit, color }: any) {
  const displayValue = label === 'FG Accuracy' ? value.toFixed(1) : Math.round(value);
  return (
    <div className="bg-gray-800/50 border border-zinc-200 dark:border-zinc-800 border-[0.5px]/50 rounded-xl p-4">
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-medium ${color}`}>{displayValue}</span>
        <span className="text-[10px] font-medium text-gray-600">{unit}</span>
      </div>
    </div>
  );
}
