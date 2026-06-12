import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Search, Trophy, Landmark, AlertTriangle, Sparkles, Star, User } from 'lucide-react';
import {
  nbaApi,
  getPlayerHeadshotUrl,
  getTeamLogoUrl,
  getPlayerId,
  getPlayerName,
  getPlayerSalary
} from '../lib/api';
import BasketballLoader from '../components/BasketballLoader';

type DreamSlot = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | 'Bench';

type DreamPlayer = {
  id: number;
  name: string;
  position: string;
  slot: DreamSlot;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  salary: number;
  teamAbbr: string;
  teamId: number;
};

const SALARY_CAP = 141.0; // $141M Cap

export default function DreamTeam() {
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [activeSlot, setActiveSlot] = useState<DreamSlot | null>(null);
  
  // Roster state
  const [dreamTeam, setDreamTeam] = useState<DreamPlayer[]>(() => {
    try {
      const saved = localStorage.getItem('nba_dream_team');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('nba_dream_team', JSON.stringify(dreamTeam));
  }, [dreamTeam]);

  // Load all players for search
  useEffect(() => {
    nbaApi.getAllPlayers()
      .then(res => {
        if (Array.isArray(res)) {
          setAllPlayers(res);
        }
      })
      .catch(err => console.error('Failed to load players for Dream Team:', err))
      .finally(() => setLoadingList(false));
  }, []);

  // Filtered player list for search
  const filteredPlayers = useMemo(() => {
    if (!search.trim()) return [];
    const s = search.toLowerCase();
    // Exclude players already in the dream team
    const selectedIds = new Set(dreamTeam.map(p => p.id));
    return allPlayers
      .filter(p => {
        const name = (p.full_name || p.name || p.PLAYER_NAME || '').toString().toLowerCase();
        const pid = getPlayerId(p);
        return name.includes(s) && !selectedIds.has(pid);
      })
      .slice(0, 8); // Limit search results for slickness
  }, [allPlayers, search, dreamTeam]);

  // Handle adding a player to a slot
  const handleAddPlayer = async (player: any) => {
    if (!activeSlot) return;
    
    const pid = getPlayerId(player);
    
    // Fetch detailed stats to get real averages for display
    try {
      // Temporary loading indicator or just fetch
      const stats = await nbaApi.getPlayerAverages(pid).catch(() => null);
      
      const newPlayer: DreamPlayer = {
        id: pid,
        name: getPlayerName(player),
        position: player.position || (activeSlot === 'Bench' ? 'G/F' : activeSlot),
        slot: activeSlot,
        pts: stats?.PTS ?? 0,
        reb: stats?.REB ?? 0,
        ast: stats?.AST ?? 0,
        stl: stats?.STL ?? 0,
        blk: stats?.BLK ?? 0,
        salary: getPlayerSalary(player),
        teamAbbr: player.team_abbreviation || player.TEAM_ABBREVIATION || 'FA',
        teamId: player.TEAM_ID || player.team_id || 0,
      };

      setDreamTeam(prev => {
        // If slot is not Bench, remove existing player in that slot
        let filtered = prev;
        if (activeSlot !== 'Bench') {
          filtered = prev.filter(p => p.slot !== activeSlot);
        } else {
          // Limit bench to 5 players
          const benchCount = prev.filter(p => p.slot === 'Bench').length;
          if (benchCount >= 5) {
            alert('Your bench is full! Remove a bench player first.');
            return prev;
          }
        }
        return [...filtered, newPlayer];
      });
      
      // Reset search modal/dropdown
      setActiveSlot(null);
      setSearch('');
    } catch (err) {
      console.error(err);
    }
  };

  // Handle removing a player
  const handleRemovePlayer = (id: number) => {
    setDreamTeam(prev => prev.filter(p => p.id !== id));
  };

  // Get player in slot
  const getPlayerInSlot = (slot: DreamSlot) => {
    if (slot === 'Bench') return [];
    return dreamTeam.find(p => p.slot === slot);
  };

  const benchPlayers = dreamTeam.filter(p => p.slot === 'Bench');

  // Aggregates
  const statsSummary = useMemo(() => {
    if (dreamTeam.length === 0) {
      return { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, salary: 0 };
    }
    const totals = dreamTeam.reduce((acc, p) => {
      acc.pts += p.pts;
      acc.reb += p.reb;
      acc.ast += p.ast;
      acc.stl += p.stl;
      acc.blk += p.blk;
      acc.salary += p.salary;
      return acc;
    }, { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, salary: 0 });

    const count = dreamTeam.length;
    return {
      pts: Math.round((totals.pts / count) * 10) / 10,
      reb: Math.round((totals.reb / count) * 10) / 10,
      ast: Math.round((totals.ast / count) * 10) / 10,
      stl: Math.round((totals.stl / count) * 10) / 10,
      blk: Math.round((totals.blk / count) * 10) / 10,
      salary: Math.round(totals.salary * 10) / 10,
    };
  }, [dreamTeam]);

  const capExceeded = statsSummary.salary > SALARY_CAP;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 border-[0.5px] pb-6">
        <div>
          <h2 className="text-2xl sm:text-4xl font-medium text-white  uppercase tracking-tighter flex items-center gap-3">
            <Trophy className="text-orange-500" size={32} />
            My Dream Team
          </h2>
          <p className="text-sm text-gray-400 mt-1">Assemble your ultimate starting five and bench. Analyze payroll and aggregate stats in real-time.</p>
        </div>
        
        {dreamTeam.length > 0 && (
          <button 
            onClick={() => { if(confirm('Are you sure you want to clear your team?')) setDreamTeam([]); }} 
            className="px-5 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium uppercase tracking-widest rounded-xl hover:bg-red-500 hover:text-white transition-all cursor-pointer"
          >
            Clear Roster
          </button>
        )}
      </div>

      {loadingList ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <BasketballLoader />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          
          {/* Main Roster Grid */}
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-3xl p-5 sm:p-8 space-y-6">
              <h3 className="text-sm font-medium uppercase tracking-[0.24em] text-slate-300 flex items-center gap-2">
                <Star size={16} className="text-orange-500 fill-orange-500" />
                Starting Five
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {(['PG', 'SG', 'SF', 'PF', 'C'] as DreamSlot[]).map(slot => {
                  const player = getPlayerInSlot(slot) as DreamPlayer | undefined;
                  return (
                    <div key={slot} className="relative">
                      {player ? (
                        <div className="group relative flex flex-col items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-2xl p-4 text-center hover:border-orange-500/50 hover:scale-105 transition-all duration-300 shadow-none">
                          <button 
                            onClick={() => handleRemovePlayer(player.id)}
                            className="absolute top-2 right-2 text-gray-500 hover:text-red-500 transition-colors p-1"
                            title="Remove player"
                          >
                            <Trash2 size={14} />
                          </button>
                          
                          <div className="text-[9px] font-medium text-orange-500 uppercase tracking-widest mb-2 bg-orange-500/10 px-2 py-0.5 rounded-full">
                            {slot}
                          </div>
                          
                          <img 
                            src={getPlayerHeadshotUrl(player.id)} 
                            alt={player.name} 
                            className="w-16 h-16 rounded-full object-cover bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] mb-2 scale-110" 
                          />
                          
                          <h4 className="text-xs font-medium text-white uppercase truncate max-w-full leading-tight">
                            {player.name}
                          </h4>
                          
                          <div className="text-[10px] text-gray-500 mt-1 font-medium">
                            {player.teamAbbr} · ${player.salary.toFixed(1)}M
                          </div>
                          
                          <div className="grid grid-cols-3 gap-1 mt-3 w-full border-t border-zinc-200 dark:border-zinc-800 border-[0.5px] pt-2 text-[9px] text-gray-400 font-medium">
                            <div>
                              <div className="text-white font-medium">{player.pts}</div>
                              <div>PTS</div>
                            </div>
                            <div>
                              <div className="text-white font-medium">{player.reb}</div>
                              <div>REB</div>
                            </div>
                            <div>
                              <div className="text-white font-medium">{player.ast}</div>
                              <div>AST</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setActiveSlot(slot)}
                          className="w-full aspect-[4/5] sm:h-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-white dark:bg-zinc-900/20 hover:bg-white dark:bg-zinc-900/40 hover:border-orange-500/50 hover:scale-105 transition-all duration-300 group cursor-pointer p-4 text-center"
                        >
                          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-orange-500 group-hover:bg-orange-500/10 transition-colors mb-3">
                            <Plus size={18} />
                          </div>
                          <span className="text-xs font-medium uppercase text-gray-500 group-hover:text-white transition-colors tracking-widest">{slot}</span>
                          <span className="text-[9px] text-gray-600 uppercase mt-1">Select Starters</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bench Unit */}
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-3xl p-5 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium uppercase tracking-[0.24em] text-slate-300 flex items-center gap-2">
                  <User size={16} className="text-orange-500" />
                  Bench Unit
                </h3>
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">{benchPlayers.length} / 5 Players</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                {benchPlayers.map(player => (
                  <div key={player.id} className="group relative flex flex-col items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-2xl p-4 text-center hover:border-orange-500/50 hover:scale-105 transition-all duration-300 shadow-none">
                    <button 
                      onClick={() => handleRemovePlayer(player.id)}
                      className="absolute top-2 right-2 text-gray-500 hover:text-red-500 transition-colors p-1"
                      title="Remove player"
                    >
                      <Trash2 size={14} />
                    </button>
                    
                    <div className="text-[9px] font-medium text-gray-400 uppercase tracking-widest mb-2 bg-white/5 px-2 py-0.5 rounded-full">
                      BENCH
                    </div>
                    
                    <img 
                      src={getPlayerHeadshotUrl(player.id)} 
                      alt={player.name} 
                      className="w-14 h-14 rounded-full object-cover bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] mb-2" 
                    />
                    
                    <h4 className="text-xs font-medium text-white uppercase truncate max-w-full leading-tight">
                      {player.name}
                    </h4>
                    
                    <div className="text-[10px] text-gray-500 mt-1 font-medium">
                      {player.teamAbbr} · ${player.salary.toFixed(1)}M
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1 mt-3 w-full border-t border-zinc-200 dark:border-zinc-800 border-[0.5px] pt-2 text-[9px] text-gray-400 font-medium">
                      <div>
                        <div className="text-white font-medium">{player.pts}</div>
                        <div>PTS</div>
                      </div>
                      <div>
                        <div className="text-white font-medium">{player.reb}</div>
                        <div>REB</div>
                      </div>
                      <div>
                        <div className="text-white font-medium">{player.ast}</div>
                        <div>AST</div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {benchPlayers.length < 5 && (
                  <button 
                    onClick={() => setActiveSlot('Bench')}
                    className="w-full aspect-[4/5] flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-white dark:bg-zinc-900/20 hover:bg-white dark:bg-zinc-900/40 hover:border-orange-500/50 hover:scale-105 transition-all duration-300 group cursor-pointer p-4 text-center"
                  >
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-orange-500 group-hover:bg-orange-500/10 transition-colors mb-2">
                      <Plus size={16} />
                    </div>
                    <span className="text-xs font-medium uppercase text-gray-500 group-hover:text-white transition-colors tracking-widest">Bench</span>
                    <span className="text-[9px] text-gray-600 uppercase mt-1">Add Bench</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Side Panel: Team Diagnostics */}
          <div className="space-y-4">
            
            {/* Roster Summary */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-3xl p-6 space-y-6">
              <h3 className="text-sm font-medium uppercase tracking-[0.24em] text-white flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 border-[0.5px] pb-4">
                <Sparkles size={16} className="text-orange-500" />
                Team Diagnostics
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-medium">Total Players Selected</span>
                  <span className="text-sm font-medium text-white">{dreamTeam.length}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-medium">Starting Lineup</span>
                  <span className="text-sm font-medium text-white">
                    {dreamTeam.filter(p => p.slot !== 'Bench').length} / 5
                  </span>
                </div>
                
                <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 border-[0.5px] pt-4">
                  <span className="text-xs text-gray-400 font-medium">Team Payroll</span>
                  <span className={`text-lg font-medium  ${capExceeded ? 'text-red-500' : 'text-green-400'}`}>
                    ${statsSummary.salary.toFixed(1)}M
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-medium">Salary Cap Limit</span>
                  <span className="text-sm font-medium text-white">${SALARY_CAP.toFixed(1)}M</span>
                </div>
              </div>

              {/* Cap Alert warning */}
              {capExceeded && (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-400 text-xs leading-relaxed">
                  <AlertTriangle className="shrink-0 text-red-500" size={16} />
                  <div>
                    <div className="font-medium uppercase tracking-wider mb-1">Salary Cap Exceeded</div>
                    Your roster payroll exceeds the league cap limit of $141M. Consider substituting for role players.
                  </div>
                </div>
              )}
            </div>

            {/* Projected Team Averages */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-medium uppercase tracking-[0.24em] text-white flex items-center gap-2">
                <Star size={16} className="text-orange-500" />
                Lineup Averages
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <AverageStatBox label="Points" value={statsSummary.pts} sub="PPG" />
                <AverageStatBox label="Rebounds" value={statsSummary.reb} sub="RPG" />
                <AverageStatBox label="Assists" value={statsSummary.ast} sub="APG" />
                <AverageStatBox label="Steals/Blocks" value={`${statsSummary.stl} / ${statsSummary.blk}`} sub="SPG/BPG" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Select Player Drawer/Modal */}
      {activeSlot && (
        <div className="fixed inset-0 z-[150] overflow-y-auto bg-white dark:bg-zinc-900 p-4 backdrop- flex items-center justify-center animate-in fade-in duration-300">
          <div className="relative w-full max-w-md rounded-3xl border border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-white dark:bg-zinc-900 p-6 shadow-none flex flex-col max-h-[90vh]">
            
            <button 
              onClick={() => { setActiveSlot(null); setSearch(''); }} 
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            
            <h3 className="text-lg font-medium uppercase tracking-widest text-white mb-4">
              Assign Slot: <span className="text-orange-500">{activeSlot}</span>
            </h3>
            
            {/* Search Input */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search player name..."
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-xl py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-orange-500/50"
              />
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto space-y-2 min-h-[150px] max-h-[350px] pr-1">
              {filteredPlayers.map(p => (
                <button
                  key={getPlayerId(p)}
                  onClick={() => handleAddPlayer(p)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-white dark:bg-zinc-900/40 hover:border-orange-500/30 hover:bg-gray-800/40 text-left transition-all group"
                >
                  <img 
                    src={getPlayerHeadshotUrl(getPlayerId(p))} 
                    className="w-10 h-10 rounded-full object-cover bg-white dark:bg-zinc-900" 
                    alt="" 
                    onError={(e: any) => {
                      e.target.src = 'https://www.nba.com/assets/logos/teams/primary/web/NBA.svg';
                      e.target.classList.add('p-1', 'opacity-35');
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white group-hover:text-orange-400 transition-colors truncate">
                      {getPlayerName(p)}
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                      {p.team_abbreviation || p.TEAM_ABBREVIATION || 'FA'} · Active
                    </div>
                  </div>
                </button>
              ))}
              
              {search.trim().length > 0 && filteredPlayers.length === 0 && (
                <div className="text-center py-10 text-xs text-gray-600">No matching players found</div>
              )}
              
              {search.trim().length === 0 && (
                <div className="text-center py-10 text-xs text-gray-600 flex flex-col items-center justify-center gap-2">
                  <User size={24} className="opacity-20" />
                  Type in search box to lookup player profiles
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AverageStatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl bg-gray-800/40 p-4 border border-zinc-200 dark:border-zinc-800 border-[0.5px] text-center">
      <div className="text-2xl font-medium text-white ">{value}</div>
      <div className="text-[10px] font-medium text-gray-500 uppercase mt-1 tracking-widest">{label}</div>
      {sub && <div className="mt-0.5 text-[8px] font-medium text-orange-500 uppercase tracking-widest">{sub}</div>}
    </div>
  );
}

const X = ({ size, className }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
