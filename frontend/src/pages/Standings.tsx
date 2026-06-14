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
import { SkeletonGrid } from '../components/SkeletonCard';

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

  useEffect(() => {
    if (selectedTeam || selectedGame || selectedPlayer) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => { document.body.classList.remove('modal-open'); };
  }, [selectedTeam, selectedGame, selectedPlayer]);

  return (
    <div className="w-full space-y-8 pb-20 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white dark:bg-zinc-900/40 p-4 sm:p-8 rounded-3xl sm:rounded-[3rem] border border-zinc-200 dark:border-zinc-800 border-[0.5px] backdrop-blur-xl">
        <div>
          <h1 className="text-2xl sm:text-4xl font-medium text-zinc-900 dark:text-white uppercase tracking-tighter">League Standings</h1>
          <p className="text-[9px] sm:text-[10px] text-zinc-550 dark:text-zinc-400 font-medium uppercase tracking-[0.2em] sm:tracking-[0.5em] mt-2">NBA Official Season {season}</p>
        </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-2xl px-4 py-3">
            <Calendar size={18} className="text-orange-500 shrink-0" />
            <select value={season} onChange={e => setSeason(e.target.value)} className="bg-transparent text-zinc-900 dark:text-white text-sm font-medium uppercase outline-none cursor-pointer w-full">
              {seasons.map(s => <option key={s} value={s} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">{s}</option>)}
            </select>
          </div>
          <div className="flex w-full overflow-x-auto bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-[0.5px] rounded-2xl p-1.5 sm:w-auto">
            {['Regular Season', 'Playoffs', 'Finals'].map(type => (
              <button key={type} onClick={() => setSeasonType(type)} className={`min-w-max flex-1 px-4 sm:px-8 py-3 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all ${seasonType === type ? 'bg-orange-500 text-white shadow-none' : 'text-zinc-500 hover:text-zinc-850 dark:text-zinc-400 dark:hover:text-zinc-200'}`}>
                {type.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonGrid count={8} />
      ) : seasonType === 'Playoffs' ? (
        <PlayoffBracket series={playoffSeries} onTeamClick={handleTeamClick} />
      ) : seasonType === 'Finals' ? (
        <FinalsView series={playoffSeries.find(s => s.round === 4)} onTeamClick={handleTeamClick} onGameClick={handleGameClick} />
      ) : (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2 xl:gap-12">
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
      <h2 className="px-2 text-lg font-medium text-zinc-900 dark:text-white sm:text-xl">{title}</h2>
      <div className="overflow-x-auto w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-white dark:bg-zinc-900">
        <table className="min-w-[560px] w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 border-[0.5px]">
              <th className="sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-900 px-2 py-2.5 text-[10px] uppercase tracking-[0.5px] text-zinc-500 dark:text-zinc-400 font-medium border-b border-zinc-200 dark:border-zinc-800 border-[0.5px]">Team</th>
              <th className="px-2 py-2.5 text-[10px] uppercase tracking-[0.5px] text-zinc-500 dark:text-zinc-400 font-medium border-b border-zinc-200 dark:border-zinc-800 border-[0.5px]">Rank</th>
              <th className="px-2 py-2.5 text-center text-[10px] uppercase tracking-[0.5px] text-zinc-500 dark:text-zinc-400 font-medium border-b border-zinc-200 dark:border-zinc-800 border-[0.5px]">W-L</th>
              <th className="px-2 py-2.5 text-center text-[10px] uppercase tracking-[0.5px] text-zinc-500 dark:text-zinc-400 font-medium border-b border-zinc-200 dark:border-zinc-800 border-[0.5px]">PCT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {teams.map((team: any, i: number) => (
              <tr key={team.TeamID} onClick={() => onTeamClick(team)} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-all cursor-pointer">
                <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 px-2 py-3.5 text-xs text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 border-[0.5px]">
                  <div className="flex items-center gap-3 sm:gap-6">
                    <img src={getTeamLogoUrl(team.TeamID)} className="w-8 h-8 sm:w-12 sm:h-12 object-contain group-hover:scale-110 transition-transform shrink-0" alt="" />
                    <div className="max-w-[200px] truncate text-sm font-medium uppercase text-zinc-900 dark:text-white group-hover:text-orange-400 sm:max-w-none sm:text-base">{team.TeamCity} {team.TeamName}</div>
                  </div>
                </td>
                <td className="px-2 py-3.5 text-xs text-zinc-650 dark:text-zinc-450 border-b border-zinc-200 dark:border-zinc-800 border-[0.5px]">{i + 1}</td>
                <td className="whitespace-nowrap px-2 py-3.5 text-center font-medium text-zinc-900 dark:text-white tabular-nums border-b border-zinc-200 dark:border-zinc-800 border-[0.5px] sm:px-4">{team.Wins}-{team.Losses}</td>
                <td className="px-2 py-3.5 text-center font-medium text-orange-500 dark:text-orange-450 tabular-nums border-b border-zinc-200 dark:border-zinc-800 border-[0.5px] sm:px-4">{((team.WinPCT || 0) * 100).toFixed(1)}%</td>
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
          <div className="text-[10px] font-medium text-orange-500 uppercase tracking-[0.4em] text-center">NBA Finals</div>
          {finalsSeries ? (
            <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 overflow-hidden shadow-none w-full">
              <SeriesRow id={finalsSeries.homeId} name={finalsSeries.homeName} wins={finalsSeries.homeWins} onClick={() => onTeamClick({ TeamID: finalsSeries.homeId, name: finalsSeries.homeName })} isWinner={finalsSeries.homeWins >= 4} />
              <div className="h-px bg-zinc-200 dark:bg-zinc-800" />
              <SeriesRow id={finalsSeries.visitorId} name={finalsSeries.visitorName} wins={finalsSeries.visitorWins} onClick={() => onTeamClick({ TeamID: finalsSeries.visitorId, name: series.visitorName })} isWinner={finalsSeries.visitorWins >= 4} />
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-white dark:bg-zinc-900 p-4 text-center text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-widest w-full">
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
    <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-white dark:bg-zinc-900 p-4 sm:p-6">
      <h2 className={`mb-5 text-xl sm:text-2xl font-medium text-zinc-900 dark:text-white uppercase tracking-tighter ${mirrored ? 'text-right' : ''}`}>{title}</h2>
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
      <h3 className={`text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.24em] md:tracking-[0.35em] ${mirrored ? 'md:text-right' : 'md:text-center'}`}>{title}</h3>
      <div className="flex flex-col gap-3 justify-center flex-1">
        {series.map((s: any) => (
          <div key={s.seriesId} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-zinc-50 dark:bg-zinc-900/40 overflow-hidden shadow-none">
             <SeriesRow id={s.homeId} name={s.homeName} wins={s.homeWins} onClick={() => onTeamClick({ TeamID: s.homeId, name: s.homeName })} isWinner={s.homeWins >= 4} mirrored={mirrored} />
             <div className="h-px bg-zinc-200 dark:bg-zinc-800" />
             <SeriesRow id={s.visitorId} name={s.visitorName} wins={s.visitorWins} onClick={() => onTeamClick({ TeamID: s.visitorId, name: s.visitorName })} isWinner={s.visitorWins >= 4} mirrored={mirrored} />
          </div>
        ))}
        {series.length === 0 && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-zinc-50 dark:bg-zinc-900/20 p-4 text-center text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-widest">TBD</div>
        )}
      </div>
    </div>
  );
}

function SeriesRow({ id, name, wins, onClick, isWinner, mirrored = false }: any) {
  return (
    <div onClick={onClick} className={`flex items-center justify-between gap-3 p-3 sm:p-4 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-850/50 transition-all ${isWinner ? 'bg-orange-500/10' : ''} ${mirrored ? 'flex-row-reverse' : ''}`}>
       <div className={`flex min-w-0 items-center gap-3 ${mirrored ? 'flex-row-reverse' : ''}`}>
          <img src={getTeamLogoUrl(id)} className="w-9 h-9 shrink-0 object-contain" alt="" />
          <span className={`truncate text-xs font-medium uppercase tracking-tight ${isWinner ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-450'} ${mirrored ? 'text-right' : ''}`}>{name}</span>
       </div>
       <span className={`shrink-0 text-2xl font-medium ${isWinner ? 'text-orange-500' : 'text-zinc-400 dark:text-zinc-600'}`}>{wins}</span>
    </div>
  );
}

function FinalsView({ series, onTeamClick, onGameClick }: any) {
  if (!series) return <div className="py-40 text-center text-zinc-550 dark:text-zinc-400 font-medium uppercase tracking-widest">Finals Matchup Pending</div>;
  return (
    <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12">
      <div className="relative overflow-hidden rounded-3xl sm:rounded-[3rem] border border-orange-500/20 bg-white dark:bg-zinc-900 p-4 sm:p-8 xl:p-12 text-center shadow-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.15),transparent)]" />
        <div className="relative z-10 flex flex-col items-center gap-5 sm:gap-8">
          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-8">
             <div onClick={() => onTeamClick({ TeamID: series.homeId, name: series.homeName })} className="min-w-0 cursor-pointer group text-center">
                <img src={getTeamLogoUrl(series.homeId)} className="w-24 h-24 sm:w-40 sm:h-40 lg:w-52 lg:h-52 object-contain group-hover:scale-110 transition-transform mb-3 sm:mb-5 mx-auto" alt="" />
                <div className="text-base sm:text-2xl lg:text-3xl font-medium text-zinc-900 dark:text-white uppercase tracking-tighter mb-2 break-words">{series.homeName}</div>
                <div className="text-4xl sm:text-7xl font-medium text-orange-500 tabular-nums drop-shadow-none">{series.homeWins}</div>
             </div>
             <div className="text-2xl sm:text-6xl lg:text-7xl font-medium text-zinc-800 dark:text-zinc-200 select-none">VS</div>
             <div onClick={() => onTeamClick({ TeamID: series.visitorId, name: series.visitorName })} className="min-w-0 cursor-pointer group text-center">
                <img src={getTeamLogoUrl(series.visitorId)} className="w-24 h-24 sm:w-40 sm:h-40 lg:w-52 lg:h-52 object-contain group-hover:scale-110 transition-transform mb-3 sm:mb-5 mx-auto" alt="" />
                <div className="text-base sm:text-2xl lg:text-3xl font-medium text-zinc-900 dark:text-white uppercase tracking-tighter mb-2 break-words">{series.visitorName}</div>
                <div className="text-4xl sm:text-7xl font-medium text-orange-500 tabular-nums drop-shadow-none">{series.visitorWins}</div>
             </div>
          </div>
          <div className="text-[10px] sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.18em] sm:tracking-[0.55em]">NBA Finals Championship</div>
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
              className={`p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-zinc-50 dark:bg-zinc-900/40 transition-all text-left group ${hasScore ? 'hover:border-orange-500/50 hover:bg-orange-500/5 cursor-pointer' : 'opacity-40 cursor-default'}`}
            >
              <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 tracking-widest mb-6 uppercase">Game {i+1}</div>
              <div className={`text-3xl font-medium ${hasScore ? 'text-zinc-900 dark:text-white group-hover:text-orange-400' : 'text-zinc-400 dark:text-zinc-650'}`}>
                 {hasScore ? `${hScore} - ${vScore}` : 'TBD'}
              </div>
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-450 uppercase tracking-[0.2em] mt-4">{g.GAME_DATE || 'SCHEDULED'}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Modals ──────────────────────────────────────────────────────────────────

function TeamLogModal({ team, games, loading, onGameClick, onClose }: any) {
  useEffect(() => {
    const el = document.getElementById('team-log-modal');
    if (el) el.scrollTop = 0;
  }, [team?.TeamID]);

  return (
    <div id="team-log-modal" className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-md p-2 sm:p-4">
      <div className="flex min-h-full items-end sm:items-center justify-center">
        <div className="relative w-full max-w-6xl rounded-3xl sm:rounded-[4rem] border border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-white dark:bg-zinc-900 flex flex-col shadow-none">
          <div className="p-4 sm:p-8 border-b border-zinc-200 dark:border-zinc-800 border-[0.5px] flex items-center justify-between gap-4 bg-zinc-50 dark:bg-zinc-905/40">
            <div className="flex min-w-0 items-center gap-3 sm:gap-6">
              <img src={getTeamLogoUrl(team.TeamID)} className="w-12 h-12 sm:w-20 sm:h-20 object-contain shrink-0" alt="" />
              <h2 className="text-xl sm:text-4xl font-medium text-zinc-900 dark:text-white uppercase tracking-tighter truncate">{team.TeamCity} {team.TeamName}</h2>
            </div>
            <button onClick={onClose} className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-all shrink-0 flex items-center justify-center border border-zinc-200 dark:border-zinc-800 border-[0.5px]"><X size={20} /></button>
          </div>
          <div className="flex-1 p-3 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {loading ? (
              <div className="col-span-full py-20 flex justify-center">
                <BasketballLoader />
              </div>
            ) :
              games.map((g: any) => (
                <button key={g.GAME_ID} onClick={() => onGameClick(g)} className="flex items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-zinc-50 dark:bg-zinc-900/30 hover:border-orange-500/50 transition-transform duration-200 hover:scale-105 shadow-none hover:shadow-none text-left">
                  <div className="min-w-0">
                    <div className="text-[10px] font-medium text-orange-500 uppercase tracking-widest">{g.GAME_DATE}</div>
                    <div className="text-base font-medium text-zinc-900 dark:text-white uppercase truncate">{g.MATCHUP}</div>
                  </div>
                  <div className={`text-2xl font-medium ${g.WL === 'W' ? 'text-green-500' : 'text-red-500'}`}>{g.WL}</div>
                </button>
              ))
            }
          </div>
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

  useEffect(() => {
    const el = document.getElementById('box-score-modal');
    if (el) el.scrollTop = 0;
  }, [game?.GAME_ID]);

  return (
    <div id="box-score-modal" className="fixed inset-0 z-[110] overflow-y-auto bg-black/60 backdrop-blur-md p-2 sm:p-4 animate-in slide-in- duration-500">
      <div className="flex min-h-full items-end sm:items-center justify-center">
        <div className="relative w-full max-w-7xl rounded-3xl sm:rounded-[4rem] border border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-white dark:bg-zinc-900 flex flex-col shadow-none">
          <div className="p-4 sm:p-10 bg-white dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 border-[0.5px] flex flex-col items-center">
            <button onClick={onClose} className="absolute top-4 right-4 sm:top-8 sm:right-8 text-zinc-555 hover:text-zinc-950 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 p-2.5 rounded-full z-20 border border-zinc-200 dark:border-zinc-800 border-[0.5px]"><X size={20} /></button>
            <div className="pr-10 text-3xl sm:text-6xl font-medium text-zinc-900 dark:text-white uppercase tracking-tighter mb-4 sm:mb-8 text-center truncate max-w-full">{game.MATCHUP}</div>
            <div className="flex max-w-full gap-2 overflow-x-auto p-2 bg-zinc-50 dark:bg-zinc-900 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 border-[0.5px] shadow-none">
              {teamIds.map(tid => (
                <button key={tid} onClick={() => setTeamFilter(tid)} className={`flex shrink-0 items-center gap-3 px-4 sm:px-8 py-3 sm:py-5 rounded-xl sm:rounded-[2rem] transition-all ${teamFilter === tid ? 'bg-orange-500 text-white shadow-none' : 'text-zinc-500 hover:text-zinc-850 dark:text-zinc-400 dark:hover:text-white'}`}>
                  <img src={getTeamLogoUrl(tid)} className="w-9 h-9 sm:w-12 sm:h-12 object-contain" alt="" />
                  <span className="text-xs sm:text-base font-medium uppercase tracking-widest">Team</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 p-3 sm:p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {loading ? (
              <div className="col-span-full py-20 flex justify-center">
                <BasketballLoader />
              </div>
            ) :
              filtered.map((p: any) => (
                <button key={p.PLAYER_ID} onClick={() => onPlayerClick(p)} className="flex items-center gap-3 sm:gap-5 p-3 sm:p-5 rounded-2xl sm:rounded-[2rem] border border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-zinc-50 dark:bg-zinc-900/30 hover:border-orange-500/40 transition-transform duration-200 hover:scale-105 shadow-none hover:shadow-none text-left group">
                  <img src={getPlayerHeadshotUrl(p.PLAYER_ID)} className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-[2rem] object-cover bg-zinc-100 dark:bg-zinc-900 shadow-none group-hover:scale-110 transition-transform" alt="" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm sm:text-base font-medium text-zinc-900 dark:text-white uppercase truncate group-hover:text-orange-400">{p.PLAYER_NAME}</div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium uppercase mt-1 tracking-widest">{p.START_POSITION || 'BENCH'}</div>
                  </div>
                  <div className="text-right border-0">
                    <div className="text-2xl sm:text-4xl font-medium text-orange-500 tabular-nums">{p.PTS || 0}</div>
                    <div className="text-[10px] text-zinc-400 dark:text-zinc-550 font-medium uppercase">PTS</div>
                  </div>
                </button>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerStatsModal({ player, season, onClose }: any) {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { nbaApi.getPlayerDetailedStats(player.PLAYER_ID, season).then(res => setStats(res.slice(0, 10))).finally(() => setLoading(false)); }, [player.PLAYER_ID, season]);

  useEffect(() => {
    const el = document.getElementById('player-stats-modal');
    if (el) el.scrollTop = 0;
  }, [player?.PLAYER_ID]);

  return (
    <div id="player-stats-modal" className="fixed inset-0 z-[120] overflow-y-auto bg-black/60 backdrop-blur-md p-2 sm:p-4 animate-in zoom-in-95 duration-300">
      <div className="flex min-h-full items-end sm:items-center justify-center">
        <div className="relative w-full max-w-3xl rounded-3xl sm:rounded-[4rem] border border-zinc-200 dark:border-zinc-800 border-[0.5px] bg-white dark:bg-zinc-900 shadow-none flex flex-col">
          <div className="h-36 sm:h-72 bg-zinc-100 dark:bg-zinc-800 to-transparent relative p-4 sm:p-12 flex items-end gap-4 sm:gap-10 pr-14 rounded-t-[3rem] sm:rounded-t-[4rem]">
            <button onClick={onClose} className="absolute top-4 right-4 sm:top-8 sm:right-8 text-zinc-500 hover:text-zinc-950 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 p-2.5 rounded-full z-20 border border-zinc-200 dark:border-zinc-800 border-[0.5px]"><X size={20} /></button>
            <img src={getPlayerHeadshotUrl(player.PLAYER_ID)} className="w-24 h-24 sm:w-56 sm:h-56 rounded-2xl sm:rounded-[4rem] object-cover bg-zinc-100 dark:bg-zinc-900 border-4 sm:border-8 border-zinc-200 dark:border-zinc-800 border-[0.5px] shadow-none translate-y-8 sm:translate-y-24" alt="" />
            <h2 className="text-2xl sm:text-6xl font-medium text-zinc-900 dark:text-white uppercase tracking-tighter pb-2 sm:pb-6 leading-none truncate">{player.PLAYER_NAME}</h2>
          </div>
          <div className="flex-1 p-3 sm:p-12 pt-10 sm:pt-32 space-y-6 sm:space-y-12">
            <div className="grid grid-cols-4 gap-2 sm:gap-6">
              <StatPill val={player.PTS} label="Points" />
              <StatPill val={player.REB} label="Rebounds" />
              <StatPill val={player.AST} label="Assists" />
              <StatPill val={player.STL} label="Steals" />
            </div>
            <div className="space-y-4 sm:space-y-8">
              <h3 className="text-[10px] sm:text-[11px] font-medium text-zinc-500 dark:text-zinc-450 uppercase tracking-[0.2em] sm:tracking-[0.5em] border-b border-zinc-200 dark:border-zinc-800 border-[0.5px] pb-4 sm:pb-6">Official Performance Feed</h3>
              <div className="space-y-2 sm:space-y-4">
                {loading ? <div className="py-12 flex justify-center"><Loader2 className="w-10 h-10 text-orange-500 animate-spin" /></div> :
                  stats.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 p-3 sm:p-6 rounded-2xl sm:rounded-[2.5rem] bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 border-[0.5px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                      <div className="text-[9px] sm:text-[10px] text-zinc-500 dark:text-zinc-450 w-20 sm:w-28 uppercase font-medium tracking-widest shrink-0">{s.GAME_DATE}</div>
                      <div className="text-xs font-medium text-zinc-900 dark:text-white flex-1 uppercase tracking-tight truncate">{s.MATCHUP}</div>
                      <div className="text-2xl sm:text-3xl font-medium text-orange-500 tabular-nums">{s.PTS} <span className="text-[10px] sm:text-[12px] uppercase tracking-normal">PTS</span></div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ val, label }: any) {
  return (
    <div className="p-2 sm:p-6 rounded-xl sm:rounded-[2.5rem] bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 border-[0.5px] text-center shadow-none min-w-0">
      <div className="text-xl sm:text-4xl font-medium text-zinc-900 dark:text-white drop-shadow-none tabular-nums">{val || 0}</div>
      <div className="text-[8px] sm:text-[10px] text-zinc-500 dark:text-zinc-400 font-medium uppercase mt-1 sm:mt-3 tracking-widest truncate">{label}</div>
    </div>
  );
}
