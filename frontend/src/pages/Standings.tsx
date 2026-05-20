import { useEffect, useState, useMemo } from 'react';
import { Calendar, Trophy, X, Loader2 } from 'lucide-react';
import {
  nbaApi,
  getTeamLogoUrl,
  getPlayerHeadshotUrl,
  type Standing,
  type TeamGame,
  type BoxScorePlayer
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
  const [season, setSeason] = useState('2025-26');
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-slate-900/40 p-4 sm:p-8 rounded-3xl sm:rounded-[3rem] border border-white/5 backdrop-blur-xl">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-white italic uppercase tracking-tighter">League Standings</h1>
          <p className="text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] sm:tracking-[0.5em] mt-2">NBA Official Season {season}</p>
        </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-3 bg-black/60 border border-white/10 rounded-2xl px-4 py-3">
            <Calendar size={18} className="text-orange-500 shrink-0" />
            <select value={season} onChange={e => setSeason(e.target.value)} className="bg-transparent text-white text-sm font-black uppercase outline-none cursor-pointer w-full">
              {seasons.map(s => <option key={s} value={s} className="bg-slate-950">{s}</option>)}
            </select>
          </div>
          <div className="flex w-full overflow-x-auto bg-black/60 border border-white/10 rounded-2xl p-1.5 sm:w-auto">
            {['Regular Season', 'Playoffs', 'Finals'].map(type => (
              <button key={type} onClick={() => setSeasonType(type)} className={`min-w-max flex-1 px-4 sm:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${seasonType === type ? 'bg-orange-500 text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}>
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
      <div className="bg-slate-900/20 border border-white/5 rounded-[2.5rem] overflow-x-auto backdrop-blur-md">
        <table className="w-full text-left min-w-[480px]">
          <thead>
            <tr className="bg-white/5 border-b border-white/5">
              <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase text-gray-500">Rank</th>
              <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase text-gray-500">Team</th>
              <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase text-gray-500 text-center">W-L</th>
              <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase text-gray-500 text-center">PCT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {teams.map((team: any, i: number) => (
              <tr key={team.TeamID} onClick={() => onTeamClick(team)} className="group hover:bg-white/5 transition-all cursor-pointer">
                <td className="px-4 sm:px-8 py-4 font-black text-gray-600">{i + 1}</td>
                <td className="px-4 sm:px-8 py-4">
                  <div className="flex items-center gap-3 sm:gap-6">
                    <img src={getTeamLogoUrl(team.TeamID)} className="w-8 h-8 sm:w-12 sm:h-12 object-contain group-hover:scale-110 transition-transform shrink-0" alt="" />
                    <div className="text-sm sm:text-base font-black text-white uppercase group-hover:text-orange-400 truncate">{team.TeamCity} {team.TeamName}</div>
                  </div>
                </td>
                <td className="px-4 sm:px-8 py-4 text-center font-black text-white italic">{team.Wins}-{team.Losses}</td>
                <td className="px-4 sm:px-8 py-4 text-center font-black text-orange-400 italic">{((team.WinPCT || 0) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayoffBracket({ series, onTeamClick }: any) {
  const westSeries = series.filter((s: any) => s.conference === 'West');
  const eastSeries = series.filter((s: any) => s.conference === 'East');
  const finalsSeries = series.find((s: any) => s.conference === 'Finals');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-3 text-orange-500/80">
        <div className="h-px w-16 bg-orange-500/20" />
        <Trophy size={34} className="animate-pulse" />
        <div className="h-px w-16 bg-orange-500/20" />
      </div>

      {/* Full bracket: West | Finals | East (mirrored) */}
      <div className="hidden xl:grid xl:grid-cols-[1fr_auto_1fr] gap-4 items-start">
        {/* Western Conference — left to right */}
        <ConferenceBracket title="Western Conference" series={westSeries} onTeamClick={onTeamClick} mirrored={false} />

        {/* NBA Finals center column */}
        <div className="flex flex-col items-center gap-4 pt-10 min-w-[140px]">
          <div className="text-[10px] font-black text-orange-500 uppercase tracking-[0.4em] text-center">NBA Finals</div>
          {finalsSeries ? (
            <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 overflow-hidden shadow-2xl w-full">
              <SeriesRow id={finalsSeries.homeId} name={finalsSeries.homeName} wins={finalsSeries.homeWins} onClick={() => onTeamClick({ TeamID: finalsSeries.homeId, name: finalsSeries.homeName })} isWinner={finalsSeries.homeWins >= 4} />
              <div className="h-px bg-white/5" />
              <SeriesRow id={finalsSeries.visitorId} name={finalsSeries.visitorName} wins={finalsSeries.visitorWins} onClick={() => onTeamClick({ TeamID: finalsSeries.visitorId, name: finalsSeries.visitorName })} isWinner={finalsSeries.visitorWins >= 4} />
            </div>
          ) : (
            <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 text-center text-xs text-gray-600 font-black uppercase tracking-widest w-full">
              TBD
            </div>
          )}
        </div>

        {/* Eastern Conference — mirrored (right to left) */}
        <ConferenceBracket title="Eastern Conference" series={eastSeries} onTeamClick={onTeamClick} mirrored={true} />
      </div>

      {/* Mobile / tablet stacked layout */}
      <div className="xl:hidden grid grid-cols-1 gap-6">
        <ConferenceBracket title="Western Conference" series={westSeries} onTeamClick={onTeamClick} mirrored={false} />
        <ConferenceBracket title="Eastern Conference" series={eastSeries} onTeamClick={onTeamClick} mirrored={false} />
      </div>
    </div>
  );
}

function ConferenceBracket({ title, series, onTeamClick, mirrored = false }: any) {
  const r1 = series.filter((s: any) => s.round === 1);
  const r2 = series.filter((s: any) => s.round === 2);
  const r3 = series.filter((s: any) => s.round === 3);

  // Mirrored East: Conf. Finals → Semifinals → First Round (faces center)
  const columns = mirrored
    ? [
        { title: 'Conf. Finals', data: r3 },
        { title: 'Semifinals',   data: r2 },
        { title: 'First Round',  data: r1 },
      ]
    : [
        { title: 'First Round',  data: r1 },
        { title: 'Semifinals',   data: r2 },
        { title: 'Conf. Finals', data: r3 },
      ];

  return (
    <section className="rounded-3xl border border-white/5 bg-slate-900/20 p-4 sm:p-6">
      <h2 className={`mb-5 text-xl sm:text-2xl font-black text-white italic uppercase tracking-tighter ${mirrored ? 'text-right' : ''}`}>{title}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {columns.map(col => (
          <RoundColumn key={col.title} title={col.title} series={col.data} onTeamClick={onTeamClick} mirrored={mirrored} />
        ))}
      </div>
    </section>
  );
}

function RoundColumn({ title, series, onTeamClick, mirrored = false }: any) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <h3 className={`text-[10px] font-black text-gray-600 uppercase tracking-[0.24em] md:tracking-[0.35em] ${mirrored ? 'md:text-right' : 'md:text-center'}`}>{title}</h3>
      <div className="flex flex-col gap-3 justify-center flex-1">
        {series.map((s: any) => (
          <div key={s.seriesId} className="rounded-2xl border border-white/5 bg-slate-900/40 overflow-hidden shadow-2xl backdrop-blur-md">
             <SeriesRow id={s.homeId} name={s.homeName} wins={s.homeWins} onClick={() => onTeamClick({ TeamID: s.homeId, name: s.homeName })} isWinner={s.homeWins >= 4} mirrored={mirrored} />
             <div className="h-px bg-white/5" />
             <SeriesRow id={s.visitorId} name={s.visitorName} wins={s.visitorWins} onClick={() => onTeamClick({ TeamID: s.visitorId, name: s.visitorName })} isWinner={s.visitorWins >= 4} mirrored={mirrored} />
          </div>
        ))}
        {series.length === 0 && (
          <div className="rounded-2xl border border-white/5 bg-slate-900/20 p-4 text-center text-xs text-gray-700 font-black uppercase tracking-widest">TBD</div>
        )}
      </div>
    </div>
  );
}

function SeriesRow({ id, name, wins, onClick, isWinner, mirrored = false }: any) {
  return (
    <div onClick={onClick} className={`flex items-center justify-between gap-3 p-3 sm:p-4 cursor-pointer hover:bg-white/5 transition-all ${isWinner ? 'bg-orange-500/10' : ''} ${mirrored ? 'flex-row-reverse' : ''}`}>
       <div className={`flex min-w-0 items-center gap-3 ${mirrored ? 'flex-row-reverse' : ''}`}>
          <img src={getTeamLogoUrl(id)} className="w-9 h-9 shrink-0 object-contain" alt="" />
          <span className={`truncate text-xs font-black uppercase tracking-tight ${isWinner ? 'text-white' : 'text-gray-500'} ${mirrored ? 'text-right' : ''}`}>{name}</span>
       </div>
       <span className={`shrink-0 text-2xl font-black italic ${isWinner ? 'text-orange-500' : 'text-gray-700'}`}>{wins}</span>
    </div>
  );
}

function FinalsView({ series, onTeamClick, onGameClick }: any) {
  if (!series) return <div className="py-40 text-center text-gray-700 font-black uppercase tracking-widest">Finals Matchup Pending</div>;
  return (
    <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12">
      <div className="relative overflow-hidden rounded-3xl sm:rounded-[3rem] border border-orange-500/20 bg-slate-950 p-4 sm:p-8 xl:p-12 text-center shadow-[0_0_100px_rgba(249,115,22,0.1)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.15),transparent)]" />
        <div className="relative z-10 flex flex-col items-center gap-5 sm:gap-8">
          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-8">
             <div onClick={() => onTeamClick({ TeamID: series.homeId, name: series.homeName })} className="min-w-0 cursor-pointer group text-center">
                <img src={getTeamLogoUrl(series.homeId)} className="w-24 h-24 sm:w-40 sm:h-40 lg:w-52 lg:h-52 object-contain group-hover:scale-110 transition-transform mb-3 sm:mb-5 mx-auto" alt="" />
                <div className="text-base sm:text-2xl lg:text-3xl font-black text-white uppercase italic tracking-tighter mb-2 break-words">{series.homeName}</div>
                <div className="text-4xl sm:text-7xl font-black text-orange-500 italic tabular-nums drop-shadow-[0_0_30px_rgba(249,115,22,0.5)]">{series.homeWins}</div>
             </div>
             <div className="text-2xl sm:text-6xl lg:text-7xl font-black text-gray-900 italic select-none">VS</div>
             <div onClick={() => onTeamClick({ TeamID: series.visitorId, name: series.visitorName })} className="min-w-0 cursor-pointer group text-center">
                <img src={getTeamLogoUrl(series.visitorId)} className="w-24 h-24 sm:w-40 sm:h-40 lg:w-52 lg:h-52 object-contain group-hover:scale-110 transition-transform mb-3 sm:mb-5 mx-auto" alt="" />
                <div className="text-base sm:text-2xl lg:text-3xl font-black text-white uppercase italic tracking-tighter mb-2 break-words">{series.visitorName}</div>
                <div className="text-4xl sm:text-7xl font-black text-orange-500 italic tabular-nums drop-shadow-[0_0_30px_rgba(249,115,22,0.5)]">{series.visitorWins}</div>
             </div>
          </div>
          <div className="text-[10px] sm:text-sm font-black text-gray-500 uppercase tracking-[0.18em] sm:tracking-[0.55em]">NBA Finals Championship</div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {series.games.map((g: any, i: number) => {
          const hScore = g.scores[series.homeId];
          const vScore = g.scores[series.visitorId];
          const hasScore = hScore !== undefined && vScore !== undefined;
          
          return (
            <button 
              key={i} 
              onClick={hasScore ? () => onGameClick(g) : undefined} 
              disabled={!hasScore}
              className={`p-4 sm:p-6 rounded-2xl border border-white/5 bg-white/5 transition-all text-left group ${hasScore ? 'hover:border-orange-500/50 hover:bg-orange-500/5 cursor-pointer' : 'opacity-40 cursor-default'}`}
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/98 backdrop-blur-3xl">
      <div className="relative w-full max-w-6xl max-h-[96vh] overflow-hidden rounded-3xl sm:rounded-[4rem] border border-white/10 bg-slate-950 flex flex-col shadow-2xl">
        <div className="p-4 sm:p-8 border-b border-white/5 flex items-center justify-between gap-4 bg-slate-900/40">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            <img src={getTeamLogoUrl(team.TeamID)} className="w-12 h-12 sm:w-20 sm:h-20 object-contain shrink-0" alt="" />
            <h2 className="text-xl sm:text-4xl font-black text-white italic uppercase tracking-tighter truncate">{team.TeamCity} {team.TeamName}</h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-white/5 text-gray-500 hover:text-white transition-all shrink-0"><X size={24} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 scrollbar-hide">
          {loading ? (
            <div className="col-span-full py-20 flex justify-center">
              <BasketballLoader />
            </div>
          ) :
            games.map((g: any) => (
              <button key={g.GAME_ID} onClick={() => onGameClick(g)} className="flex items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-white/5 bg-white/[0.02] hover:border-orange-500/50 transition-all text-left">
                <div className="min-w-0">
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
  const teamIds = useMemo<number[]>(() => Array.from(new Set((boxScore as BoxScorePlayer[]).map((p: BoxScorePlayer) => p.TEAM_ID))), [boxScore]);
  useEffect(() => { if (teamIds.length > 0 && !teamFilter) setTeamFilter(teamIds[0]); }, [teamIds, teamFilter]);
  const filtered = useMemo<BoxScorePlayer[]>(() => teamFilter ? (boxScore as BoxScorePlayer[]).filter((p: BoxScorePlayer) => p.TEAM_ID === teamFilter) : boxScore, [boxScore, teamFilter]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-black/99 backdrop-blur-3xl animate-in slide-in-from-bottom-20 duration-500">
      <div className="relative w-full max-w-7xl max-h-[96vh] overflow-hidden rounded-3xl sm:rounded-[4rem] border border-white/10 bg-slate-950 flex flex-col shadow-2xl">
        <div className="p-4 sm:p-10 bg-slate-900/60 border-b border-white/5 flex flex-col items-center">
          <button onClick={onClose} className="absolute top-4 right-4 sm:top-8 sm:right-8 text-gray-500 hover:text-white"><X size={28} /></button>
          <div className="pr-10 text-3xl sm:text-6xl font-black text-white italic uppercase tracking-tighter mb-4 sm:mb-8 text-center truncate max-w-full">{game.MATCHUP}</div>
          <div className="flex max-w-full gap-2 overflow-x-auto p-2 bg-black/60 rounded-2xl sm:rounded-[2.5rem] border border-white/10 shadow-2xl">
            {teamIds.map(tid => (
              <button key={tid} onClick={() => setTeamFilter(tid)} className={`flex shrink-0 items-center gap-3 px-4 sm:px-8 py-3 sm:py-5 rounded-xl sm:rounded-[2rem] transition-all ${teamFilter === tid ? 'bg-orange-500 text-white shadow-2xl' : 'text-gray-500 hover:text-white'}`}>
                <img src={getTeamLogoUrl(tid)} className="w-9 h-9 sm:w-12 sm:h-12 object-contain" alt="" />
                <span className="text-xs sm:text-base font-black uppercase tracking-widest">Team</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 scrollbar-hide">
          {loading ? (
            <div className="col-span-full py-20 flex justify-center">
              <BasketballLoader />
            </div>
          ) :
            filtered.map((p: any) => (
              <button key={p.PLAYER_ID} onClick={() => onPlayerClick(p)} className="flex items-center gap-3 sm:gap-5 p-3 sm:p-5 rounded-2xl sm:rounded-[2rem] border border-white/5 bg-white/[0.03] hover:border-orange-500/40 transition-all text-left group">
                <img src={getPlayerHeadshotUrl(p.PLAYER_ID)} className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-[2rem] object-cover bg-gray-900 shadow-2xl group-hover:scale-110 transition-transform" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm sm:text-base font-black text-white uppercase truncate group-hover:text-orange-400">{p.PLAYER_NAME}</div>
                  <div className="text-[10px] text-gray-600 font-black uppercase mt-1 tracking-widest">{p.START_POSITION || 'BENCH'}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl sm:text-4xl font-black text-orange-500 tabular-nums">{p.PTS || 0}</div>
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/99 backdrop-blur-3xl animate-in zoom-in-95 duration-300">
      <div className="relative w-full max-w-3xl max-h-[96vh] overflow-hidden rounded-3xl sm:rounded-[4rem] border border-white/10 bg-slate-950 shadow-2xl flex flex-col">
        <div className="h-36 sm:h-72 bg-gradient-to-br from-orange-600/50 to-transparent relative p-4 sm:p-12 flex items-end gap-4 sm:gap-10 pr-14">
          <button onClick={onClose} className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white hover:text-orange-500 transition-colors"><X size={28} /></button>
          <img src={getPlayerHeadshotUrl(player.PLAYER_ID)} className="w-24 h-24 sm:w-56 sm:h-56 rounded-2xl sm:rounded-[4rem] object-cover bg-gray-950 border-4 sm:border-8 border-slate-950 shadow-2xl translate-y-8 sm:translate-y-24" alt="" />
          <h2 className="text-2xl sm:text-6xl font-black text-white italic uppercase tracking-tighter pb-2 sm:pb-6 leading-none truncate">{player.PLAYER_NAME}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-12 pt-10 sm:pt-32 space-y-6 sm:space-y-12">
          <div className="grid grid-cols-4 gap-2 sm:gap-6">
            <StatPill val={player.PTS} label="Points" />
            <StatPill val={player.REB} label="Rebounds" />
            <StatPill val={player.AST} label="Assists" />
            <StatPill val={player.STL} label="Steals" />
          </div>
          <div className="space-y-4 sm:space-y-8">
            <h3 className="text-[10px] sm:text-[11px] font-black text-gray-700 uppercase tracking-[0.2em] sm:tracking-[0.5em] border-b border-white/5 pb-4 sm:pb-6">Official Performance Feed</h3>
            <div className="space-y-2 sm:space-y-4">
              {loading ? <div className="py-12 flex justify-center"><Loader2 className="w-10 h-10 text-orange-500 animate-spin" /></div> :
                stats.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-3 sm:p-6 rounded-2xl sm:rounded-[2.5rem] bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all">
                    <div className="text-[9px] sm:text-[10px] text-gray-500 w-20 sm:w-28 uppercase font-black tracking-widest shrink-0">{s.GAME_DATE}</div>
                    <div className="text-xs font-black text-white flex-1 uppercase tracking-tight truncate">{s.MATCHUP}</div>
                    <div className="text-2xl sm:text-3xl font-black text-orange-500 italic tabular-nums">{s.PTS} <span className="text-[10px] sm:text-[12px] uppercase tracking-normal">PTS</span></div>
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
    <div className="p-2 sm:p-6 rounded-xl sm:rounded-[2.5rem] bg-white/5 border border-white/5 text-center shadow-2xl min-w-0">
      <div className="text-xl sm:text-4xl font-black text-white italic drop-shadow-2xl tabular-nums">{val || 0}</div>
      <div className="text-[8px] sm:text-[10px] text-gray-700 font-black uppercase mt-1 sm:mt-3 tracking-widest truncate">{label}</div>
    </div>
  );
}
