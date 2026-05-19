import { useEffect, useState, useMemo } from 'react';
import { Trophy, X, BarChart3, Search, Loader2 } from 'lucide-react';
import { 
  nbaApi, 
  getTeamLogoUrl, 
  getPlayerHeadshotUrl,
  type BoxScorePlayer 
} from '../lib/api';

export default function Awards() {
  const [awards, setAwards] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [playerAverages, setPlayerAverages] = useState<any | null>(null);
  const [playerStats, setPlayerStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedGame, setSelectedGame] = useState<any | null>(null);
  const [boxScore, setBoxScore] = useState<BoxScorePlayer[]>([]);
  const [loadingBox, setLoadingBox] = useState(false);
  const [drillDownPlayer, setDrillDownPlayer] = useState<BoxScorePlayer | null>(null);

  useEffect(() => {
    nbaApi.getAwards().then(setAwards);
  }, []);

  const filteredAwards = awards.filter(award => 
    award.season.toLowerCase().includes(searchTerm.toLowerCase())
  );

  async function handlePlayerClick(player: any, season: string, awardType: string) {
    if (!player.id) return;
    setSelectedPlayer({ ...player, awardType });
    setSelectedSeason(season);
    setSelectedGame(null);
    setDrillDownPlayer(null);
    setPlayerAverages(null);
    setPlayerStats([]);
    setLoading(true);
    try {
      const [averages, stats] = await Promise.all([
        nbaApi.getPlayerAverages(player.id, season).catch(() => null),
        nbaApi.getPlayerDetailedStats(player.id, season).catch(() => [])
      ]);
      
      // Fallback calculation if averages API fails or returns empty
      if (!averages || Object.keys(averages).length === 0) {
        setPlayerAverages(calculateAverages(stats));
      } else {
        setPlayerAverages(averages);
      }
      
      setPlayerStats(stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

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
      acc.MIN += (curr.MIN || 0);
      return acc;
    }, { PTS: 0, REB: 0, AST: 0, STL: 0, BLK: 0, TOV: 0, FGM: 0, FGA: 0, FG3M: 0, FG3A: 0, FTM: 0, FTA: 0, MIN: 0 });

    const gp = stats.length;
    return {
      GP: gp,
      MIN: (totals.MIN / gp).toFixed(1),
      PTS: (totals.PTS / gp).toFixed(1),
      REB: (totals.REB / gp).toFixed(1),
      AST: (totals.AST / gp).toFixed(1),
      STL: (totals.STL / gp).toFixed(1),
      BLK: (totals.BLK / gp).toFixed(1),
      TOV: (totals.TOV / gp).toFixed(1),
      FGM: (totals.FGM / gp).toFixed(1),
      FGA: (totals.FGA / gp).toFixed(1),
      FG3M: (totals.FG3M / gp).toFixed(1),
      FG3A: (totals.FG3A / gp).toFixed(1),
      FTM: (totals.FTM / gp).toFixed(1),
      FTA: (totals.FTA / gp).toFixed(1),
      FG_PCT: totals.FGA > 0 ? totals.FGM / totals.FGA : 0,
      FG3_PCT: totals.FG3A > 0 ? totals.FG3M / totals.FG3A : 0,
      FT_PCT: totals.FTA > 0 ? totals.FTM / totals.FTA : 0,
    };
  }

  async function handleGameClick(game: any) {
    setSelectedGame(game);
    setBoxScore([]);
    setLoadingBox(true);
    try {
      const box = await nbaApi.getBoxScore(game.GAME_ID);
      setBoxScore(box);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBox(false);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-12 pb-20 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/40 p-6 sm:p-10 rounded-3xl sm:rounded-[3.5rem] border border-white/5 backdrop-blur-xl">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-white italic uppercase tracking-tighter">Award Records</h1>
          <p className="text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] sm:tracking-[0.5em] mt-2 sm:mt-3">NBA Official Historical Vault</p>
        </div>
        
        <div className="relative group max-w-md w-full">
           <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
           <input 
             type="text" 
             placeholder="Search Season (e.g. 1996)" 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full bg-black/40 border border-white/10 rounded-2xl sm:rounded-3xl py-4 sm:py-5 pl-12 sm:pl-14 pr-6 text-white focus:outline-none focus:border-orange-500 transition-all placeholder:text-gray-600 font-black italic uppercase text-[10px] sm:text-xs"
           />
        </div>
      </div>

      <div className="space-y-16 sm:space-y-32">
        {filteredAwards.map((seasonData, idx) => (
          <div key={idx} className="space-y-6 sm:space-y-12">
            <div className="flex items-center gap-4 sm:gap-10">
              <h2 className="text-4xl sm:text-7xl font-black text-orange-500 italic uppercase tracking-tighter leading-none">{seasonData.season}</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-gray-800/50 to-transparent" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-10">
               {seasonData.mvp && <AwardCard label="MVP" player={seasonData.mvp} onClick={() => handlePlayerClick(seasonData.mvp, seasonData.season, "MVP")} />}
               {seasonData.dpoy && <AwardCard label="DPOY" player={seasonData.dpoy} onClick={() => handlePlayerClick(seasonData.dpoy, seasonData.season, "DPOY")} />}
               {seasonData.roty && <AwardCard label="ROTY" player={seasonData.roty} onClick={() => handlePlayerClick(seasonData.roty, seasonData.season, "ROTY")} />}
               {seasonData.fmvp && <AwardCard label="FINALS MVP" player={seasonData.fmvp} onClick={() => handlePlayerClick(seasonData.fmvp, seasonData.season, "Finals MVP")} />}
               {seasonData.sixman && <AwardCard label="6TH MAN" player={seasonData.sixman} onClick={() => handlePlayerClick(seasonData.sixman, seasonData.season, "6th Man")} />}
               {seasonData.mip && <AwardCard label="MIP" player={seasonData.mip} onClick={() => handlePlayerClick(seasonData.mip, seasonData.season, "Most Improved")} />}
               {seasonData.coty && <AwardCard label="COACH" player={seasonData.coty} isCoach />}
            </div>
          </div>
        ))}
      </div>

      {selectedPlayer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-6 bg-black/98 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="relative bg-slate-950 w-full max-w-6xl max-h-[96vh] rounded-3xl sm:rounded-[3rem] border border-white/10 shadow-[0_0_120px_rgba(0,0,0,1)] overflow-hidden flex flex-col lg:grid lg:grid-cols-[300px_1fr]">
            <button onClick={() => setSelectedPlayer(null)} className="absolute top-4 right-4 z-[110] w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center bg-white/10 hover:bg-orange-500/20 text-white rounded-full transition-all border border-white/5"><X size={22} /></button>

            <div className="relative min-h-28 shrink-0 overflow-hidden bg-gradient-to-br from-orange-600/30 via-slate-950 to-slate-950 sm:min-h-32 lg:min-h-0">
               <div className="absolute inset-0 flex items-center p-3 sm:p-5 gap-3 pr-16 lg:flex-col lg:items-start lg:justify-end lg:p-8">
                  <img src={getPlayerHeadshotUrl(selectedPlayer.id)} className="w-16 h-16 sm:w-20 sm:h-20 lg:w-52 lg:h-52 rounded-2xl sm:rounded-[2rem] object-cover bg-gray-950 border-4 border-slate-950 shadow-2xl" alt="" />
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-2 rounded-2xl bg-orange-500/10 text-orange-400 text-[9px] sm:text-xs font-black uppercase tracking-[0.12em] sm:tracking-[0.4em] mb-1 sm:mb-2 lg:mb-6 border border-orange-500/20 shadow-xl max-w-full">
                       <Trophy size={14} />
                       <span className="truncate">{selectedSeason} {selectedPlayer.awardType}</span>
                    </div>
                    <h2 className="text-xl sm:text-3xl lg:text-5xl font-black text-white tracking-tighter uppercase italic leading-none break-words">{selectedPlayer.name}</h2>
                  </div>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 scrollbar-hide space-y-5 sm:space-y-8">
               {loading ? (
                  <div className="flex flex-col items-center justify-center py-24 sm:py-40 gap-6 sm:gap-8"><Loader2 className="w-14 h-14 sm:w-20 sm:h-20 text-orange-500 animate-spin" /><div className="text-xs sm:text-sm font-black text-gray-700 uppercase tracking-[0.35em] sm:tracking-[1em]">Synchronizing Records</div></div>
               ) : (
                  <>
                     <section className="space-y-4 sm:space-y-8">
                        <div className="flex items-center gap-3 sm:gap-6"><div className="text-[9px] sm:text-[10px] font-black text-orange-500 uppercase tracking-[0.18em] sm:tracking-[0.6em]">Official Season Averages</div><div className="h-px flex-1 bg-white/5" /></div>
                        <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
                           <StatBox label="MIN" value={playerAverages?.MIN} />
                           <StatBox label="PTS" value={playerAverages?.PTS} />
                           <StatBox label="REB" value={playerAverages?.REB} />
                           <StatBox label="AST" value={playerAverages?.AST} />
                           <StatBox label="STL" value={playerAverages?.STL} />
                           <StatBox label="BLK" value={playerAverages?.BLK} />
                           <StatBox label="TOV" value={playerAverages?.TOV} />
                           <StatBox label="FG" value={playerAverages?.FGM !== undefined ? `${playerAverages.FGM}/${playerAverages.FGA}` : '-'} />
                           <StatBox label="3FG" value={playerAverages?.FG3M !== undefined ? `${playerAverages.FG3M}/${playerAverages.FG3A}` : '-'} />
                           <StatBox label="FT" value={playerAverages?.FTM !== undefined ? `${playerAverages.FTM}/${playerAverages.FTA}` : '-'} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                           <PctBox label="FIELD GOAL %" value={playerAverages?.FG_PCT} />
                           <PctBox label="THREE POINT %" value={playerAverages?.FG3_PCT} />
                           <PctBox label="FREE THROW %" value={playerAverages?.FT_PCT} />
                        </div>
                     </section>

                     <section className="space-y-4 sm:space-y-8 pb-10">
                        <div className="flex items-center gap-3 sm:gap-6"><div className="text-[9px] sm:text-[10px] font-black text-orange-500 uppercase tracking-[0.18em] sm:tracking-[0.6em]">Seasonal Match Journey</div><div className="h-px flex-1 bg-white/5" /><div className="text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-widest shrink-0">{playerStats.length} Games</div></div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
                           {playerStats.map((log, i) => (
                              <button key={i} onClick={() => handleGameClick(log)} className="flex items-center justify-between p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-orange-500/50 hover:bg-white/[0.05] transition-all group text-left">
                                 <div className="space-y-1 sm:space-y-2 min-w-0">
                                    <div className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">{log.GAME_DATE}</div>
                                    <div className="text-sm sm:text-lg font-black text-white uppercase group-hover:text-orange-400 italic tracking-tight truncate">{log.MATCHUP}</div>
                                 </div>
                                 <div className="flex items-center gap-4 sm:gap-10 shrink-0 ml-3">
                                    <MiniStat val={log.PTS} label="PTS" />
                                    <MiniStat val={log.REB} label="REB" />
                                    <MiniStat val={log.AST} label="AST" />
                                    <ChevronRight size={16} className="text-gray-800 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                                 </div>
                              </button>
                           ))}
                        </div>
                     </section>
                  </>
               )}
            </div>
          </div>
        </div>
      )}

      {selectedGame && (
        <BoxScoreModal 
          game={selectedGame} 
          boxScore={boxScore} 
          loading={loadingBox} 
          onPlayerClick={(p: any) => setDrillDownPlayer(p)}
          onClose={() => setSelectedGame(null)} 
        />
      )}

      {drillDownPlayer && (
        <PlayerOverlay 
          player={drillDownPlayer} 
          season={selectedSeason} 
          onClose={() => setDrillDownPlayer(null)} 
        />
      )}
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function AwardCard({ label, player, onClick, isCoach }: any) {
  const isClickable = !isCoach && player.id > 0;
  return (
    <div 
      onClick={isClickable ? onClick : undefined} 
      className={`bg-slate-900/30 border border-white/5 rounded-[2.5rem] overflow-hidden group transition-all duration-500 relative ${isClickable ? 'hover:border-orange-500/50 cursor-pointer hover:bg-slate-900/60 hover:shadow-[0_0_80px_rgba(249,115,22,0.1)]' : ''}`}
    >
      <div className="p-5 sm:p-6 relative z-10 flex items-center gap-5 sm:gap-6">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-[1.5rem] bg-black overflow-hidden border border-white/5 group-hover:border-orange-500/50 transition-all shadow-2xl shrink-0">
           <img 
             src={getPlayerHeadshotUrl(player.id)} 
             className="w-full h-full object-cover scale-125 translate-y-3 group-hover:scale-135 transition-transform" 
             alt="" 
           />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[8px] font-black text-orange-500 uppercase tracking-[0.4em] mb-1">{label}</div>
          <h3 className="text-base sm:text-lg font-black text-white italic uppercase tracking-tighter leading-tight group-hover:text-orange-400 transition-colors break-words">
            {player.name}
          </h3>
          
          {isCoach && (
            <div className="mt-2 flex items-center gap-1.5">
              <Trophy size={12} className="text-gray-800" />
              <span className="text-[8px] font-black text-gray-700 uppercase tracking-widest">HOF Record</span>
            </div>
          )}
          
          {isClickable && (
            <div className="mt-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex">
              <span className="text-[7px] font-black text-orange-500/60 uppercase tracking-widest">Stats →</span>
            </div>
          )}
        </div>
        {isClickable && (
          <div className="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center text-gray-800 group-hover:text-orange-500 group-hover:border-orange-500 transition-all shrink-0">
            <BarChart3 size={14} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: any) {
  return (
    <div className="p-2 sm:p-8 rounded-xl sm:rounded-[2.5rem] bg-white/[0.02] border border-white/5 text-center group hover:bg-white/[0.04] transition-colors shadow-inner min-w-0">
      <div className="text-base sm:text-4xl font-black text-white italic group-hover:text-orange-500 transition-colors tabular-nums truncate">
        {value !== undefined && value !== null ? value : '0'}
      </div>
      <div className="text-[8px] sm:text-[10px] font-black text-gray-700 uppercase tracking-widest mt-1 sm:mt-3">{label}</div>
    </div>
  );
}

function PctBox({ label, value }: any) {
  const displayVal = value !== undefined && value !== null && !isNaN(value) ? (value * 100).toFixed(1) + '%' : '0.0%';
  return (
    <div className="p-3 sm:p-10 rounded-xl sm:rounded-[3rem] bg-black/40 border border-white/5 text-center shadow-2xl group min-w-0">
       <div className="text-lg sm:text-4xl font-black text-orange-500 drop-shadow-[0_0_20px_rgba(249,115,22,0.4)] truncate">{displayVal}</div>
       <div className="text-[7px] sm:text-[10px] font-black text-gray-700 uppercase tracking-widest mt-1 sm:mt-3 truncate">{label}</div>
    </div>
  );
}

function MiniStat({ val, label }: any) {
  return (
    <div className="text-center min-w-[50px]"><div className="text-2xl font-black text-white italic">{val ?? 0}</div><div className="text-[9px] text-gray-700 font-black">{label}</div></div>
  );
}

function BoxScoreModal({ game, boxScore, loading, onPlayerClick, onClose }: any) {
  const [teamFilter, setTeamFilter] = useState<number | null>(null);
  const teamIds = useMemo<number[]>(() => Array.from(new Set((boxScore as BoxScorePlayer[]).map((p: BoxScorePlayer) => p.TEAM_ID))), [boxScore]);
  useEffect(() => { if (teamIds.length > 0 && !teamFilter) setTeamFilter(teamIds[0]); }, [teamIds, teamFilter]);
  const filtered = useMemo<BoxScorePlayer[]>(() => teamFilter ? (boxScore as BoxScorePlayer[]).filter((p: BoxScorePlayer) => p.TEAM_ID === teamFilter) : boxScore, [boxScore, teamFilter]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/99 backdrop-blur-3xl animate-in slide-in-from-bottom-20 duration-500">
      <div className="relative w-full max-w-7xl max-h-[96vh] overflow-hidden rounded-3xl sm:rounded-[3rem] border border-white/10 bg-slate-950 flex flex-col shadow-2xl">
        <div className="p-4 sm:p-10 bg-slate-900/40 border-b border-white/5 flex flex-col items-center">
          <button onClick={onClose} className="absolute top-4 right-4 sm:top-8 sm:right-8 text-gray-500 hover:text-white"><X size={28} /></button>
          <div className="pr-10 text-3xl sm:text-6xl font-black text-white italic uppercase tracking-tighter mb-4 sm:mb-8 drop-shadow-2xl text-center truncate max-w-full">{game.MATCHUP}</div>
          <div className="flex max-w-full gap-2 overflow-x-auto p-2 bg-black/60 rounded-2xl sm:rounded-[3rem] border border-white/10 shadow-inner">
            {teamIds.map(tid => (
              <button key={tid} onClick={() => setTeamFilter(tid)} className={`flex shrink-0 items-center gap-3 px-4 sm:px-8 py-3 sm:py-5 rounded-xl sm:rounded-[2.5rem] transition-all ${teamFilter === tid ? 'bg-orange-500 text-white shadow-[0_0_40px_rgba(249,115,22,0.4)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                <img src={getTeamLogoUrl(tid)} className="w-9 h-9 sm:w-14 sm:h-14 object-contain" alt="" />
                <span className="text-xs sm:text-base font-black uppercase tracking-widest">Team</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 scrollbar-hide">
          {loading ? <div className="col-span-full py-40 flex justify-center"><Loader2 className="w-20 h-20 text-orange-500 animate-spin" /></div> :
            filtered.map((p: any) => (
              <button key={p.PLAYER_ID} onClick={() => onPlayerClick(p)} className="flex items-center gap-3 sm:gap-5 p-3 sm:p-5 rounded-2xl sm:rounded-[2rem] border border-white/5 bg-white/[0.03] hover:border-orange-500/40 hover:bg-white/5 transition-all text-left group">
                <img src={getPlayerHeadshotUrl(p.PLAYER_ID)} className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-[2rem] object-cover bg-gray-900 shadow-2xl group-hover:scale-110 transition-transform" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm sm:text-lg font-black text-white uppercase truncate group-hover:text-orange-400">{p.PLAYER_NAME}</div>
                  <div className="text-[10px] text-gray-700 font-black uppercase mt-2 tracking-widest">{p.START_POSITION || 'BENCH'}</div>
                </div>
                <div className="text-right"><div className="text-2xl sm:text-4xl font-black text-orange-500 tabular-nums">{p.PTS || 0}</div><div className="text-[10px] text-gray-800 font-black uppercase mt-1">PTS</div></div>
              </button>
            ))
          }
        </div>
      </div>
    </div>
  );
}

function PlayerOverlay({ player, season, onClose }: any) {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { nbaApi.getPlayerDetailedStats(player.PLAYER_ID, season).then(res => setStats(res.slice(0, 10))).finally(() => setLoading(false)); }, [player.PLAYER_ID, season]);

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4 bg-black/99 backdrop-blur-3xl animate-in zoom-in-95 duration-300">
      <div className="relative w-full max-w-3xl max-h-[96vh] overflow-hidden rounded-3xl sm:rounded-[4rem] border border-white/10 bg-slate-950 shadow-[0_0_150px_rgba(0,0,0,1)] flex flex-col">
        <div className="h-36 sm:h-72 bg-gradient-to-br from-orange-600/50 to-transparent relative p-4 sm:p-12 flex items-end gap-4 sm:gap-10 pr-14">
          <button onClick={onClose} className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white hover:text-orange-500 transition-colors"><X size={28} /></button>
          <img src={getPlayerHeadshotUrl(player.PLAYER_ID)} className="w-24 h-24 sm:w-56 sm:h-56 rounded-2xl sm:rounded-[4rem] object-cover bg-gray-950 border-4 sm:border-8 border-slate-950 shadow-2xl translate-y-8 sm:translate-y-24" alt="" />
          <h2 className="text-2xl sm:text-6xl font-black text-white italic uppercase tracking-tighter pb-2 sm:pb-6 leading-none drop-shadow-2xl truncate">{player.PLAYER_NAME}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-12 pt-10 sm:pt-32 space-y-6 sm:space-y-12">
          <div className="grid grid-cols-4 gap-2 sm:gap-6">
             <Pill val={player.PTS} label="Points" />
             <Pill val={player.REB} label="Rebounds" />
             <Pill val={player.AST} label="Assists" />
             <Pill val={player.STL} label="Steals" />
          </div>
          <div className="space-y-4 sm:space-y-8">
            <h3 className="text-[10px] sm:text-[11px] font-black text-gray-700 uppercase tracking-[0.2em] sm:tracking-[0.6em] border-b border-white/5 pb-4 sm:pb-6">Historical Log Feed</h3>
            <div className="space-y-2 sm:space-y-4">
              {loading ? <div className="py-20 flex justify-center"><Loader2 className="w-12 h-12 text-orange-500 animate-spin" /></div> :
                stats.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-3 sm:p-6 rounded-2xl sm:rounded-[2.5rem] bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all">
                    <div className="text-[9px] sm:text-[10px] text-gray-600 w-20 sm:w-28 uppercase font-black tracking-widest shrink-0">{s.GAME_DATE}</div>
                    <div className="text-xs sm:text-sm font-black text-white flex-1 uppercase italic tracking-tight truncate">{s.MATCHUP}</div>
                    <div className="text-2xl sm:text-3xl font-black text-orange-500 italic tabular-nums">{s.PTS} <span className="text-[10px] sm:text-sm uppercase tracking-normal">PTS</span></div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({ val, label }: any) {
  return (
    <div className="p-2 sm:p-6 rounded-xl sm:rounded-[2.5rem] bg-white/5 border border-white/5 text-center shadow-2xl min-w-0">
      <div className="text-xl sm:text-4xl font-black text-white italic drop-shadow-2xl tabular-nums">{val || 0}</div>
      <div className="text-[8px] sm:text-[10px] font-black text-gray-700 uppercase mt-1 sm:mt-3 tracking-widest truncate">{label}</div>
    </div>
  );
}

const ChevronRight = ({ size, className }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);
