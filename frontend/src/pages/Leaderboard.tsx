import { useEffect, useState } from 'react';
import { Trophy, ChevronDown, TrendingUp, User, Users, Calendar, Award, Zap, Target, Shield, Clock, Search, ChevronRight } from 'lucide-react';
import { nbaApi, type Player, getPlayerHeadshotUrl, getTeamLogoUrl } from '../lib/api';
import BasketballLoader from '../components/BasketballLoader';

const CATEGORIES = [
  "Games played",
  "Points per game",
  "Total points",
  "Assists per game",
  "Total assists",
  "Rebounds per game",
  "Total rebounds",
  "Steals per game",
  "Total steals",
  "Blocks per game",
  "Total blocks",
  "Minutes per game",
  "Total minutes",
  "Turnovers per game",
  "Total turnovers",
  "Field goal %",
  "3-pointer %",
  "3-pointers made",
  "3-pointers attempted per game",
  "Free-throw %",
  "Free throws attempted per game",
  "+/- per game",
  "True-shooting %",
  "Real performance rating per game",
  "Offensive rebounds",
  "Defensive rebounds",
  "Personal fouls"
];

const SEASONS = [
  "Lifetime",
  ...Array.from({ length: 2026 - 1985 }, (_, i) => {
    const year = 2025 - i;
    return `${year}-${(year + 1).toString().slice(-2)}`;
  })
];

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("Points per game");
  const [season, setSeason] = useState(SEASONS[0]);
  const [seasonType, setSeasonType] = useState<"Regular Season" | "Playoffs">("Regular Season");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (selectedPlayer) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => { document.body.classList.remove('modal-open'); };
  }, [selectedPlayer]);

  useEffect(() => {
    const el = document.getElementById('leaderboard-player-modal');
    if (el) el.scrollTop = 0;
  }, [selectedPlayer?.PLAYER_ID]);

  useEffect(() => {
    async function loadLeaders() {
      setLoading(true);
      try {
        const mode = season === 'Lifetime' || category.toLowerCase().includes('total') || category.toLowerCase().includes('made') ? 'Totals' : 'PerGame';
        const data = await nbaApi.getLeaders(category, season, mode, seasonType);
        setLeaders(data);
      } catch (error) {
        console.error('Error fetching leaders:', error);
      } finally {
        setLoading(false);
      }
    }
    loadLeaders();
  }, [category, season, seasonType]);

  const filteredLeaders = leaders.filter(p => 
    p.PLAYER_NAME?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.TEAM_ABBREVIATION?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatValue = (p: any) => {
    const map: any = {
      "Games played": p.GP,
      "Points per game": p.PTS,
      "Total points": p.PTS,
      "Assists per game": p.AST,
      "Total assists": p.AST,
      "Rebounds per game": p.REB,
      "Total rebounds": p.REB,
      "Steals per game": p.STL,
      "Total steals": p.STL,
      "Blocks per game": p.BLK,
      "Total blocks": p.BLK,
      "Minutes per game": p.MIN,
      "Total minutes": p.MIN,
      "Field goal %": (p.FG_PCT * 100).toFixed(1) + '%',
      "3-pointer %": (p.FG3_PCT * 100).toFixed(1) + '%',
      "3-pointers made": p.FG3M,
      "3-pointers attempted per game": p.FG3A,
      "Free-throw %": (p.FT_PCT * 100).toFixed(1) + '%',
      "Free throws attempted per game": p.FTA,
      "Turnovers per game": p.TOV,
      "Total turnovers": p.TOV,
      "+/- per game": p.PLUS_MINUS,
      "True-shooting %": (p.TS_PCT * 100).toFixed(1) + '%',
      "Real performance rating per game": p.PER?.toFixed(1),
      "Offensive rebounds": p.OREB,
      "Defensive rebounds": p.DREB,
      "Personal fouls": p.PF
    };
    return map[category] ?? p.PTS;
  };

  return (
    <div className="space-y-6">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">Stat Leaderboard</h1>
          <p className="text-sm text-gray-400">Comprehensive historical performance tracking from 1985-2025.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-xl">
             <button 
               onClick={() => setSeasonType("Regular Season")}
               className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${seasonType === "Regular Season" ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
             >
               Regular
             </button>
             <button 
               onClick={() => setSeasonType("Playoffs")}
               className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${seasonType === "Playoffs" ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
             >
               Playoffs
             </button>
          </div>

          <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-1.5 rounded-2xl backdrop-blur-xl relative">
             <Calendar className="ml-3 text-orange-500" size={16} />
             <select 
               value={season}
               onChange={(e) => setSeason(e.target.value)}
               className="bg-transparent text-sm font-bold text-white px-3 py-2 outline-none cursor-pointer appearance-none min-w-[120px] relative z-10"
             >
               {SEASONS.map(s => <option key={s} value={s} className="bg-gray-900">{s}</option>)}
             </select>
             <ChevronDown className="mr-3 text-gray-500" size={14} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <div className="lg:col-span-1">
          <details className="lg:hidden mb-4 bg-gradient-to-br from-gray-900 to-gray-800 border border-white/10 rounded-2xl overflow-hidden">
            <summary className="p-4 text-sm font-black text-white uppercase tracking-widest cursor-pointer flex items-center justify-between">
              <span>Metrics: {category}</span>
              <ChevronDown size={16} className="text-orange-500" />
            </summary>
            <div className="p-3 space-y-1 max-h-64 overflow-y-auto custom-scrollbar border-t border-white/10">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between group ${
                    category === cat
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </details>
          <div className="hidden lg:block bg-gradient-to-br from-gray-900 to-gray-800 border border-white/10 rounded-2xl p-4 shadow-2xl sticky top-24">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 px-2">Metrics</h3>
            <div className="space-y-1 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between group ${
                    category === cat
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                  }`}
                >
                  {cat}
                  <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition-opacity ${category === cat ? 'opacity-100' : ''}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Top 3 Spotlight */}
          {!loading && filteredLeaders.length >= 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
               {[1, 0, 2].map(idx => {
                 const p = filteredLeaders[idx];
                 if (!p) return null;
                 const rank = idx === 0 ? '1st' : idx === 1 ? '2nd' : '3rd';
                 const color = idx === 0 ? 'border-yellow-500/50 from-yellow-500/10' : idx === 1 ? 'border-gray-400/50 from-gray-400/10' : 'border-orange-500/50 from-orange-500/10';
                 
                 return (
                   <div 
                    key={p.PLAYER_ID} 
                    onClick={() => setSelectedPlayer(p)}
                    className={`relative bg-gradient-to-b ${color} to-transparent border rounded-3xl p-6 text-center shadow-md hover:shadow-lg hover:shadow-orange-500/10 overflow-hidden group hover:scale-105 transition-transform duration-200 cursor-pointer`}
                   >
                      <div className="absolute top-0 right-0 p-4">
                         <div className={`text-4xl font-black opacity-10 italic tracking-tighter ${idx === 0 ? 'text-yellow-500' : 'text-white'}`}>{rank}</div>
                      </div>
                      
                      <div className="relative mb-4 inline-block">
                         <div className="absolute -inset-4 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all" />
                         <img 
                           src={getPlayerHeadshotUrl(p.PLAYER_ID!)} 
                           alt={p.PLAYER_NAME}
                           className="w-24 h-24 object-cover rounded-full border-4 border-white/10 relative z-10 mx-auto"
                           onError={(e) => e.currentTarget.src = 'https://www.nba.com/assets/logos/teams/primary/web/NBA.svg'}
                         />
                         {season !== 'Lifetime' && (
                           <div className="absolute -bottom-2 -right-2 bg-gray-900 rounded-full p-1.5 border border-white/10 z-20 shadow-xl">
                              <img src={getTeamLogoUrl(p.TEAM_ID)} className="w-6 h-6 object-contain" />
                           </div>
                         )}
                      </div>
                      
                      <h3 className="text-xl font-black text-white italic tracking-tight">{p.PLAYER_NAME}</h3>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                        {season === 'Lifetime' ? 'NBA Legend' : p.TEAM_ABBREVIATION} • {rank} Leader
                      </p>
                      
                      <div className="inline-block bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-2">
                         <span className="text-2xl font-black text-white tracking-tighter italic">{getStatValue(p)}</span>
                         <span className="text-[10px] font-bold text-gray-500 ml-2 uppercase tracking-widest">{category.split(' ').pop()}</span>
                      </div>
                   </div>
                 );
               })}
            </div>
          )}

          {/* List View */}
          <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
            <div className="p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="flex items-center gap-3">
                  <div className="bg-orange-500/20 p-2 rounded-xl border border-orange-500/20">
                     <Trophy className="text-orange-500" size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white italic uppercase tracking-tight">Stat Leaderboard</h2>
                    <p className="text-xs text-gray-500 font-bold">
                      {season === 'Lifetime' ? `NBA Historical All-Time ${seasonType}` : `${season} ${seasonType}`} Analysis
                    </p>
                  </div>
               </div>
               
               <div className="relative group">
                 <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-500 transition-colors" />
                 <input 
                   type="text" 
                   placeholder="Search players..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 pl-12 pr-4 text-sm font-bold text-white outline-none transition-all focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 sm:min-w-[240px]"
                 />
               </div>
            </div>

            <div className="w-full overflow-x-auto rounded-xl">
              {loading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <BasketballLoader />
                </div>
              ) : filteredLeaders.length > 0 ? (
                <table className="w-full min-w-[600px] text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-white/[0.02] text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] border-b border-white/10">
                      <th className="py-5 px-4 sm:px-8">Rank</th>
                      <th className="py-5 px-4">Player</th>
                      <th className="py-5 px-4 hidden sm:table-cell">Team</th>
                      <th className="py-5 px-4 hidden sm:table-cell">Games</th>
                      <th className="py-5 px-4 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredLeaders.map((p, idx) => (
                      <tr
                        key={p.PLAYER_ID}
                        onClick={() => setSelectedPlayer(p)}
                        className="group hover:bg-white/5 transition-all duration-300 cursor-pointer"
                      >
                        <td className="py-4 px-4 sm:px-8">
                          {idx < 3 ? (
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black italic shadow-lg ${
                              idx === 0 ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 text-black' :
                              idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                              'bg-gradient-to-br from-orange-300 to-orange-700 text-white'
                            }`}>
                               {idx + 1}
                            </div>
                          ) : (
                            <span className="text-sm font-black italic tracking-tighter text-gray-500 group-hover:text-gray-300 transition-colors">
                              #{idx + 1}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <div className="absolute inset-0 bg-white/5 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                              <img
                                src={getPlayerHeadshotUrl(p.PLAYER_ID!)}
                                className="w-10 h-10 rounded-full border border-white/10 bg-gray-800 relative z-10"
                                onError={(e) => e.currentTarget.src = 'https://www.nba.com/assets/logos/teams/primary/web/NBA.svg'}
                              />
                            </div>
                            <div>
                               <p className="text-sm font-black text-white italic group-hover:text-orange-400 transition-colors">{p.PLAYER_NAME}</p>
                               <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest sm:hidden">{season === 'Lifetime' ? 'Career' : p.TEAM_ABBREVIATION}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 hidden sm:table-cell">
                          {season !== 'Lifetime' && p.TEAM_ID !== 0 ? (
                            <div className="flex items-center gap-2">
                              <img src={getTeamLogoUrl(p.TEAM_ID)} className="w-6 h-6 object-contain" />
                              <span className="text-xs font-bold text-gray-400">{p.TEAM_ABBREVIATION}</span>
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-gray-500 italic uppercase">NBA Legend</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-xs font-bold text-gray-500 hidden sm:table-cell">
                          {p.GP} <span className="text-[9px] opacity-50 uppercase ml-1">games</span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="text-lg font-black text-white italic tracking-tighter">
                            {getStatValue(p)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-center p-12">
                   <div className="bg-white/5 p-4 rounded-full mb-4 border border-white/10">
                      <Search className="text-gray-600" size={32} />
                   </div>
                   <h3 className="text-xl font-black text-white italic uppercase mb-2">No Leaders Found</h3>
                   <p className="text-sm text-gray-500 max-w-xs">We couldn't find any data for this specific category and season combo. Try another metric.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Stats Modal */}
      {selectedPlayer && (
        <div id="leaderboard-player-modal" className="fixed inset-0 z-[100] overflow-y-auto bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
           <div className="flex min-h-full items-end sm:items-center justify-center">
              <div className="bg-gray-900 border border-white/10 rounded-[2.5rem] w-full max-w-2xl shadow-2xl relative animate-in zoom-in-95 duration-300">
              <button 
                onClick={() => setSelectedPlayer(null)}
                className="absolute top-6 right-6 text-gray-500 hover:text-white bg-white/5 p-2.5 rounded-full z-20 transition-all border border-white/5 hover:bg-white/10"
              >
                <ChevronRight size={20} className="rotate-45" />
              </button>
              
              <div className="relative h-48 overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 to-transparent" />
                 <div className="absolute -bottom-12 left-10 flex items-end gap-6 z-10">
                    <div className="relative">
                       <div className="absolute -inset-4 bg-orange-500/20 rounded-full blur-2xl" />
                       <img 
                         src={getPlayerHeadshotUrl(selectedPlayer.PLAYER_ID!)} 
                         alt={selectedPlayer.PLAYER_NAME}
                         className="w-32 h-32 object-cover rounded-full border-4 border-gray-900 bg-gray-800 shadow-2xl relative z-10"
                       />
                       {season !== 'Lifetime' && (
                         <div className="absolute -bottom-2 -right-2 bg-gray-900 rounded-full p-2 border border-white/10 z-20 shadow-xl">
                            <img src={getTeamLogoUrl(selectedPlayer.TEAM_ID)} className="w-8 h-8 object-contain" />
                         </div>
                       )}
                    </div>
                    <div className="mb-14">
                       <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">{selectedPlayer.PLAYER_NAME}</h2>
                       <p className="text-xs font-bold text-orange-500 uppercase tracking-[0.3em]">{selectedPlayer.TEAM_ABBREVIATION} • {season === 'Lifetime' ? 'CAREER STATS' : `${season} SEASON`}</p>
                    </div>
                 </div>
              </div>

              <div className="p-10 pt-16">
                 <div className="grid grid-cols-3 gap-6 mb-10">
                    <StatBox label="Points" value={selectedPlayer.PTS} sub="PPG" color="text-orange-500" />
                    <StatBox label="Rebounds" value={selectedPlayer.REB} sub="RPG" color="text-blue-500" />
                    <StatBox label="Assists" value={selectedPlayer.AST} sub="APG" color="text-emerald-500" />
                 </div>

                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MiniStat label="GP" value={selectedPlayer.GP} />
                    <MiniStat label="MIN" value={selectedPlayer.MIN?.toFixed(1)} />
                    <MiniStat label="FG%" value={(selectedPlayer.FG_PCT * 100).toFixed(1) + '%'} />
                    <MiniStat label="3P%" value={(selectedPlayer.FG3_PCT * 100).toFixed(1) + '%'} />
                    <MiniStat label="STL" value={selectedPlayer.STL} />
                    <MiniStat label="BLK" value={selectedPlayer.BLK} />
                    <MiniStat label="TOV" value={selectedPlayer.TOV} />
                    <MiniStat label="+/-" value={selectedPlayer.PLUS_MINUS} />
                 </div>

                 <div className="mt-10 flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/10">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                          <Award className="text-yellow-500" size={24} />
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Advanced Rating</p>
                          <p className="text-2xl font-black text-white italic">{(selectedPlayer as any).PER?.toFixed(2) || 'N/A'}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">True Shooting</p>
                       <p className="text-2xl font-black text-emerald-400 italic">{((selectedPlayer as any).TS_PCT * 100).toFixed(1)}%</p>
                    </div>
                 </div>
              </div>
           </div>
           </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, sub, color }: any) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center group hover:bg-white/[0.08] transition-all">
       <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">{label}</p>
       <div className="flex items-baseline justify-center gap-1">
          <span className={`text-4xl font-black tracking-tighter italic ${color}`}>{value}</span>
          <span className="text-[10px] font-bold text-gray-500 uppercase">{sub}</span>
       </div>
    </div>
  );
}

function MiniStat({ label, value }: any) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center">
       <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{label}</p>
       <p className="text-lg font-black text-white italic">{value}</p>
    </div>
  );
}
