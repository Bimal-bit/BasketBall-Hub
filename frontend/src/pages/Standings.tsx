import { useEffect, useState, useMemo } from 'react';
import { Calendar, Trophy, ChevronRight, X, Loader2 } from 'lucide-react';
import {
  nbaApi,
  getTeamLogoUrl,
  getPlayerHeadshotUrl,
  type Standing,
  type TeamGame,
  type BoxScorePlayer,
  type PlayerGameLog
} from '../lib/api';
import BasketballLoader from '../components/BasketballLoader';

// ─── Types ───────────────────────────────────────────────────────────────────
interface PlayoffSeries {
  seriesId: string;
  homeId: number;
  visitorId: number;
  homeName: string;
  visitorName: string;
  homeWins: number;
  visitorWins: number;
  round: number;
  conference: 'East' | 'West' | 'Finals';
  games: any[];
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Standings() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [playoffSeries, setPlayoffSeries] = useState<PlayoffSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState('2024-25');
  const [seasonType, setSeasonType] = useState('Regular Season');
  
  const [selectedTeam, setSelectedTeam] = useState<Standing | null>(null);
  const [teamGames, setTeamGames] = useState<TeamGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [selectedGame, setSelectedGame] = useState<TeamGame | null>(null);
  const [boxScore, setBoxScore] = useState<BoxScorePlayer[]>([]);
  const [loadingBox, setLoadingBox] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<BoxScorePlayer | null>(null);

  const seasons = Array.from({ length: 2025 - 1985 + 1 }, (_, i) => {
    const y = 2025 - i;
    return `${y}-${String(y + 1).slice(-2)}`;
  });

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [sData, pData] = await Promise.all([
          nbaApi.getStandings(season, 'Regular Season'),
          nbaApi.getPlayoffs(season)
        ]);
        
        setStandings(sData);
        const teamMap: Record<number, string> = {};
        sData.forEach(st => teamMap[st.TeamID] = st.TeamName);
        
        // pData now contains merged game info with WL
        const grouped: Record<string, any> = {};
        pData.forEach((g: any) => {
          const sid = g.SERIES_ID;
          if (!sid) return;
          if (!grouped[sid]) {
            const r = parseInt(sid.charAt(7)) || 1;
            grouped[sid] = {
              seriesId: sid,
              homeId: g.HOME_TEAM_ID,
              visitorId: g.VISITOR_TEAM_ID,
              homeName: teamMap[g.HOME_TEAM_ID] || 'TBD',
              visitorName: teamMap[g.VISITOR_TEAM_ID] || 'TBD',
              wins: {} as Record<number, number>,
              round: r,
              conference: r === 4 ? 'Finals' : 'West',
              games: []
            };
          }
          
          // Calculate wins reliably
          if (g.WL === 'W') {
             grouped[sid].wins[g.TEAM_ID] = (grouped[sid].wins[g.TEAM_ID] || 0) + 1;
          }

          // Track scores for both teams in the same game object
          let gameObj = grouped[sid].games.find((eg: any) => eg.GAME_ID === g.GAME_ID);
          if (!gameObj) {
            gameObj = { 
              GAME_ID: g.GAME_ID, 
              GAME_DATE: g.GAME_DATE, 
              MATCHUP: g.MATCHUP,
              scores: {} as Record<number, number>,
              wl: {} as Record<number, string>
            };
            grouped[sid].games.push(gameObj);
          }
          gameObj.scores[g.TEAM_ID] = g.PTS;
          gameObj.wl[g.TEAM_ID] = g.WL;
        });
        
        const seriesList = Object.values(grouped).map((s: any) => {
          const isWest = sData.find(st => st.TeamID === s.homeId)?.Conference?.includes('West');
          return {
            ...s,
            homeWins: s.wins[s.homeId] || 0,
            visitorWins: s.wins[s.visitorId] || 0,
            conference: s.round === 4 ? 'Finals' as const : (isWest ? 'West' as const : 'East' as const)
          };
        });
        
        setPlayoffSeries(seriesList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [season]);

  const eastStandings = useMemo(() => standings.filter(s => s.Conference?.includes('East')).sort((a,b) => b.WinPCT - a.WinPCT), [standings]);
  const westStandings = useMemo(() => standings.filter(s => s.Conference?.includes('West')).sort((a,b) => b.WinPCT - a.WinPCT), [standings]);

  async function handleTeamClick(team: any) {
    const tid = team.TeamID || team.teamId;
    const sTeam = standings.find(s => s.TeamID === tid);
    setSelectedTeam({
      TeamID: tid,
      TeamName: sTeam?.TeamName || team.TeamName || 'Team',
      TeamCity: sTeam?.TeamCity || '',
      Conference: sTeam?.Conference || '',
      Wins: sTeam?.Wins || 0,
      Losses: sTeam?.Losses || 0,
      WinPCT: sTeam?.WinPCT || 0,
      L10Rec: sTeam?.L10Rec || '',
      Strk: sTeam?.Strk || ''
    });
    setLoadingGames(true);
    try {
      const games = await nbaApi.getTeamGameLog(tid, season, seasonType === 'Regular Season' ? 'Regular Season' : 'Playoffs');
      setTeamGames(games);
    } catch (err) { console.error(err); }
    finally { setLoadingGames(false); }
  }

  async function handleGameClick(game: any) {
    setSelectedGame(game);
    setLoadingBox(true);
    try {
      const box = await nbaApi.getBoxScore(game.GAME_ID);
      setBoxScore(box);
    } catch (err) { console.error(err); }
    finally { setLoadingBox(false); }
  }

  return (
    <div className="p-4 lg:p-6 space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/40 p-8 rounded-[3rem] border border-white/5 backdrop-blur-xl">
        <div>
          <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">League Standings</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.5em] mt-2">NBA Official Season {season}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 bg-black/60 border border-white/10 rounded-2xl px-6 py-3.5">
            <Calendar size={18} className="text-orange-500" />
            <select value={season} onChange={e => setSeason(e.target.value)} className="bg-transparent text-white text-sm font-black uppercase outline-none cursor-pointer">
              {seasons.map(s => <option key={s} value={s} className="bg-slate-950">{s}</option>)}
            </select>
          </div>
          <div className="flex bg-black/60 border border-white/10 rounded-2xl p-1.5">
            {['Regular Season', 'Playoffs', 'Finals'].map(type => (
              <button key={type} onClick={() => setSeasonType(type)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${seasonType === type ? 'bg-orange-500 text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}>
                {type.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <BasketballLoader />
        </div>
      ) : seasonType === 'Playoffs' ? (
        <PlayoffBracket series={playoffSeries} onTeamClick={handleTeamClick} />
      ) : seasonType === 'Finals' ? (
        <FinalsView series={playoffSeries.find(s => s.round === 4)} onTeamClick={handleTeamClick} onGameClick={handleGameClick} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
          <ConferenceTable title="Eastern Conference" teams={eastStandings} onTeamClick={handleTeamClick} />
          <ConferenceTable title="Western Conference" teams={westStandings} onTeamClick={handleTeamClick} />
        </div>
      )}

      {selectedTeam && <TeamLogModal team={selectedTeam} games={teamGames} loading={loadingGames} onGameClick={handleGameClick} onClose={() => setSelectedTeam(null)} />}
      {selectedGame && <BoxScoreModal game={selectedGame} boxScore={boxScore} loading={loadingBox} onPlayerClick={(p:any)=>setSelectedPlayer(p)} onClose={() => setSelectedGame(null)} />}
      {selectedPlayer && <PlayerStatsModal player={selectedPlayer} season={season} onClose={() => setSelectedPlayer(null)} />}
    </div>
  );
}

// ─── Content Views ──────────────────────────────────────────────────────────

function ConferenceTable({ title, teams, onTeamClick }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter px-2">{title}</h2>
      <div className="bg-slate-900/20 border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-md">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/5 border-b border-white/5">
              <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-500">Rank</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-500">Team</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-500 text-center">W-L</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-500 text-center">PCT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {teams.map((team: any, i: number) => (
              <tr key={team.TeamID} onClick={() => onTeamClick(team)} className="group hover:bg-white/5 transition-all cursor-pointer">
                <td className="px-8 py-5 font-black text-gray-600">{i + 1}</td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-6">
                    <img src={getTeamLogoUrl(team.TeamID)} className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" alt="" />
                    <div className="text-base font-black text-white uppercase group-hover:text-orange-400">{team.TeamCity} {team.TeamName}</div>
                  </div>
                </td>
                <td className="px-8 py-5 text-center font-black text-white italic">{team.Wins}-{team.Losses}</td>
                <td className="px-8 py-5 text-center font-black text-orange-400 italic">{((team.WinPCT || 0) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayoffBracket({ series, onTeamClick }: any) {
  return (
    <div className="flex justify-between items-start min-w-[1200px] gap-12 p-8 overflow-x-auto scrollbar-hide">
      <div className="flex gap-16">
        <RoundColumn title="First Round" series={series.filter(s => s.round === 1 && s.conference === 'West')} onTeamClick={onTeamClick} />
        <RoundColumn title="Semifinals" series={series.filter(s => s.round === 2 && s.conference === 'West')} onTeamClick={onTeamClick} />
        <RoundColumn title="Conf. Finals" series={series.filter(s => s.round === 3 && s.conference === 'West')} onTeamClick={onTeamClick} />
      </div>
      <div className="flex flex-col items-center justify-center pt-32"><Trophy size={80} className="text-orange-500/20 animate-pulse" /></div>
      <div className="flex flex-row-reverse gap-16">
        <RoundColumn title="First Round" series={series.filter(s => s.round === 1 && s.conference === 'East')} onTeamClick={onTeamClick} />
        <RoundColumn title="Semifinals" series={series.filter(s => s.round === 2 && s.conference === 'East')} onTeamClick={onTeamClick} />
        <RoundColumn title="Conf. Finals" series={series.filter(s => s.round === 3 && s.conference === 'East')} onTeamClick={onTeamClick} />
      </div>
    </div>
  );
}

function RoundColumn({ title, series, onTeamClick }: any) {
  return (
    <div className="flex flex-col gap-10 w-64">
      <h3 className="text-center text-[11px] font-black text-gray-600 uppercase tracking-[0.5em]">{title}</h3>
      <div className="flex flex-col gap-8 justify-center flex-1">
        {series.map((s: any) => (
          <div key={s.seriesId} className="rounded-[2rem] border border-white/5 bg-slate-900/40 overflow-hidden shadow-2xl backdrop-blur-md">
             <SeriesRow id={s.homeId} name={s.homeName} wins={s.homeWins} onClick={() => onTeamClick({ TeamID: s.homeId, name: s.homeName })} isWinner={s.homeWins >= 4} />
             <div className="h-px bg-white/5" />
             <SeriesRow id={s.visitorId} name={s.visitorName} wins={s.visitorWins} onClick={() => onTeamClick({ TeamID: s.visitorId, name: s.visitorName })} isWinner={s.visitorWins >= 4} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SeriesRow({ id, name, wins, onClick, isWinner }: any) {
  return (
    <div onClick={onClick} className={`flex items-center justify-between p-5 cursor-pointer hover:bg-white/5 transition-all ${isWinner ? 'bg-orange-500/10' : ''}`}>
       <div className="flex items-center gap-4">
          <img src={getTeamLogoUrl(id)} className="w-10 h-10 object-contain" alt="" />
          <span className={`text-xs font-black uppercase tracking-tight ${isWinner ? 'text-white' : 'text-gray-500'}`}>{name}</span>
       </div>
       <span className={`text-2xl font-black italic ${isWinner ? 'text-orange-500' : 'text-gray-700'}`}>{wins}</span>
    </div>
  );
}

function FinalsView({ series, onTeamClick, onGameClick }: any) {
  if (!series) return <div className="py-40 text-center text-gray-700 font-black uppercase tracking-widest">Finals Matchup Pending</div>;
  return (
    <div className="max-w-7xl mx-auto space-y-16">
      <div className="relative overflow-hidden rounded-[5rem] border border-orange-500/20 bg-slate-950 p-24 text-center shadow-[0_0_100px_rgba(249,115,22,0.1)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.15),transparent)]" />
        <div className="relative z-10 flex flex-col items-center gap-16">
          <div className="flex items-center justify-center gap-20 sm:gap-40">
             <div onClick={() => onTeamClick({ TeamID: series.homeId, name: series.homeName })} className="cursor-pointer group text-center">
                <img src={getTeamLogoUrl(series.homeId)} className="w-64 h-64 object-contain group-hover:scale-110 transition-transform mb-8 mx-auto" alt="" />
                <div className="text-4xl font-black text-white uppercase italic tracking-tighter mb-4">{series.homeName}</div>
                <div className="text-8xl font-black text-orange-500 italic tabular-nums drop-shadow-[0_0_30px_rgba(249,115,22,0.5)]">{series.homeWins}</div>
             </div>
             <div className="text-[120px] font-black text-gray-900 italic select-none">VS</div>
             <div onClick={() => onTeamClick({ TeamID: series.visitorId, name: series.visitorName })} className="cursor-pointer group text-center">
                <img src={getTeamLogoUrl(series.visitorId)} className="w-64 h-64 object-contain group-hover:scale-110 transition-transform mb-8 mx-auto" alt="" />
                <div className="text-4xl font-black text-white uppercase italic tracking-tighter mb-4">{series.visitorName}</div>
                <div className="text-8xl font-black text-orange-500 italic tabular-nums drop-shadow-[0_0_30px_rgba(249,115,22,0.5)]">{series.visitorWins}</div>
             </div>
          </div>
          <div className="text-sm font-black text-gray-500 uppercase tracking-[1.5em]">NBA Finals Championship</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
        {series.games.map((g: any, i: number) => {
          const hScore = g.scores[series.homeId];
          const vScore = g.scores[series.visitorId];
          const hasScore = hScore !== undefined && vScore !== undefined;
          
          return (
            <button 
              key={i} 
              onClick={hasScore ? () => onGameClick(g) : undefined} 
              disabled={!hasScore}
              className={`p-10 rounded-[3rem] border border-white/5 bg-white/5 transition-all text-left group ${hasScore ? 'hover:border-orange-500/50 hover:bg-orange-500/5 cursor-pointer' : 'opacity-40 cursor-default'}`}
            >
              <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-6">Game {i+1}</div>
              <div className={`text-3xl font-black italic ${hasScore ? 'text-white group-hover:text-orange-400' : 'text-gray-500'}`}>
                 {hasScore ? `${hScore} - ${vScore}` : 'TBD'}
              </div>
              <div className="text-xs font-bold text-gray-700 uppercase tracking-[0.2em] mt-4">{g.GAME_DATE || 'SCHEDULED'}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Modals ──────────────────────────────────────────────────────────────────

function TeamLogModal({ team, games, loading, onGameClick, onClose }: any) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/98 backdrop-blur-3xl">
      <div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-[4rem] border border-white/10 bg-slate-950 flex flex-col shadow-2xl">
        <div className="p-10 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-8">
            <img src={getTeamLogoUrl(team.TeamID)} className="w-20 h-20 object-contain" alt="" />
            <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">{team.TeamCity} {team.TeamName}</h2>
          </div>
          <button onClick={onClose} className="w-16 h-16 rounded-full bg-white/5 text-gray-500 hover:text-white transition-all"><X size={32} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 scrollbar-hide">
          {loading ? (
            <div className="col-span-full py-20 flex justify-center">
              <BasketballLoader />
            </div>
          ) :
            games.map((g: any) => (
              <button key={g.GAME_ID} onClick={() => onGameClick(g)} className="flex items-center justify-between p-6 rounded-3xl border border-white/5 bg-white/[0.02] hover:border-orange-500/50 transition-all text-left">
                <div>
                  <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{g.GAME_DATE}</div>
                  <div className="text-base font-bold text-white uppercase truncate">{g.MATCHUP}</div>
                </div>
                <div className={`text-2xl font-black italic ${g.WL === 'W' ? 'text-green-500' : 'text-red-500'}`}>{g.WL}</div>
              </button>
            ))
          }
        </div>
      </div>
    </div>
  );
}

function BoxScoreModal({ game, boxScore, loading, onPlayerClick, onClose }: any) {
  const [teamFilter, setTeamFilter] = useState<number | null>(null);
  const teamIds = useMemo(() => Array.from(new Set(boxScore.map(p => p.TEAM_ID))), [boxScore]);
  useEffect(() => { if (teamIds.length > 0 && !teamFilter) setTeamFilter(teamIds[0]); }, [teamIds, teamFilter]);
  const filtered = useMemo(() => teamFilter ? boxScore.filter(p => p.TEAM_ID === teamFilter) : boxScore, [boxScore, teamFilter]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/99 backdrop-blur-3xl animate-in slide-in-from-bottom-20 duration-500">
      <div className="relative w-full max-w-7xl max-h-[95vh] overflow-hidden rounded-[5rem] border border-white/10 bg-slate-950 flex flex-col shadow-2xl">
        <div className="p-12 bg-slate-900/60 border-b border-white/5 flex flex-col items-center">
          <button onClick={onClose} className="absolute top-12 right-12 text-gray-500 hover:text-white"><X size={40} /></button>
          <div className="text-6xl font-black text-white italic uppercase tracking-tighter mb-10">{game.MATCHUP}</div>
          <div className="flex gap-6 p-2.5 bg-black/60 rounded-[2.5rem] border border-white/10 shadow-2xl">
            {teamIds.map(tid => (
              <button key={tid} onClick={() => setTeamFilter(tid)} className={`flex items-center gap-5 px-10 py-5 rounded-[2rem] transition-all ${teamFilter === tid ? 'bg-orange-500 text-white shadow-2xl' : 'text-gray-500 hover:text-white'}`}>
                <img src={getTeamLogoUrl(tid)} className="w-12 h-12 object-contain" alt="" />
                <span className="text-base font-black uppercase tracking-widest">Select Team</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 scrollbar-hide">
          {loading ? (
            <div className="col-span-full py-20 flex justify-center">
              <BasketballLoader />
            </div>
          ) :
            filtered.map((p: any) => (
              <button key={p.PLAYER_ID} onClick={() => onPlayerClick(p)} className="flex items-center gap-6 p-6 rounded-[3rem] border border-white/5 bg-white/[0.03] hover:border-orange-500/40 transition-all text-left group">
                <img src={getPlayerHeadshotUrl(p.PLAYER_ID)} className="w-20 h-20 rounded-[2rem] object-cover bg-gray-900 shadow-2xl group-hover:scale-110 transition-transform" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-black text-white uppercase truncate group-hover:text-orange-400">{p.PLAYER_NAME}</div>
                  <div className="text-[10px] text-gray-600 font-black uppercase mt-1 tracking-widest">{p.START_POSITION || 'BENCH'}</div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black text-orange-500 tabular-nums">{p.PTS || 0}</div>
                  <div className="text-[10px] text-gray-700 font-black uppercase">PTS</div>
                </div>
              </button>
            ))
          }
        </div>
      </div>
    </div>
  );
}

function PlayerStatsModal({ player, season, onClose }: any) {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { nbaApi.getPlayerDetailedStats(player.PLAYER_ID, season).then(res => setStats(res.slice(0, 10))).finally(() => setLoading(false)); }, [player.PLAYER_ID, season]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/99 backdrop-blur-3xl animate-in zoom-in-95 duration-300">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[5rem] border border-white/10 bg-slate-950 shadow-2xl">
        <div className="h-72 bg-gradient-to-br from-orange-600/50 to-transparent relative p-12 flex items-end gap-12">
          <button onClick={onClose} className="absolute top-12 right-12 text-white hover:text-orange-500 transition-colors"><X size={40} /></button>
          <img src={getPlayerHeadshotUrl(player.PLAYER_ID)} className="w-64 h-64 rounded-[4rem] object-cover bg-gray-950 border-8 border-slate-950 shadow-2xl translate-y-24" alt="" />
          <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter pb-6 leading-none">{player.PLAYER_NAME}</h2>
        </div>
        <div className="p-16 pt-40 space-y-16">
          <div className="grid grid-cols-4 gap-8">
            <StatPill val={player.PTS} label="Points" />
            <StatPill val={player.REB} label="Rebounds" />
            <StatPill val={player.AST} label="Assists" />
            <StatPill val={player.STL} label="Steals" />
          </div>
          <div className="space-y-8">
            <h3 className="text-[11px] font-black text-gray-700 uppercase tracking-[0.5em] border-b border-white/5 pb-6">Official Performance Feed</h3>
            <div className="space-y-4">
              {loading ? <div className="py-12 flex justify-center"><Loader2 className="w-10 h-10 text-orange-500 animate-spin" /></div> :
                stats.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all">
                    <div className="text-[10px] text-gray-500 w-32 uppercase font-black tracking-widest">{s.GAME_DATE}</div>
                    <div className="text-xs font-black text-white flex-1 uppercase tracking-tight">{s.MATCHUP}</div>
                    <div className="text-3xl font-black text-orange-500 italic tabular-nums">{s.PTS} <span className="text-[12px] uppercase tracking-normal">PTS</span></div>
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

function StatPill({ val, label }: any) {
  return (
    <div className="p-8 rounded-[3rem] bg-white/5 border border-white/5 text-center shadow-2xl">
      <div className="text-4xl font-black text-white italic drop-shadow-2xl tabular-nums">{val || 0}</div>
      <div className="text-[10px] text-gray-700 font-black uppercase mt-3 tracking-widest">{label}</div>
    </div>
  );
}
