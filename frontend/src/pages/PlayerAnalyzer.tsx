import { useEffect, useState, useMemo, useRef } from 'react';
import { Search, User, Calendar, Trophy, Star, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { nbaApi, getPlayerHeadshotUrl } from '../lib/api';
import BasketballLoader from '../components/BasketballLoader';
import { SkeletonGrid } from '../components/SkeletonCard';

const sanitizeNumberValue = (value: any, fallback = 0) => {
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[%,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return Number.isFinite(value) ? value : fallback;
};

const isValidStatValue = (value: any) => value !== undefined && value !== null && value !== '';
const getPlayerId = (player: any) => player?.id ?? player?.PERSON_ID ?? player?.PLAYER_ID ?? player?.player_id;
const getPlayerName = (player: any) => player?.name || player?.full_name || player?.DISPLAY_FIRST_LAST || player?.PLAYER_NAME || 'Unknown Player';
const getSafeSeasons = (profile: any) => Array.isArray(profile?.seasons) ? profile.seasons : [];
const formatStatPercent = (value: any) => {
  const num = sanitizeNumberValue(value, NaN);
  if (!Number.isFinite(num)) return '-';
  const normalized = num > 1 ? num : num * 100;
  return `${normalized.toFixed(1)}%`;
};


const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function PlayerAnalyzer() {
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'retired'>('all');
  const [loadingList, setLoadingList] = useState(true);

  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [loadError, setLoadError] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false);

  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedPlayer && detailRef.current) {
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [selectedPlayer?.id || selectedPlayer?.PERSON_ID || selectedPlayer?.PLAYER_ID]);
  
  const [seasonStats, setSeasonStats] = useState<any | null>(null);
  const [seasonAwards, setSeasonAwards] = useState<any[]>([]);
  const [detailedStats, setDetailedStats] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // Comparison States
  const [isComparing, setIsComparing] = useState(false);
  const [selectingSlot, setSelectingSlot] = useState<'p1' | 'p2'>('p2');
  const [selectedPlayer2, setSelectedPlayer2] = useState<any | null>(null);
  const [profile2, setProfile2] = useState<any | null>(null);
  const [selectedSeason2, setSelectedSeason2] = useState<string>('');
  const [playerError2, setPlayerError2] = useState(false);
  const [seasonStats2, setSeasonStats2] = useState<any | null>(null);
  const [seasonAwards2, setSeasonAwards2] = useState<any[]>([]);
  const [detailedStats2, setDetailedStats2] = useState<any[]>([]);
  const [loadingStats2, setLoadingStats2] = useState(false);

  useEffect(() => {
    let timeoutId: any;
    setLoadError(false);
    setSlowLoading(false);
    
    // Safety timeout for the loader
    timeoutId = setTimeout(() => {
      setSlowLoading(true);
    }, 5000);

    nbaApi.getAllPlayers()
      .then(res => {
        if (Array.isArray(res)) {
          setAllPlayers(res);
        } else {
          setLoadError(true);
        }
      })
      .catch(err => {
        console.error('Failed to load players:', err);
        setLoadError(true);
      })
      .finally(() => {
        setLoadingList(false);
        clearTimeout(timeoutId);
      });
      
    return () => clearTimeout(timeoutId);
  }, []);

  const filteredPlayers = useMemo(() => {
    if (!allPlayers) return [];
    let filtered = allPlayers;
    
    if (statusFilter === 'active') {
      filtered = filtered.filter(p => p.is_active);
    } else if (statusFilter === 'retired') {
      filtered = filtered.filter(p => !p.is_active);
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(p => {
        const name = (p.full_name || p.name || p.PLAYER_NAME || '').toString().toLowerCase();
        return name.includes(s);
      });
    }
    
    return filtered.slice(0, 50); // Keep it snappy
  }, [allPlayers, search, statusFilter]);

  const handlePlayerSelect = async (player: any) => {
    if (isComparing) {
      if (selectingSlot === 'p1') {
        handlePlayer1Select(player);
      } else {
        handlePlayer2Select(player);
      }
      return;
    }
    handlePlayer1Select(player);
  };

  const handlePlayer1Select = async (player: any) => {
    const playerId = getPlayerId(player);
    if (!playerId) {
      setPlayerError(true);
      return;
    }
    setSelectedPlayer(player);
    setProfile(null);
    setPlayerError(false);
    setSeasonStats(null);
    setSeasonAwards([]);
    setDetailedStats([]);
    setSelectedSeason('');
    setLoadingStats(true);
    try {
      const prof = await nbaApi.getPlayerProfile(playerId);
      setProfile({ ...prof, id: getPlayerId(prof) ?? playerId });
      const defaultSeason = getSafeSeasons(prof)[0] || 'Lifetime';
      setSelectedSeason(defaultSeason);
      await handleSeasonSelect(playerId, defaultSeason);
    } catch (e) {
      console.error('Failed to load player profile:', e);
      setPlayerError(true);
      // Minimal profile so UI doesn't break
      const fallbackProfile = {
        id: playerId,
        name: getPlayerName(player),
        position: player.position || 'N/A',
        height: player.height || 'N/A',
        weight: player.weight || 'N/A',
        draft_year: 'N/A',
        draft_round: 'N/A',
        draft_pick: 'N/A',
        from_year: 'N/A',
        to_year: 'N/A',
        seasons: []
      };
      setProfile(fallbackProfile);
      setSelectedSeason('Lifetime');
      await handleSeasonSelect(playerId, 'Lifetime');
    } finally {
      setLoadingStats(false);
    }
  };

  const handlePlayer2Select = async (player: any) => {
    const playerId = getPlayerId(player);
    if (!playerId) {
      setPlayerError2(true);
      return;
    }
    setSelectedPlayer2(player);
    setProfile2(null);
    setPlayerError2(false);
    setSeasonStats2(null);
    setSeasonAwards2([]);
    setDetailedStats2([]);
    setSelectedSeason2('');
    setLoadingStats2(true);
    try {
      const prof = await nbaApi.getPlayerProfile(playerId);
      setProfile2({ ...prof, id: getPlayerId(prof) ?? playerId });
      const defaultSeason = getSafeSeasons(prof)[0] || 'Lifetime';
      setSelectedSeason2(defaultSeason);
      await handleSeasonSelect2(playerId, defaultSeason);
    } catch (e) {
      console.error('Failed to load player profile:', e);
      setPlayerError2(true);
      const fallbackProfile = {
        id: playerId,
        name: getPlayerName(player),
        position: player.position || 'N/A',
        height: player.height || 'N/A',
        weight: player.weight || 'N/A',
        draft_year: 'N/A',
        draft_round: 'N/A',
        draft_pick: 'N/A',
        from_year: 'N/A',
        to_year: 'N/A',
        seasons: []
      };
      setProfile2(fallbackProfile);
      setSelectedSeason2('Lifetime');
      await handleSeasonSelect2(playerId, 'Lifetime');
    } finally {
      setLoadingStats2(false);
    }
  };

  const handleSeasonSelect = async (playerId: number, season: string) => {
    const selected = season || 'Lifetime';
    setSelectedSeason(selected);
    setLoadingStats(true);
    try {
      const [stats, awards, detailed] = await Promise.all([
        nbaApi.getPlayerAverages(playerId, selected).catch(() => null),
        nbaApi.getPlayerAwards(playerId, selected === 'Lifetime' ? undefined : selected).catch(() => []),
        nbaApi.getPlayerDetailedStats(playerId, selected === 'Lifetime' ? undefined : selected).catch(() => [])
      ]);

      if (!stats || Object.keys(stats).length === 0) {
        setSeasonStats(calculateAverages(detailed));
      } else {
        setSeasonStats(stats);
      }

      setSeasonAwards(awards);
      setDetailedStats(detailed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSeasonSelect2 = async (playerId: number, season: string) => {
    const selected = season || 'Lifetime';
    setSelectedSeason2(selected);
    setLoadingStats2(true);
    try {
      const [stats, awards, detailed] = await Promise.all([
        nbaApi.getPlayerAverages(playerId, selected).catch(() => null),
        nbaApi.getPlayerAwards(playerId, selected === 'Lifetime' ? undefined : selected).catch(() => []),
        nbaApi.getPlayerDetailedStats(playerId, selected === 'Lifetime' ? undefined : selected).catch(() => [])
      ]);

      if (!stats || Object.keys(stats).length === 0) {
        setSeasonStats2(calculateAverages(detailed));
      } else {
        setSeasonStats2(stats);
      }

      setSeasonAwards2(awards);
      setDetailedStats2(detailed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats2(false);
    }
  };

  function calculateAverages(stats: any[]) {
    if (!stats || !stats.length) return null;
    const totals = stats.reduce((acc, curr) => {
      acc.PTS += (curr.PTS || 0);
      acc.REB += (curr.REB || 0);
      acc.AST += (curr.AST || 0);
      acc.STL += (curr.STL || 0);
      acc.BLK += (curr.BLK || 0);
      acc.TOV += (curr.TOV || 0);
      acc.FGM += (curr.FGM || 0);
      acc.FGA += (curr.FGA || 0);
      acc.FG3M += (curr.FG3M || 0);
      acc.FG3A += (curr.FG3A || 0);
      acc.FTM += (curr.FTM || 0);
      acc.FTA += (curr.FTA || 0);
      acc.PF += (curr.PF || 0);
      acc.MIN += (curr.MIN || 0);
      return acc;
    }, { PTS: 0, REB: 0, AST: 0, STL: 0, BLK: 0, TOV: 0, FGM: 0, FGA: 0, FG3M: 0, FG3A: 0, FTM: 0, FTA: 0, PF: 0, MIN: 0 });

    const gp = stats.length;
    return {
      GP: gp,
      MIN: Number((totals.MIN / gp).toFixed(1)),
      PTS: Number((totals.PTS / gp).toFixed(1)),
      REB: Number((totals.REB / gp).toFixed(1)),
      AST: Number((totals.AST / gp).toFixed(1)),
      STL: Number((totals.STL / gp).toFixed(1)),
      BLK: Number((totals.BLK / gp).toFixed(1)),
      TOV: Number((totals.TOV / gp).toFixed(1)),
      FGM: Number((totals.FGM / gp).toFixed(1)),
      FGA: Number((totals.FGA / gp).toFixed(1)),
      FG3M: Number((totals.FG3M / gp).toFixed(1)),
      FG3A: Number((totals.FG3A / gp).toFixed(1)),
      FTM: Number((totals.FTM / gp).toFixed(1)),
      FTA: Number((totals.FTA / gp).toFixed(1)),
      PF: Number((totals.PF / gp).toFixed(1)),
      FG_PCT: totals.FGA > 0 ? totals.FGM / totals.FGA : 0,
      FG3_PCT: totals.FG3A > 0 ? totals.FG3M / totals.FG3A : 0,
      FT_PCT: totals.FTA > 0 ? totals.FTM / totals.FTA : 0,
    };
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-24 animate-fade-in lg:space-y-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center p-4 border-b border-gray-800">
         <div>
            <h1 className="text-xl font-bold text-white uppercase tracking-tight">Player Analyzer</h1>
            <p className="text-xs text-gray-500">Comprehensive NBA database</p>
         </div>
         
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:max-w-2xl items-stretch sm:items-center">
             <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Search any NBA Player..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-full py-4.5 pl-12 pr-4 text-white focus:outline-none focus:border-orange-500 transition-all placeholder:text-gray-650 font-semibold uppercase text-xs"
                />
             </div>
             
             <button 
               onClick={() => {
                 setIsComparing(!isComparing);
                 if (!isComparing) {
                   setSelectedPlayer2(null);
                   setProfile2(null);
                   setSelectingSlot('p2');
                 }
               }}
               className={`px-6 py-4 rounded-full font-bold uppercase text-xs transition-all border shrink-0
                 ${isComparing ? 'bg-orange-500 border-orange-400 text-white shadow-none' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-850'}`}
             >
               {isComparing ? 'Exit Comparison' : 'Compare Players'}
             </button>
          </div>
      </div>

      {isComparing && (
        <div className="flex justify-center gap-6 animate-in slide-in- duration-300">
           <button 
             onClick={() => setSelectingSlot('p1')}
             className={`px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-wider transition-all border
               ${selectingSlot === 'p1' ? 'bg-orange-500 border-orange-400 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'}`}
           >
             Selecting Player 1
           </button>
           <button 
             onClick={() => setSelectingSlot('p2')}
             className={`px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-wider transition-all border
               ${selectingSlot === 'p2' ? 'bg-blue-650 border-blue-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'}`}
           >
             Selecting Player 2
           </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Player List */}
        <div className={`${selectedPlayer || isComparing ? 'order-2' : 'order-1'} xl:order-1 xl:col-span-4 bg-gray-900 border border-gray-800 rounded-2xl p-3 sm:p-4 flex flex-col min-h-[320px] max-h-[48vh] xl:max-h-none xl:min-h-[800px] min-h-0`}>
          <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-800 mb-3 sm:mb-4 shrink-0">
             <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Player Directory</div>
                <div className="text-[10px] font-bold text-orange-500 uppercase bg-orange-500/10 px-3 py-1 rounded-full">{allPlayers.length} Total</div>
             </div>
             <div className="flex bg-gray-950 p-1 rounded-2xl border border-gray-800">
                <button 
                  onClick={() => setStatusFilter('all')}
                  className={`flex-1 text-[9px] font-bold uppercase py-2 rounded-xl transition-all ${statusFilter === 'all' ? 'bg-orange-500 text-white' : 'text-gray-450 hover:text-white'}`}
                >
                  All ({allPlayers.length})
                </button>
                <button 
                  onClick={() => setStatusFilter('active')}
                  className={`flex-1 text-[9px] font-bold uppercase py-2 rounded-xl transition-all ${statusFilter === 'active' ? 'bg-green-600 text-white' : 'text-gray-450 hover:text-white'}`}
                >
                  Active ({allPlayers.filter(p => p.is_active).length})
                </button>
                <button 
                  onClick={() => setStatusFilter('retired')}
                  className={`flex-1 text-[9px] font-bold uppercase py-2 rounded-xl transition-all ${statusFilter === 'retired' ? 'bg-gray-700 text-white' : 'text-gray-450 hover:text-white'}`}
                >
                  Retired ({allPlayers.filter(p => !p.is_active).length})
                </button>
             </div>
          </div>
          <div className="h-[40vh] sm:h-auto sm:flex-1 overflow-y-auto pr-1 sm:pr-2 space-y-2 sm:space-y-3 scrollbar-none">
            {loadingList ? (
              <div className="flex flex-col items-center justify-center py-20">
                <BasketballLoader />
                {slowLoading && (
                  <div className="mt-8 text-center animate-in fade-in duration-1000">
                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.3em]">Processing 4,500+ Player Profiles...</p>
                    <p className="text-orange-500/60 text-[9px] font-bold uppercase tracking-wider mt-2">Connecting to NBA Intelligence Grid</p>
                  </div>
                )}
              </div>
            ) : loadError ? (
              <div className="py-20 text-center">
                <p className="text-red-500 font-bold uppercase tracking-wider">Access Denied to Player Database</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-6 px-6 py-2 bg-gray-800 border border-gray-750 rounded-xl text-[10px] font-bold text-white uppercase tracking-wider hover:bg-orange-500/10 hover:border-orange-500"
                >
                  Re-Authenticate Connection
                </button>
              </div>
            ) : (
              filteredPlayers.map((p: any) => (
                <button 
                  key={getPlayerId(p)}
                  onClick={() => handlePlayerSelect(p)}
                  className={`w-full flex items-center gap-3 sm:gap-5 p-3 sm:p-4 rounded-2xl transition-transform duration-200 hover:scale-[1.02] border text-left group
                    ${getPlayerId(selectedPlayer) === getPlayerId(p) || getPlayerId(selectedPlayer2) === getPlayerId(p) ? 'bg-orange-500/10 border-orange-500/50 shadow-none' : 'bg-gray-950 border-transparent hover:bg-gray-800 hover:border-gray-700'}`}
                >
                   <div className="relative shrink-0">
                      <img 
                        src={getPlayerHeadshotUrl(getPlayerId(p))} 
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover bg-gray-900 border border-gray-800" 
                        alt="" 
                        onError={(e: any) => {
                           e.target.src = 'https://www.nba.com/assets/logos/teams/primary/web/NBA.svg';
                           e.target.classList.add('p-2', 'opacity-20');
                        }}
                      />
                      {isComparing && getPlayerId(selectedPlayer) === getPlayerId(p) && <div className="absolute -top-1 -left-1 bg-orange-500 text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white border border-black">P1</div>}
                      {isComparing && getPlayerId(selectedPlayer2) === getPlayerId(p) && <div className="absolute -top-1 -right-1 bg-blue-500 text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white border border-black">P2</div>}
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold uppercase truncate ${getPlayerId(selectedPlayer) === getPlayerId(p) || getPlayerId(selectedPlayer2) === getPlayerId(p) ? 'text-orange-500' : 'text-white group-hover:text-orange-500'}`}>{getPlayerName(p)}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${p.is_active ? 'bg-green-500' : 'bg-gray-500'}`} />
                        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">{p.is_active ? 'Active' : 'Retired'}</span>
                      </div>
                   </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Player Profile & Stats */}
        <div ref={detailRef} className={`${selectedPlayer || isComparing ? 'order-1' : 'order-2'} xl:order-2 xl:col-span-8`}>
          {!selectedPlayer && !isComparing ? (
            <div className="h-full flex flex-col items-center justify-center bg-gray-950 border border-gray-800 rounded-[3.5rem] border-dashed text-gray-500">
               <User size={80} className="mb-6 opacity-20 text-gray-500 " />
               <h2 className="text-2xl font-medium uppercase tracking-widest text-gray-500 ">Select a Player</h2>
               <p className="text-xs uppercase tracking-widest mt-2 opacity-50 text-gray-500">To view comprehensive analytics</p>
            </div>
          ) : isComparing ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 animate-in fade-in duration-700">
               <PlayerColumn 
                  player={selectedPlayer} 
                  profile={profile} 
                  stats={seasonStats} 
                  awards={seasonAwards} 
                  detailed={detailedStats}
                  selectedSeason={selectedSeason}
                  onSeasonChange={(s: string) => profile && handleSeasonSelect(getPlayerId(profile), s)}
                  loading={loadingStats}
                  label="Player 1"
                  isActive={selectingSlot === 'p1'}
                  onSelect={() => setSelectingSlot('p1')}
                  onCancel={() => {
                    setSelectedPlayer(null);
                    setProfile(null);
                  }}
                  error={playerError}
               />
               <PlayerColumn 
                  player={selectedPlayer2} 
                  profile={profile2} 
                  stats={seasonStats2} 
                  awards={seasonAwards2} 
                  detailed={detailedStats2}
                  selectedSeason={selectedSeason2}
                  onSeasonChange={(s: string) => profile2 && handleSeasonSelect2(getPlayerId(profile2), s)}
                  loading={loadingStats2}
                  label="Player 2"
                  variant="blue"
                  isActive={selectingSlot === 'p2'}
                  onSelect={() => setSelectingSlot('p2')}
                  onCancel={() => {
                    setSelectedPlayer2(null);
                    setProfile2(null);
                  }}
                  error={playerError2}
               />
            </div>
          ) : !profile && !playerError ? (
            <SkeletonGrid count={4} />
          ) : profile ? (
            <div className="space-y-10 animate-in slide-in- duration-500">
               {playerError && (
                 <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-3xl text-red-400 text-xs font-medium uppercase tracking-widest text-center">
                    Partial Data Mode: Profile fetch failed, showing basic info and career stats.
                 </div>
               )}
               <PlayerFullView 
                  profile={profile} 
                  seasonStats={seasonStats} 
                  seasonAwards={seasonAwards} 
                  detailedStats={detailedStats} 
                  selectedSeason={selectedSeason} 
                  handleSeasonSelect={handleSeasonSelect} 
                  loadingStats={loadingStats} 
               />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-gray-950 border border-gray-800 rounded-[3.5rem] border-dashed text-gray-500">
               <User size={80} className="mb-6 opacity-20 text-gray-500 " />
               <h2 className="text-2xl font-medium uppercase tracking-widest text-gray-500 ">Select a Player</h2>
               <p className="text-xs uppercase tracking-widest mt-2 opacity-50 text-gray-500">To view comprehensive analytics</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main View Components ──────────────────────────────────────────────────

function PlayerFullView({ profile, seasonStats, seasonAwards, detailedStats, selectedSeason, handleSeasonSelect, loadingStats }: any) {
  const activeSeason = selectedSeason || 'Lifetime';
  const seasons = Array.isArray(profile?.seasons) ? profile.seasons : [];
  const playerId = getPlayerId(profile);
  const playerName = profile?.name || profile?.full_name || profile?.DISPLAY_FIRST_LAST || 'Unknown Player';
  const playerPosition = profile?.position || profile?.POSITION || 'N/A';
  const playerHeight = profile?.height || profile?.HEIGHT || 'N/A';
  const playerWeight = profile?.weight || profile?.WEIGHT || 'N/A';
  const draftYear = isValidStatValue(profile?.draft_year) && profile.draft_year !== 'N/A' ? profile.draft_year : 'N/A';
  const draftRound = isValidStatValue(profile?.draft_round) && profile.draft_round !== 'N/A' ? profile.draft_round : 'N/A';
  const draftPick = isValidStatValue(profile?.draft_pick) && profile.draft_pick !== 'N/A' ? profile.draft_pick : 'N/A';
  const yearsActive = isValidStatValue(profile?.from_year) && isValidStatValue(profile?.to_year) && profile.from_year !== 'N/A' && profile.to_year !== 'N/A' ? `${profile.from_year}-${profile.to_year}` : 'N/A';

  return (
    <div className="space-y-6 sm:space-y-10">
      {/* Identity Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl sm:rounded-[4rem] p-5 sm:p-12 relative overflow-hidden shadow-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/10 blur-[100px] rounded-full translate-x-1/3 -translate-y-1/3" />
        
        <div className="flex flex-col md:flex-row gap-5 sm:gap-12 relative z-10 items-center md:items-start">
           <img 
              src={getPlayerHeadshotUrl(playerId)} 
              className="w-32 h-32 sm:w-56 sm:h-56 rounded-3xl sm:rounded-[3rem] object-cover bg-gray-900 border-4 sm:border-[6px] border-gray-800 shadow-none shrink-0" 
              alt="" 
              onError={(e: any) => {
                e.target.src = '/assets/images/nba-6.svg';
                e.target.classList.add('p-8', 'opacity-20');
              }}
           />
           <div className="flex-1 w-full text-center md:text-left space-y-5 sm:space-y-8">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-800 border border-gray-750 text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-4">
                  {playerPosition}
                </div>
                <h2 className="text-3xl sm:text-6xl font-medium text-white uppercase tracking-tighter leading-none break-words">{playerName}</h2>
              </div>

               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
                 <InfoBox
                   label="Draft Pick"
                   value={draftRound !== 'N/A' && draftPick !== 'N/A'
                     ? `Rd ${draftRound} Pk ${draftPick}`
                     : 'Undrafted'}
                 />
                 <InfoBox label="Draft Year" value={draftYear} />
                 <InfoBox label="Height" value={playerHeight} />
                 <InfoBox label="Weight" value={playerWeight !== 'N/A' ? `${playerWeight} lbs` : 'N/A'} />
                 <InfoBox
                   label="Years Active"
                   value={yearsActive}
                 />
               </div>
           </div>
        </div>
      </div>

      {/* Analytics Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-6 bg-gray-900/40 p-4 sm:p-6 rounded-3xl sm:rounded-[2.5rem] border border-gray-800">
        <div className="flex items-center gap-4">
          <Calendar className="text-orange-500" size={24} />
          <span className="text-sm font-medium text-white uppercase tracking-widest">Season Filter</span>
        </div>
        <div className="relative w-full sm:w-auto">
           <select 
             value={activeSeason} 
             onChange={(e) => handleSeasonSelect(playerId, e.target.value)}
             className="w-full appearance-none bg-gray-900 border border-gray-800 rounded-full py-4 pl-6 sm:pl-8 pr-14 sm:pr-16 text-white text-sm font-medium focus:outline-none focus:border-orange-500 cursor-pointer shadow-none"
           >
             <option value="Lifetime">Lifetime Stats</option>
             {seasons.map((s: string) => <option key={s} value={s}>{s} Season</option>)}
             {seasons.length === 0 && <option value="Lifetime">No Seasons Found</option>}
           </select>
           <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">▼</div>
        </div>
      </div>

      {/* Stats & Awards */}
      {loadingStats ? (
        <div className="py-20 flex justify-center">
          <BasketballLoader />
        </div>
      ) : (
        <div className="space-y-10 animate-in fade-in duration-500">
           
           {/* Averages Grid */}
           <div className="bg-gray-900/30 rounded-3xl sm:rounded-[3rem] p-4 sm:p-10 border border-gray-800 space-y-6 sm:space-y-8">
             <div className="flex items-center gap-4">
               <TrendingUp className="text-orange-500" size={20} />
               <h3 className="text-lg font-medium text-white uppercase tracking-widest">Season Averages</h3>
             </div>
             {seasonStats ? (
               <>
                     <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-6">
                   <StatCard label="GP" val={seasonStats.GP} />
                   <StatCard label="PTS" val={seasonStats.PTS} />
                   <StatCard label="REB" val={seasonStats.REB} />
                   <StatCard label="AST" val={seasonStats.AST} />
                   <StatCard label="STL" val={seasonStats.STL} />
                   <StatCard label="BLK" val={seasonStats.BLK} />
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
                   <PctCard label="FG%" val={seasonStats.FG_PCT} made={seasonStats.FGM} att={seasonStats.FGA} />
                   <PctCard label="3P%" val={seasonStats.FG3_PCT} made={seasonStats.FG3M} att={seasonStats.FG3A} />
                   <PctCard label="FT%" val={seasonStats.FT_PCT} made={seasonStats.FTM} att={seasonStats.FTA} />
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
                   <InsightCard label="Scoring Load" value={`${Math.round(sanitizeNumberValue(seasonStats.PTS) * 2.7)}%`} note="usage estimate" />
                   <InsightCard label="Playmaking Mix" value={`${Math.round((sanitizeNumberValue(seasonStats.AST) / Math.max(1, sanitizeNumberValue(seasonStats.TOV, 1))) * 10) / 10}`} note="AST/TOV" />
                   <InsightCard label="Shot Profile" value={formatStatPercent(seasonStats.FG_PCT)} note="field goal efficiency" />
                 </div>
               </>
             ) : (
               <div className="text-center py-10 text-gray-400 font-medium uppercase tracking-widest">No stats recorded for this season.</div>
             )}
           </div>

           {/* Awards & Contracts */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-10">
             
             <div className="bg-gray-900/30 rounded-3xl sm:rounded-[3rem] p-4 sm:p-10 border border-gray-800 space-y-6 sm:space-y-8">
               <div className="flex items-center gap-4">
                 <Trophy className="text-orange-500" size={20} />
                 <h3 className="text-lg font-medium text-white uppercase tracking-widest">Achievements</h3>
               </div>
               {seasonAwards.length > 0 ? (
                 <div className="space-y-4">
                   {seasonAwards.map((a: any, i: number) => (
                     <div key={i} className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gray-900 border border-gray-800 hover:bg-gray-800 transition-colors">
                       <Star className="text-orange-400 shrink-0" size={16} />
                       <div>
                         <div className="text-sm font-medium text-white uppercase ">{a.DESCRIPTION || a.TYPE || 'Official NBA Award'}</div>
                         <div className="text-[9px] font-medium text-gray-450 uppercase tracking-widest mt-1">{a.SEASON || activeSeason}</div>
                       </div>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="text-center py-10 text-gray-400 font-medium uppercase tracking-widest">No official NBA awards found for this selection.</div>
               )}
             </div>

             <div className="bg-gray-900/30 rounded-3xl sm:rounded-[3rem] p-4 sm:p-10 border border-gray-800 space-y-6 sm:space-y-8 relative overflow-hidden">
               <div className="flex items-center gap-4 relative z-10">
                 <DollarSign className="text-green-500" size={20} />
                 <h3 className="text-lg font-medium text-white uppercase tracking-widest">Contract Status</h3>
               </div>
               <div className="relative z-10 flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="text-5xl font-medium text-gray-700 blur-[2px] select-none">$15,000,000</div>
                  <div className="inline-block px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-[10px] font-medium text-orange-500 uppercase tracking-widest shadow-none">
                    Data Restricted
                  </div>
                  <p className="text-[10px] font-medium text-gray-450 uppercase tracking-widest max-w-[200px]">Contract details are not publicly available in this dataset.</p>
               </div>
             </div>

           </div>

           {/* Detailed Game Log */}
           <div className="bg-gray-900/30 rounded-3xl sm:rounded-[3rem] p-4 sm:p-10 border border-gray-800 space-y-6 sm:space-y-8">
             <div className="flex items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                 <Activity className="text-orange-500" size={20} />
                 <h3 className="text-lg font-medium text-white uppercase tracking-widest">Seasonal Match Journey</h3>
               </div>
               <div className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">{Array.isArray(detailedStats) ? detailedStats.length : 0} Games</div>
             </div>
             
             {Array.isArray(detailedStats) && detailedStats.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {detailedStats.slice(0, 20).map((log: any, i: number) => (
                   <div key={i} className="flex items-center justify-between gap-3 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gray-900 border border-gray-800 hover:border-gray-800 transition-all group">
                     <div className="space-y-1 min-w-0">
                       <div className="text-[9px] font-medium text-gray-450 uppercase tracking-widest">{log.GAME_DATE}</div>
                       <div className="text-xs sm:text-sm font-medium text-white uppercase group-hover:text-orange-400 transition-colors truncate">{log.MATCHUP}</div>
                     </div>
                     <div className="flex items-center gap-3 sm:gap-6 shrink-0">
                       <MiniStat val={log.PTS} label="PTS" />
                       <MiniStat val={log.REB} label="REB" />
                       <MiniStat val={log.AST} label="AST" />
                     </div>
                   </div>
                 ))}
                 {detailedStats.length > 20 && (
                   <div className="col-span-full text-center py-4 text-[10px] font-medium text-gray-400 uppercase tracking-widest">
                     Showing last 20 games of the season
                   </div>
                 )}
               </div>
             ) : (
               <div className="text-center py-10 text-gray-400 font-medium uppercase tracking-widest">No detailed game logs available.</div>
             )}
           </div>
        </div>
      )}
    </div>
  );
}

function InsightCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl text-center">
      <div className="text-xl sm:text-2xl font-medium text-cyan-300 ">{value}</div>
      <div className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-2">{label}</div>
      <div className="text-[8px] font-medium text-gray-400 uppercase tracking-[0.2em] mt-1">{note}</div>
    </div>
  );
}

function PlayerColumn({ 
  player, 
  profile, 
  stats, 
  awards, 
  detailed: _detailed, 
  selectedSeason, 
  onSeasonChange, 
  loading, 
  label, 
  variant = 'orange',
  isActive,
  onSelect,
  onCancel,
  error
}: any) {
  const accentBorder = variant === 'orange' ? 'border-orange-500/50' : 'border-blue-500/50';
  const accentBg = variant === 'orange' ? 'bg-orange-500/10' : 'bg-blue-500/10';
  const playerId = getPlayerId(profile ?? player);

  return (
    <div 
      onClick={onSelect}
      className={`space-y-6 sm:space-y-8 p-4 sm:p-6 rounded-3xl sm:rounded-[3.5rem] border transition-transform duration-200 hover:scale-[1.02] cursor-pointer relative shadow-none hover:shadow-none
        ${isActive ? `bg-gray-900/20 ${accentBorder} shadow-none` : 'bg-gray-900/30 border-gray-800 opacity-80 hover:opacity-100'}`}
    >
       <div className="flex items-center justify-between">
          <div className={`px-6 py-2 rounded-2xl ${accentBg} border ${accentBorder} inline-block text-[10px] font-medium text-white uppercase tracking-widest`}>
            {label}
          </div>
          {player && (
            <button 
              onClick={(e) => { e.stopPropagation(); onCancel(); }}
              className="w-8 h-8 rounded-full bg-gray-800 border border-gray-800 flex items-center justify-center text-gray-400 hover:bg-red-500/20 hover:text-red-500 transition-all"
            >
              <Search className="rotate-45" size={14} />
            </button>
          )}
       </div>

       {!player ? (
         <div className="py-40 text-center space-y-4 opacity-30">
            <User size={60} className="mx-auto text-gray-650" />
            <div className="text-xs font-medium uppercase tracking-widest text-gray-400">Select Player for {label}</div>
         </div>
        ) : !profile && !error ? (
          <div className="py-40 flex justify-center">
            <BasketballLoader />
          </div>
        ) : profile ? (
         <div className="space-y-8 animate-in fade-in duration-500">
            {error && (
               <div className="text-[10px] font-medium text-red-500 uppercase tracking-widest text-center bg-red-500/5 p-3 rounded-2xl border border-red-500/20">
                  Profile Error: Basic info only
               </div>
            )}
            {/* mini identity */}
            <div className="flex items-center gap-4 sm:gap-6">
               <img 
                  src={getPlayerHeadshotUrl(playerId)} 
                  className="w-20 h-20 sm:w-32 sm:h-32 rounded-2xl sm:rounded-3xl object-cover bg-gray-850 border-4 border-gray-800 shadow-none shrink-0" 
                  alt="" 
                  onError={(e: any) => {
                    e.target.src = '/assets/images/nba-6.svg';
                    e.target.classList.add('p-4', 'opacity-20');
                  }}
               />
               <div className="min-w-0">
                  <h3 className="text-2xl sm:text-3xl font-medium text-white uppercase tracking-tighter truncate leading-none">{profile.name}</h3>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">{profile.position}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-700" />
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">{profile.height}</span>
                  </div>
               </div>
            </div>

            {/* mini season filter */}
            <div className="relative">
               <select 
                 value={selectedSeason} 
                 onChange={(e) => onSeasonChange(e.target.value)}
                 className="w-full appearance-none bg-gray-900 border border-gray-800 rounded-2xl py-4 px-6 text-white text-xs font-medium focus:outline-none focus:border-white cursor-pointer hover:bg-gray-800 transition-all"
               >
                 <option value="Lifetime">Career Lifetime</option>
                 {(profile.seasons || []).map((s: string) => <option key={s} value={s}>{s} Season</option>)}
               </select>
               <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">▼</div>
            </div>

            {/* Comparison Stats */}
            {loading ? (
               <div className="py-20 flex justify-center">
                 <BasketballLoader />
               </div>
            ) : stats ? (
               selectedSeason === 'Lifetime' ? (
                 <div className="grid grid-cols-2 gap-4">
                    <CompareStat label="GP" val={stats.GP} />
                    <CompareStat label="PTS" val={stats.PTS} highlight={variant} />
                    <CompareStat label="REB" val={stats.REB} />
                    <CompareStat label="AST" val={stats.AST} />
                    <CompareStat label="STL" val={stats.STL} />
                    <CompareStat label="BLK" val={stats.BLK} />
                    <CompareStat label="FG%" val={formatStatPercent(stats.FG_PCT)} />
                    <CompareStat label="3P%" val={formatStatPercent(stats.FG3_PCT)} />
                 </div>
               ) : (
                 <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                     <CompareStat label="GP" val={stats.GP} />
                     <CompareStat label="MIN" val={stats.MIN} />
                     <CompareStat label="PTS" val={stats.PTS} highlight={variant} />
                     <CompareStat label="REB" val={stats.REB} />
                     <CompareStat label="AST" val={stats.AST} />
                     <CompareStat label="STL" val={stats.STL} />
                     <CompareStat label="BLK" val={stats.BLK} />
                     <CompareStat label="TOV" val={stats.TOV} />
                   </div>
                   <div className="grid grid-cols-3 gap-3 text-center">
                     <div className="bg-gray-900 border border-gray-800 p-3 rounded-xl">
                       <div className="text-lg font-medium text-white">{stats.FGM}/{stats.FGA}</div>
                       <div className="text-[8px] font-medium text-gray-400 uppercase tracking-widest">FG</div>
                     </div>
                     <div className="bg-gray-900 border border-gray-800 p-3 rounded-xl">
                       <div className="text-lg font-medium text-white">{stats.FG3M}/{stats.FG3A}</div>
                       <div className="text-[8px] font-medium text-gray-400 uppercase tracking-widest">3PT</div>
                     </div>
                     <div className="bg-gray-900 border border-gray-800 p-3 rounded-xl">
                       <div className="text-lg font-medium text-white">{stats.FTM}/{stats.FTA}</div>
                       <div className="text-[8px] font-medium text-gray-400 uppercase tracking-widest">FT</div>
                     </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <CompareStat label="FG%" val={formatStatPercent(stats.FG_PCT)} />
                     <CompareStat label="3P%" val={formatStatPercent(stats.FG3_PCT)} />
                     <CompareStat label="FT%" val={formatStatPercent(stats.FT_PCT)} />
                     <CompareStat label="PF" val={stats.PF} />
                   </div>
                 </div>
               )
            ) : null}

            {/* Mini Awards */}
            {awards.length > 0 && (
               <div className="space-y-3 pt-4 border-t border-gray-800">
                  <div className="text-[9px] font-medium text-gray-400 uppercase tracking-widest">Achievements</div>
                  <div className="flex flex-wrap gap-2">
                     {awards.slice(0, 3).map((a: any, i: number) => (
                        <div key={i} className="px-3 py-1 rounded-full bg-gray-900 border border-gray-800 text-[8px] font-medium text-gray-400 uppercase ">
                           {a.DESCRIPTION || a.TYPE || 'Official NBA Award'} {a.SEASON ? `(${a.SEASON})` : ''}
                        </div>
                     ))}
                  </div>
               </div>
            )}
         </div>
       ) : null}
    </div>
  );
}

function CompareStat({ label, val, highlight }: any) {
  return (
    <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl text-center">
       <div className={`text-2xl font-medium  leading-none ${highlight === 'orange' ? 'text-orange-500' : highlight === 'blue' ? 'text-blue-500' : 'text-white'}`}>
         {val ?? '-'}
       </div>
       <div className="text-[8px] font-medium text-gray-400 uppercase tracking-widest mt-2">{label}</div>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function InfoBox({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 p-3 sm:p-4 rounded-2xl flex flex-col items-center justify-center text-center min-w-0">
      <div className="text-[9px] font-medium text-gray-450 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-xs sm:text-sm font-medium text-white uppercase  truncate max-w-full">{value || '-'}</div>
    </div>
  );
}

function StatCard({ label, val }: any) {
  return (
    <div className="bg-gray-900 border border-gray-800 p-3 sm:p-6 rounded-2xl sm:rounded-3xl text-center shadow-none group hover:bg-gray-800 transition-colors">
      <div className="text-2xl sm:text-4xl font-medium text-white  group-hover:text-orange-500 transition-colors">{val ?? '-'}</div>
      <div className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-2">{label}</div>
    </div>
  );
}

function PctCard({ label, val, made, att }: any) {
  const normalized = val !== undefined && val !== null ? (Number(val) > 1 ? Number(val) / 100 : Number(val)) : NaN;
  const displayPct = Number.isFinite(normalized) ? `${(normalized * 100).toFixed(1)}%` : '-';
  return (
    <div className="bg-gray-900 border border-gray-800 p-5 sm:p-8 rounded-2xl sm:rounded-3xl text-center shadow-none relative overflow-hidden group">
      <div className="absolute inset-0 bg-gray-800  to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10">
        <div className="text-3xl sm:text-4xl font-medium text-orange-500  drop-shadow-none">{displayPct}</div>
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-3 mb-1">{label}</div>
        <div className="text-[8px] font-medium text-gray-400 uppercase tracking-[0.2em]">{made !== undefined ? `${made}/${att} M/A` : ''}</div>
      </div>
    </div>
  );
}

function MiniStat({ val, label }: { val: any, label: string }) {
  return (
    <div className="text-center min-w-8 sm:min-w-[40px]">
      <div className="text-base sm:text-lg font-medium text-white">{val ?? 0}</div>
      <div className="text-[8px] text-gray-450 font-medium uppercase tracking-tighter">{label}</div>
    </div>
  );
}
