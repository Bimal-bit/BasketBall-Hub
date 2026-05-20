import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, RefreshCw, Trophy, X, Zap, Activity } from 'lucide-react';
import {
  nbaApi,
  getPlayerHeadshotUrl,
  getTeamLogoUrl,
  toDateKey,
  getNBADate,
  type BoxScorePlayer,
  type BoxScoreTeam,
  type Game,
  type PlayByPlay,
  type PlayerGameLog,
  type PlayerShot,
  type PlayerImpact,
  type Standing
} from '../lib/api';
import BasketballLoader from '../components/BasketballLoader';
import { formatIndianTime, gameStatusInIndia } from '../lib/time';

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

type DashboardPlayer = {
  PERSON_ID?: number;
  PLAYER_ID?: number;
  PLAYER_FIRST_NAME?: string;
  PLAYER_LAST_NAME?: string;
  PLAYER_NAME?: string;
  TEAM_ID: number;
  TEAM_ABBREVIATION?: string;
  START_POSITION?: string | null;
  PTS?: number | null;
  REB?: number | null;
  AST?: number | null;
  STL?: number | null;
  BLK?: number | null;
  MIN?: string | null;
  FG_PCT?: number | null;
  FG3M?: number | null;
  FG3A?: number | null;
  FTM?: number | null;
  FTA?: number | null;
  FGM?: number | null;
  FGA?: number | null;
  TOV?: number | null;
  PLUS_MINUS?: number | null;
  GAME_ID?: string;
  GAME_LABEL?: string;
};

type DetailTab = 'Feed' | 'Game' | 'away' | 'home';

const dayOffsets = [-1, 0, 1, 2, 3, 4];

function LiveTicker({ games }: { games: Game[] }) {
  if (games.length === 0) return null;
  return (
    <div className="relative overflow-hidden bg-orange-500/10 border-y border-orange-500/20 py-2 group">
      <div className="flex gap-12 animate-scroll whitespace-nowrap px-4">
        {[...games, ...games].map((game, i) => (
          <div key={i} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white">
            <span className="text-orange-500">{game.status === 'live' ? 'LIVE' : gameStatusInIndia(game)}</span>
            <span>{game.away_team_abbreviation} {game.away_score}</span>
            <span className="text-gray-600">@</span>
            <span>{game.home_team_abbreviation} {game.home_score}</span>
            <span className="h-1 w-1 rounded-full bg-gray-700 mx-2" />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          display: flex;
          width: max-content;
          animation: scroll 30s linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

export default function Dashboard() {
  const [games, setGames] = useState<Game[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => getNBADate());
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [boxScore, setBoxScore] = useState<BoxScorePlayer[]>([]);
  const [teamStats, setTeamStats] = useState<BoxScoreTeam[]>([]);
  const [teamShots, setTeamShots] = useState<Record<number, PlayerShot[]>>({});
  const [detailTab, setDetailTab] = useState<DetailTab>('Feed');
  const [selectedPlayer, setSelectedPlayer] = useState<DashboardPlayer | null>(null);
  const [playerShots, setPlayerShots] = useState<PlayerShot[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerGameLog[]>([]);
  const [playerAverages, setPlayerAverages] = useState<any | null>(null);
  const [playerImpact, setPlayerImpact] = useState<PlayerImpact | null>(null);
  const [playByPlay, setPlayByPlay] = useState<PlayByPlay[]>([]);
  const [dailyLeaders, setDailyLeaders] = useState<DashboardPlayer[]>([]);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const gData = await nbaApi.getScoreboard(selectedDate).catch(() => []);
      setGames(gData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading NBA data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
    const interval = window.setInterval(loadData, 5000);
    return () => window.clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;
    async function loadSlowData() {
      const [sData, gData] = await Promise.all([
        nbaApi.getStandings().catch(() => []),
        nbaApi.getScoreboard(selectedDate).catch(() => []),
      ]);
      if (cancelled) return;
      setStandings(sData);
      const playedGames = gData.filter(game => game.status !== 'scheduled').slice(0, 6);
      const boxscores = await Promise.all(playedGames.map(game => nbaApi.getBoxScore(game.game_id).catch(() => [])));
      if (cancelled) return;
      const leaders = boxscores.flatMap((box, index) => {
        const game = playedGames[index];
        return box
          .filter(player => Number(player.PTS ?? 0) > 0)
          .map(player => ({
            ...player,
            PERSON_ID: player.PLAYER_ID,
            GAME_ID: game.game_id,
            GAME_LABEL: `${game.away_team_abbreviation} @ ${game.home_team_abbreviation}`,
          }));
      });
      setDailyLeaders(leaders.sort((a, b) => Number(b.PTS ?? 0) - Number(a.PTS ?? 0)).slice(0, 9));
    }
    loadSlowData();
    const interval = window.setInterval(loadSlowData, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedDate]);

  // Sync selectedGame with live updates from the scoreboard
  useEffect(() => {
    if (selectedGame) {
      const updated = games.find(g => g.game_id === selectedGame.game_id);
      if (updated && (updated.home_score !== selectedGame.home_score || updated.away_score !== selectedGame.away_score || updated.status_text !== selectedGame.status_text)) {
        setSelectedGame(updated);
      }
    }
  }, [games, selectedGame]);

  // Poll detailed stats for the active game if it's currently live
  useEffect(() => {
    if (!selectedGame || selectedGame.status !== 'live') return;

    const pollDetails = async () => {
      try {
        const [playersData, teamStatsData, pbpData] = await Promise.all([
          nbaApi.getBoxScore(selectedGame.game_id),
          nbaApi.getGameTeamStats(selectedGame.game_id),
          nbaApi.getPlayByPlay(selectedGame.game_id).catch(() => [])
        ]);
        setBoxScore(playersData);
        setTeamStats(teamStatsData);
        setPlayByPlay(pbpData);
      } catch (e) {
        console.error("Live detail poll error:", e);
      }
    };

    pollDetails();
    const interval = window.setInterval(pollDetails, 5000);
    return () => window.clearInterval(interval);
  }, [selectedGame?.game_id, selectedGame?.status]);

  async function handleGameClick(game: Game) {
    setSelectedGame(game);
    setDetailTab('Feed');
    setBoxScore([]);
    setTeamStats([]);
    setTeamShots({});
    setPlayByPlay([]);
    try {
      const [playersData, teamStatsData, awayShots, homeShots, pbpData] = await Promise.all([
        nbaApi.getBoxScore(game.game_id),
        nbaApi.getGameTeamStats(game.game_id),
        nbaApi.getTeamShots(game.away_team_id, game.game_id).catch(() => []),
        nbaApi.getTeamShots(game.home_team_id, game.game_id).catch(() => []),
        nbaApi.getPlayByPlay(game.game_id).catch(() => [])
      ]);
      setBoxScore(playersData);
      setTeamStats(teamStatsData);
      setTeamShots({
        [game.away_team_id]: awayShots,
        [game.home_team_id]: homeShots
      });
      setPlayByPlay(pbpData);
    } catch (error) {
      console.error(error);
    }
  }

  async function handlePlayerClick(player: DashboardPlayer, gameId?: string) {
    setSelectedPlayer(player);
    setPlayerStats([]);
    setPlayerShots([]);
    setPlayerAverages(null);
    setPlayerImpact(null);
    try {
      const playerId = player.PERSON_ID || player.PLAYER_ID;
      if (!playerId) return;
      
      const stats = await nbaApi.getPlayerDetailedStats(playerId);
      setPlayerStats(stats.slice(0, 8));
      setPlayerAverages(null);
      
      if (gameId) {
        const [shots, impact, box, pbp] = await Promise.all([
          nbaApi.getPlayerShots(playerId, gameId).catch(() => []),
          nbaApi.getPlayerImpact(gameId, playerId).catch(() => null),
          nbaApi.getBoxScore(gameId).catch(() => []),
          nbaApi.getPlayByPlay(gameId).catch(() => [])
        ]);
        setPlayerShots(shots);
        setPlayerImpact(impact);
        setPlayByPlay(pbp);
        
        // Update player stats with match-specific stats if found
        const matchStats = box.find(p => p.PLAYER_ID === playerId);
        if (matchStats) {
          setSelectedPlayer(prev => prev ? ({
            ...prev,
            PTS: matchStats.PTS,
            REB: matchStats.REB,
            AST: matchStats.AST,
            STL: matchStats.STL,
            BLK: matchStats.BLK,
            MIN: matchStats.MIN,
            FG_PCT: matchStats.FG_PCT,
            FG3M: matchStats.FG3M,
            FG3A: matchStats.FG3A,
            FTM: matchStats.FTM,
            FTA: matchStats.FTA,
            FGA: matchStats.FGA,
            FGM: matchStats.FGM,
            TOV: matchStats.TOV ?? matchStats.TO,
            PLUS_MINUS: matchStats.PLUS_MINUS
          }) : null);
        }
      } else {
        // If no gameId, try to find if the player is currently in any live game
        const liveGame = games.find(g => g.status === 'live' && (g.home_team_id === player.TEAM_ID || g.away_team_id === player.TEAM_ID));
        if (liveGame) {
          const [box, pbp] = await Promise.all([
            nbaApi.getBoxScore(liveGame.game_id).catch(() => []),
            nbaApi.getPlayByPlay(liveGame.game_id).catch(() => [])
          ]);
          setPlayByPlay(pbp);
          const matchStats = box.find(p => p.PLAYER_ID === playerId);
          if (matchStats) {
            setSelectedPlayer(prev => prev ? ({
              ...prev,
              PTS: matchStats.PTS,
              REB: matchStats.REB,
              AST: matchStats.AST,
              STL: matchStats.STL,
              BLK: matchStats.BLK,
              MIN: matchStats.MIN,
              FG_PCT: matchStats.FG_PCT,
              FG3M: matchStats.FG3M,
              FG3A: matchStats.FG3A,
              FTM: matchStats.FTM,
              FTA: matchStats.FTA,
              FGM: matchStats.FGM,
              FGA: matchStats.FGA,
              TOV: matchStats.TOV ?? matchStats.TO,
              PLUS_MINUS: matchStats.PLUS_MINUS
            }) : null);
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  const teamsById = useMemo(() => Object.fromEntries(standings.map(team => [team.TeamID, team])), [standings]);
  const scoreboardDate = parseDateKey(selectedDate);
  const scoreboardLabel = scoreboardDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  
  const filteredGames = useMemo(() => {
    return games.filter(game => {
      if (game.series_info) {
        const { home_wins, visitor_wins } = game.series_info;
        if (home_wins >= 4 || visitor_wins >= 4) {
          if (game.status === 'scheduled') return false;
        }
      }
      return true;
    });
  }, [games]);

  const featuredGames = useMemo(() => {
    return [...filteredGames].sort((a, b) => statusOrder(a.status) - statusOrder(b.status)).slice(0, 6);
  }, [filteredGames]);

  const gameLeaders = useMemo(() => {
    if (dailyLeaders.length > 0) return dailyLeaders;
    const leaders: any[] = [];
    games.forEach(g => {
      if (g.home_leader && g.home_leader.name) {
        leaders.push({
          PERSON_ID: g.home_leader.personId,
          PLAYER_FIRST_NAME: g.home_leader.name.split(' ')[0],
          PLAYER_LAST_NAME: g.home_leader.name.split(' ').slice(1).join(' '),
          PTS: g.home_leader.points,
          REB: g.home_leader.rebounds,
          AST: g.home_leader.assists,
          STL: null,
          BLK: null,
          TEAM_ID: g.home_team_id,
          TEAM_ABBREVIATION: g.home_team_abbreviation,
          GAME_ID: g.game_id
        });
      }
      if (g.away_leader && g.away_leader.name) {
        leaders.push({
          PERSON_ID: g.away_leader.personId,
          PLAYER_FIRST_NAME: g.away_leader.name.split(' ')[0],
          PLAYER_LAST_NAME: g.away_leader.name.split(' ').slice(1).join(' '),
          PTS: g.away_leader.points,
          REB: g.away_leader.rebounds,
          AST: g.away_leader.assists,
          STL: null,
          BLK: null,
          TEAM_ID: g.away_team_id,
          TEAM_ABBREVIATION: g.away_team_abbreviation,
          GAME_ID: g.game_id
        });
      }
    });
    
    if (leaders.length === 0) return [];
    return leaders.sort((a, b) => (b.PTS || 0) - (a.PTS || 0)).slice(0, 9);
  }, [dailyLeaders, games]);


  if (loading) return (
    <div className="h-[80vh] flex items-center justify-center">
      <BasketballLoader />
    </div>
  );

  return (
    <div className="w-full max-w-full space-y-0 overflow-hidden">
      <LiveTicker games={games} />
      <div className="w-full max-w-full p-2 sm:p-4 lg:p-6 space-y-8 sm:space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Live Dashboard</h1>
          <p className="text-sm text-gray-500">NBA live scores, box scores & player leaders</p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-800 bg-gray-900/50 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-orange-500 transition-all hover:border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-400 sm:w-auto md:self-auto"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <section className="space-y-8">
        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {dayOffsets.map(offset => {
            const date = parseDateKey(getNBADate());
            date.setDate(date.getDate() + offset);
            const dateKey = toDateKey(date);
            const active = dateKey === selectedDate;
            return (
              <button
                key={offset}
                onClick={() => setSelectedDate(dateKey)}
                className={`shrink-0 rounded-2xl border px-3 sm:px-5 py-2 sm:py-3 text-left transition-all ${
                  active
                    ? 'border-orange-500/50 bg-orange-500/10 text-orange-400 shadow-2xl shadow-orange-500/10'
                    : 'border-gray-800 bg-gray-900/40 text-gray-500 hover:border-orange-500/30 hover:text-white'
                }`}
              >
                <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em]">{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                <div className="text-lg sm:text-xl font-black italic uppercase tracking-tighter">{date.toLocaleDateString(undefined, { weekday: 'short' })}</div>
              </button>
            );
          })}
        </div>


        <SectionTitle title="Games" action="Standings" onAction={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'standings' }))} />
        <div className="grid min-w-0 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {featuredGames.length === 0 && (
            <div className="rounded-3xl border border-gray-800 bg-gray-900/40 p-8 text-center text-gray-500">
              No NBA games returned for {scoreboardLabel}.
            </div>
          )}
          {featuredGames.map(game => (
            <GameCard
              key={game.game_id}
              game={game}
              awayTeamName={game.away_team_name || teamsById[game.away_team_id]?.TeamName || game.away_team_abbreviation || 'Away'}
              homeTeamName={game.home_team_name || teamsById[game.home_team_id]?.TeamName || game.home_team_abbreviation || 'Home'}
              onClick={() => handleGameClick(game)}
            />
          ))}
        </div>
        <div className="flex max-w-full flex-col gap-1 text-xs font-bold uppercase tracking-[0.12em] text-gray-500 sm:flex-row sm:items-center sm:gap-2 sm:tracking-[0.18em]">
          Official NBA Data
          <span className="self-start rounded-full bg-gray-700 px-2 py-0.5 text-[10px] text-slate-950">check</span>
          <span className="sm:ml-auto">Updated {formatIndianTime(lastUpdated)} IST</span>
        </div>
      </section>


      <section className="space-y-6">
        <SectionTitle title="Daily Match Leaders" />
        <div className="grid min-w-0 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {gameLeaders.length === 0 && (
            <div className="col-span-full rounded-3xl border border-gray-800 bg-gray-900/40 p-8 text-center text-gray-500">
              No player boxscore leaders are available yet for {scoreboardLabel}.
            </div>
          )}
          {gameLeaders.map((player, index) => (
            <PlayerLeaderCard key={`${player.PERSON_ID}-${index}`} player={player} rank={index + 1} onClick={() => handlePlayerClick(player, player.GAME_ID)} />
          ))}
        </div>
      </section>

      {selectedGame && (
        <GameDetails
          game={selectedGame}
          games={featuredGames}
          teamsById={teamsById}
          boxScore={boxScore}
          teamStats={teamStats}
          teamShots={teamShots}
          playByPlay={playByPlay}
          activeTab={detailTab}
          onTabChange={setDetailTab}
          onClose={() => setSelectedGame(null)}
          onPlayerClick={handlePlayerClick}
          onGameSelect={handleGameClick}
        />
      )}

      {selectedPlayer && (
        <PlayerDetail 
          player={selectedPlayer} 
          shots={playerShots} 
          logs={playerStats} 
          averages={playerAverages}
          playerImpact={playerImpact}
          playByPlay={playByPlay}
          onClose={() => setSelectedPlayer(null)} 
        />
      )}
    </div>
    </div>
  );
}


function SectionTitle({ title, action, onAction }: { title: string; action?: string, onAction?: () => void }) {
  return (
    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
      <h2 className="min-w-0 shrink text-2xl sm:text-4xl font-black text-gray-800 italic uppercase tracking-tighter leading-none">{title}</h2>
      <div className="h-px flex-1 bg-gray-900" />
      {action && (
        <button 
          onClick={onAction}
          className="flex shrink-0 items-center gap-1 text-[10px] sm:text-xs font-black uppercase tracking-[0.12em] sm:tracking-[0.2em] text-orange-500 hover:text-orange-400"
        >
          {action} <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}

function GameCard({ game, awayTeamName, homeTeamName, onClick }: {
  game: Game;
  awayTeamName: string;
  homeTeamName: string;
  onClick: () => void;
}) {
  const isClose = game.status === 'live' && Math.abs(game.home_score - game.away_score) < 8;
  const homeProb = useMemo(() => {
    if (game.status === 'final') return game.home_score > game.away_score ? 100 : 0;
    if (game.status === 'scheduled') return 50;
    const diff = game.home_score - game.away_score;
    const base = 50 + (diff * 2);
    return Math.min(Math.max(base, 5), 95);
  }, [game]);

  return (
    <div
      onClick={onClick}
      className="group relative w-full min-w-0 cursor-pointer overflow-hidden rounded-3xl border border-gray-800 bg-gray-900/40 transition-all duration-300 hover:border-orange-500/50 hover:shadow-2xl hover:shadow-orange-500/10"
    >
      {isClose && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-orange-600 px-2.5 py-1 rounded-full animate-pulse shadow-lg shadow-orange-600/20">
          <Zap size={10} className="text-white" fill="white" />
          <span className="text-[9px] font-black uppercase text-white tracking-widest">Clutch</span>
        </div>
      )}
      
      <div className="relative p-4 sm:p-6">
        <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">{statusText(game)}</div>
            <div className="text-xl font-black italic uppercase leading-none tracking-tighter text-white transition-colors group-hover:text-orange-400">
              {game.away_team_abbreviation || 'AWAY'} @ {game.home_team_abbreviation || 'HOME'}
            </div>
          </div>
          {!isClose && <Trophy className="shrink-0 text-gray-700" size={24} />}
        </div>
        
        <div className="space-y-3 sm:space-y-4">
          <TeamScore teamId={game.away_team_id} name={awayTeamName} score={game.away_score} active={game.away_score > game.home_score} />
          <TeamScore teamId={game.home_team_id} name={homeTeamName} score={game.home_score} active={game.home_score > game.away_score} />
        </div>

        {game.status !== 'scheduled' && (
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-gray-500">
              <span>{100 - homeProb}% Chance</span>
              <span>Win Probability</span>
              <span>{homeProb}% Chance</span>
            </div>
            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-orange-500/40 transition-all duration-1000" style={{ width: `${100 - homeProb}%` }} />
              <div className="h-full bg-blue-500/40 transition-all duration-1000" style={{ width: `${homeProb}%` }} />
            </div>
          </div>
        )}

        <div className="mt-4 flex min-w-0 items-center justify-between gap-4 text-[10px] sm:text-xs font-bold uppercase tracking-[0.12em] sm:tracking-[0.18em] text-gray-500">
          <span className="min-w-0 truncate">{game.arena || 'Arena TBD'}</span>
          <span className="shrink-0">{game.status === 'scheduled' ? 'Scheduled' : seriesText(game)}</span>
        </div>

        {(game.home_leader || game.away_leader) && (
          <div className="mt-4 pt-4 sm:mt-6 sm:pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
             {game.away_leader && (
               <div className="flex items-center gap-2">
                  <img src={getPlayerHeadshotUrl(game.away_leader.personId)} onError={(e) => { e.currentTarget.src = getTeamLogoUrl(game.away_team_id); e.currentTarget.classList.add('p-1', 'object-contain'); }} className="h-8 w-8 rounded-lg object-cover bg-gray-800" alt="" />
                  <div className="min-w-0">
                     <div className="text-[10px] font-black text-white truncate uppercase">{game.away_leader.name.split(' ').pop()}</div>
                     <div className="text-[9px] font-bold text-orange-500 uppercase">{game.away_leader.points} PTS</div>
                  </div>
               </div>
             )}
             {game.home_leader && (
               <div className="flex items-center gap-2 justify-end text-right">
                  <div className="min-w-0">
                     <div className="text-[10px] font-black text-white truncate uppercase">{game.home_leader.name.split(' ').pop()}</div>
                     <div className="text-[9px] font-bold text-orange-500 uppercase">{game.home_leader.points} PTS</div>
                  </div>
                  <img src={getPlayerHeadshotUrl(game.home_leader.personId)} onError={(e) => { e.currentTarget.src = getTeamLogoUrl(game.home_team_id); e.currentTarget.classList.add('p-1', 'object-contain'); }} className="h-8 w-8 rounded-lg object-cover bg-gray-800" alt="" />
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}


function TeamScore({ teamId, name, score, active }: { teamId: number; name: string; score: number; active: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
      <img src={getTeamLogoUrl(teamId)} alt={name} className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 object-contain drop-shadow-md" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-gray-400">{name}</div>
        <div className="text-[8px] font-bold uppercase text-gray-500">Team</div>
      </div>
      <div className={`shrink-0 text-3xl sm:text-4xl font-black italic leading-none tabular-nums ${active ? 'text-white' : 'text-gray-500'}`}>{score || '-'}</div>
    </div>
  );
}

function PlayerLeaderCard({ player, rank, onClick }: { player: DashboardPlayer & { GAME_LABEL?: string }; rank: number; onClick: () => void }) {
  const playerId = player.PERSON_ID || player.PLAYER_ID || 0;
  const playerName = player.PLAYER_NAME || `${player.PLAYER_FIRST_NAME || ''} ${player.PLAYER_LAST_NAME || ''}`.trim();
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-3xl border border-gray-800 bg-gray-900/40 transition-all duration-300 hover:border-orange-500/50 hover:shadow-2xl hover:shadow-orange-500/10"
    >
      <div className="relative p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">#{rank} Leader</div>
            <div className="text-xl font-black italic uppercase leading-none tracking-tighter text-white transition-colors group-hover:text-orange-400">
              {playerName}
            </div>
            <div className="mt-2 text-[9px] font-black uppercase tracking-widest text-gray-500">{player.GAME_LABEL || player.TEAM_ABBREVIATION}</div>
          </div>
          <Trophy className="text-gray-700" size={24} />
        </div>
        <div className="mt-6 flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 transition-colors group-hover:border-orange-500">
            <img src={getPlayerHeadshotUrl(playerId)} className="h-full w-full object-cover object-top scale-125 translate-y-2" alt={playerName} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <MiniStat label="PTS" value={player.PTS} />
              <MiniStat label="REB" value={player.REB} />
              <MiniStat label="AST" value={player.AST} />
              <MiniStat label="STL" value={player.STL} />
              <MiniStat label="BLK" value={player.BLK} />
            </div>
          </div>
          <img src={getTeamLogoUrl(player.TEAM_ID)} alt={player.TEAM_ABBREVIATION} className="shrink-0 h-9 w-9 object-contain opacity-80" />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="shrink-0">
      <div className="text-lg font-black text-white">{value ?? '-'}</div>
      <div className="text-[8px] font-bold uppercase text-gray-500">{label}</div>
    </div>
  );
}

function GameDetails({ game, games, teamsById, boxScore, teamStats, teamShots, playByPlay, activeTab, onTabChange, onClose, onPlayerClick, onGameSelect }: {
  game: Game;
  games: Game[];
  teamsById: Record<number, Standing>;
  boxScore: BoxScorePlayer[];
  teamStats: BoxScoreTeam[];
  teamShots: Record<number, PlayerShot[]>;
  playByPlay: PlayByPlay[];
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onClose: () => void;
  onPlayerClick: (player: DashboardPlayer, gameId?: string) => void;
  onGameSelect: (game: Game) => void;
}) {
  const awayName = game.away_team_name || teamsById[game.away_team_id]?.TeamName || game.away_team_abbreviation || 'Away';
  const homeName = game.home_team_name || teamsById[game.home_team_id]?.TeamName || game.home_team_abbreviation || 'Home';
  const awayPlayers = boxScore.filter(player => player.TEAM_ID === game.away_team_id);
  const homePlayers = boxScore.filter(player => player.TEAM_ID === game.home_team_id);
  const awayStats = teamStats.find(team => team.TEAM_ID === game.away_team_id);
  const homeStats = teamStats.find(team => team.TEAM_ID === game.home_team_id);
  const selectedPlayers = activeTab === 'home' ? homePlayers : awayPlayers;
  const selectedTeamId = activeTab === 'home' ? game.home_team_id : game.away_team_id;
  const selectedTeamName = activeTab === 'home' ? homeName : awayName;
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: 'Feed', label: 'Feed' },
    { id: 'Game', label: 'Game' },
    { id: 'away', label: game.away_team_abbreviation || 'AWAY' },
    { id: 'home', label: game.home_team_abbreviation || 'HOME' }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-black/80 p-0 sm:p-6 backdrop-blur-xl lg:left-16 xl:left-64">
      <div className="relative mx-auto min-h-dvh w-full max-w-6xl overflow-hidden rounded-none border border-white/10 bg-black text-slate-100 shadow-2xl backdrop-blur-md sm:min-h-0 sm:rounded-[2rem]">
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          className="absolute right-6 top-6 z-[60] rounded-full bg-slate-900/90 p-2 transition-all hover:bg-orange-500 hover:scale-110 active:scale-95 cursor-pointer shadow-xl border border-white/10"
          aria-label="Close"
        >
          <X className="text-white" size={20} />
        </button>
        <div className="border-b border-white/10 p-3 sm:p-6">
          <div className="mb-4 sm:mb-5 flex gap-2 sm:gap-3 overflow-x-auto pr-12 pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {games.map(item => (
              <button
                key={item.game_id}
                onClick={() => onGameSelect(item)}
                className={`min-w-36 sm:min-w-44 rounded-2xl border px-3 sm:px-4 py-2 sm:py-3 text-left transition-all shrink-0 ${
                  item.game_id === game.game_id ? 'border-orange-500/50 bg-orange-500/10 text-orange-400' : 'border-white/10 bg-slate-900/50 text-gray-500 hover:border-orange-500/30 hover:text-white'
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.2em]">{statusText(item)}</div>
                <div className="mt-1 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-black text-white">
                  <img src={getTeamLogoUrl(item.away_team_id)} className="h-4 w-4 sm:h-5 sm:w-5 object-contain" alt="" />
                  {item.away_score || '-'}-{item.home_score || '-'}
                  <img src={getTeamLogoUrl(item.home_team_id)} className="h-4 w-4 sm:h-5 sm:w-5 object-contain" alt="" />
                </div>
              </button>
            ))}
          </div>

          <div className="grid gap-3 grid-cols-[1fr_auto_1fr] items-center">
            <GameHeroTeam teamId={game.away_team_id} name={awayName} score={game.away_score} align="left" />
            <div className="text-center px-2">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">{statusText(game)}</div>
              <div className="mt-1 text-xs text-gray-400 hidden sm:block">{new Date(game.game_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              <div className="mt-1 sm:mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 hidden sm:block">{game.arena || 'Arena TBD'}</div>
            </div>
            <GameHeroTeam teamId={game.home_team_id} name={homeName} score={game.home_score} align="right" />
          </div>
        </div>

        <div className="flex w-full justify-between gap-1 overflow-x-auto border-b border-white/10 bg-black px-1 sm:justify-start sm:px-5 py-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`shrink-0 border-b-2 px-3 sm:px-5 py-3 sm:py-4 text-[10px] sm:text-xs font-black uppercase tracking-[0.12em] sm:tracking-[0.2em] transition-all ${
                activeTab === tab.id ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full max-w-full p-2 sm:p-6 lg:p-8">
          {(activeTab === 'away' || activeTab === 'home') && (
            <TeamStatsPanel teamId={selectedTeamId} teamName={selectedTeamName} players={selectedPlayers} gameId={game.game_id} onPlayerClick={onPlayerClick} />
          )}
          {activeTab === 'Game' && (
            <GameSummary
              game={game}
              awayName={awayName}
              homeName={homeName}
              awayPlayers={awayPlayers}
              homePlayers={homePlayers}
              awayStats={awayStats}
              homeStats={homeStats}
              awayShots={teamShots[game.away_team_id] || []}
              homeShots={teamShots[game.home_team_id] || []}
              playByPlay={playByPlay}
              onPlayerClick={onPlayerClick}
            />
          )}
          {activeTab === 'Feed' && <GameFeed playByPlay={playByPlay} boxScore={boxScore} game={game} />}
        </div>
      </div>
    </div>
  );
}

function GameHeroTeam({ teamId, name, score, align }: { teamId: number; name: string; score: number; align: 'left' | 'right' }) {
  return (
    <div className={`flex items-center gap-2 sm:gap-4 ${align === 'right' ? 'flex-row-reverse text-right' : 'text-left'}`}>
      {/* Logo — transparent background, no white box */}
      <img
        src={getTeamLogoUrl(teamId)}
        alt={name}
        className="h-12 w-12 sm:h-16 sm:w-16 shrink-0 object-contain drop-shadow-lg"
      />
      <div className="min-w-0">
        <div className="text-3xl sm:text-5xl font-black italic text-white leading-none tabular-nums">{score ?? '-'}</div>
        <div className="text-xs sm:text-base font-black italic uppercase tracking-tighter text-gray-400 mt-0.5 truncate max-w-[100px] sm:max-w-none">{name}</div>
      </div>
    </div>
  );
}

function TeamStatsPanel({ teamId, teamName, players, gameId, onPlayerClick }: {
  teamId: number;
  teamName: string;
  players: BoxScorePlayer[];
  gameId: string;
  onPlayerClick: (player: DashboardPlayer, gameId?: string) => void;
}) {
  const totals = players.reduce(
    (acc, player) => ({
      fgm: acc.fgm + stat(player, 'FGM'),
      fga: acc.fga + stat(player, 'FGA'),
      fg3m: acc.fg3m + stat(player, 'FG3M'),
      fg3a: acc.fg3a + stat(player, 'FG3A'),
      ftm: acc.ftm + stat(player, 'FTM'),
      fta: acc.fta + stat(player, 'FTA'),
      tov: acc.tov + stat(player, 'TO'),
      reb: acc.reb + stat(player, 'REB'),
      ast: acc.ast + stat(player, 'AST'),
      blk: acc.blk + stat(player, 'BLK'),
      dreb: acc.dreb + stat(player, 'DREB'),
      oreb: acc.oreb + stat(player, 'OREB'),
      stl: acc.stl + stat(player, 'STL'),
      pts: acc.pts + stat(player, 'PTS'),
    }),
    { fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, tov: 0, reb: 0, ast: 0, blk: 0, dreb: 0, oreb: 0, stl: 0, pts: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 shrink-0 rounded-2xl border border-gray-700 bg-gray-800 p-2 shadow-lg">
            <img src={getTeamLogoUrl(teamId)} alt={teamName} className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-1">Team Box Score</div>
            <div className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
              {teamName}
            </div>
          </div>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <TeamStatMini value={`${totals.fgm}/${totals.fga}`} label="FG" sub={percent(totals.fgm, totals.fga)} />
          <TeamStatMini value={`${totals.fg3m}/${totals.fg3a}`} label="3FG" sub={percent(totals.fg3m, totals.fg3a)} />
          <TeamStatMini value={`${totals.ftm}/${totals.fta}`} label="FTS" sub={percent(totals.ftm, totals.fta)} />
          <TeamStatMini value={totals.tov} label="TO" />
          <TeamStatMini value={totals.reb} label="REB" />
          <TeamStatMini value={totals.ast} label="AST" />
          <TeamStatMini value={totals.blk} label="BLK" />
          <TeamStatMini value={totals.dreb} label="DREB" />
          <TeamStatMini value={totals.oreb} label="OREB" />
          <TeamStatMini value={totals.pts} label="POT" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {players.length === 0 && <div className="col-span-full rounded-3xl border border-gray-800 bg-gray-900/40 p-6 text-center text-gray-500">Player stats are not available yet for this team.</div>}
        {players.map(player => (
          <PlayerStatRow key={`${player.TEAM_ID}-${player.PLAYER_ID}`} player={player} onClick={() => onPlayerClick(player, gameId)} />
        ))}
      </div>
    </div>
  );
}

function TeamStatMini({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl text-center min-w-max">
       <div className="text-xl font-black text-white">{value}</div>
       <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest mt-1">{label}</div>
       {sub && <div className="mt-1 text-xs font-bold text-gray-400">{sub}</div>}
    </div>
  );
}

function PlayerStatRow({ player, onClick }: { player: BoxScorePlayer; onClick: () => void }) {
  const nameParts = player.PLAYER_NAME.split(' ');
  const displayName = nameParts.length > 1 
    ? `${nameParts[0].charAt(0)}. ${nameParts.slice(1).join(' ')}` 
    : player.PLAYER_NAME;
  
  return (
    <div 
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className="bg-gray-900/40 border border-gray-800 rounded-3xl overflow-hidden group transition-all duration-300 hover:border-orange-500/50 cursor-pointer hover:shadow-2xl hover:shadow-orange-500/10 relative z-10"
    >
      <div className="p-6 relative">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-1">
               {player.START_POSITION ? 'Starter' : ''}
            </div>
            <div className="text-xl font-black text-white italic uppercase tracking-tighter leading-none group-hover:text-orange-400 transition-colors">
              {displayName}
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-[10px] font-bold">
            <Activity size={12} className="text-orange-500/50" />
            <span>ACTIVE</span>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 mt-6">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 overflow-hidden border border-gray-700 group-hover:border-orange-500 transition-colors">
              <img 
                src={getPlayerHeadshotUrl(player.PLAYER_ID)} 
                className="w-full h-full object-cover scale-125 translate-y-2" 
                alt={player.PLAYER_NAME}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://www.nba.com/assets/logos/teams/primary/web/NBA.svg';
                  (e.target as HTMLImageElement).classList.add('p-2', 'opacity-20');
                }}
              />
            </div>
          </div>
          
          <div className="flex flex-1 gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <PlayerStat value={minuteValue(player.MIN)} label="MIN" />
            <PlayerStat value={player.PTS ?? '-'} label="PTS" />
            <PlayerStat value={player.REB ?? '-'} label="REB" />
            <PlayerStat value={player.AST ?? '-'} label="AST" />
            <PlayerStat value={player.STL ?? '-'} label="STL" />
            <PlayerStat value={player.BLK ?? '-'} label="BLK" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerStat({ value, label, valueClass = 'text-white' }: { value: string | number; label: string; valueClass?: string }) {
  return (
    <div className="flex flex-col items-start shrink-0">
      <span className={`text-[17px] leading-none font-black ${valueClass}`}>{value}</span>
      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1.5">{label}</span>
    </div>
  );
}

function PlayerDetail({ player, shots, logs, averages: _averages, playerImpact, playByPlay, onClose }: {
  player: DashboardPlayer;
  shots: PlayerShot[];
  logs: PlayerGameLog[];
  averages: any | null;
  playerImpact: PlayerImpact | null;
  playByPlay: PlayByPlay[];
  onClose: () => void;
}) {
  const [shotFilter, setShotFilter] = useState<'all' | 'makes' | 'misses'>('all');
  const playerId = player.PERSON_ID || player.PLAYER_ID || '';
  const fullName = player.PLAYER_NAME || `${player.PLAYER_FIRST_NAME || ''} ${player.PLAYER_LAST_NAME || ''}`.trim();
  
  const matchPlays = useMemo(() => {
    let plays: any[] = [];
    const pbpPlays = playByPlay
      .filter(p => p.PLAYER1_ID === Number(playerId) && [1, 2, 3].includes(Number(p.EVENTMSGTYPE)))
      .map(p => {
        const desc = p.HOMEDESCRIPTION || p.VISITORDESCRIPTION || p.NEUTRALDESCRIPTION || 'Shot Attempt';
        const shotType = getPlayShotType(p, desc);
        const made = Number(p.EVENTMSGTYPE) === 1 || (Number(p.EVENTMSGTYPE) === 3 && !isMissedFreeThrow(desc));
        return {
          PLAYER_ID: p.PLAYER1_ID || 0,
          PLAYER_NAME: p.PLAYER1_NAME || '',
          PERIOD: p.PERIOD,
          MINUTES_REMAINING: Number(p.PCTIMESTRING?.split(':')[0] || 0),
          SECONDS_REMAINING: Number(p.PCTIMESTRING?.split(':')[1] || 0),
          ACTION_TYPE: desc,
          SHOT_DISTANCE: shotType === '3PT' ? 24 : shotType === 'FT' ? 15 : 10,
          SHOT_MADE_FLAG: made ? 1 : 0,
          IS_MISS: !made,
          GAME_EVENT_ID: p.EVENTNUM,
          TYPE: shotType,
          ASSISTED_BY: p.PLAYER2_NAME,
        };
      });

    if (pbpPlays.length > 0) {
      plays = pbpPlays;
    } else if (shots.length > 0) {
      plays = shots.map(s => ({
        ...s,
        PLAYER_ID: s.PLAYER_ID || Number(playerId),
        IS_MISS: s.SHOT_MADE_FLAG === 0,
        TYPE: getShotChartType(s)
      }));
    }

    // Apply Filter
    if (shotFilter === 'makes') plays = plays.filter(p => !p.IS_MISS);
    if (shotFilter === 'misses') plays = plays.filter(p => p.IS_MISS);

    // Sort: Put misses at the top (per user request), then by time (period descending, time descending)
    return plays.sort((a, b) => {
       if (a.IS_MISS !== b.IS_MISS) return a.IS_MISS ? -1 : 1;
       if (a.PERIOD !== b.PERIOD) return b.PERIOD - a.PERIOD;
       const aTime = (a.MINUTES_REMAINING || 0) * 60 + (a.SECONDS_REMAINING || 0);
       const bTime = (b.MINUTES_REMAINING || 0) * 60 + (b.SECONDS_REMAINING || 0);
       return bTime - aTime;
    });
  }, [shots, playByPlay, playerId, shotFilter]);
  
  const madeShotsCount = matchPlays.filter(p => !p.IS_MISS).length;
  const scoringMethodCounts = useMemo(() => {
    const impactCounts = new Map<string, number>();
    const playCounts = new Map<string, number>();

    (playerImpact?.scoring_breakdown || []).forEach(item => {
      const type = normalizeScoringType(item.type);
      impactCounts.set(type, (impactCounts.get(type) || 0) + 1);
    });

    matchPlays
      .filter(play => !play.IS_MISS)
      .forEach(play => {
        const type = normalizeScoringType(play.TYPE);
        playCounts.set(type, (playCounts.get(type) || 0) + 1);
      });

    return ['3PT', '2PT', 'FT']
      .map(type => ({ type, count: Math.max(impactCounts.get(type) || 0, playCounts.get(type) || 0) }))
      .filter(item => item.count > 0);
  }, [matchPlays, playerImpact]);
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-0 backdrop-blur-xl sm:p-6 lg:left-16 xl:left-64">
      <div className="relative flex max-h-dvh w-full max-w-5xl flex-col overflow-hidden rounded-none border border-white/10 bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur-md sm:max-h-[90vh] sm:rounded-[2rem]">
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          className="absolute top-4 right-4 z-[110] p-2 bg-slate-900/90 hover:bg-orange-500 rounded-full transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-xl border border-white/10"
          aria-label="Close"
        >
           <X className="text-white" size={20} />
        </button>

        <div className="relative shrink-0 h-56 sm:h-72 md:h-80 overflow-hidden bg-slate-900/40">
           <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent z-10" />
           <img 
             src={getPlayerHeadshotUrl(playerId)} 
             className="absolute inset-0 w-full h-full object-cover object-top"
             alt={fullName} 
           />
           <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-4 sm:px-10 sm:pb-8">
             <div className="inline-flex items-center gap-2 sm:gap-3 rounded-full bg-slate-950/70 px-3 sm:px-4 py-2 mb-2 sm:mb-3 text-xs font-semibold uppercase tracking-[0.16em]">
                <img src={getTeamLogoUrl(player.TEAM_ID)} className="h-4 w-4 sm:h-5 sm:w-5 object-contain drop-shadow-md" alt="" />
                <span className="text-orange-500">{player.START_POSITION ? 'STARTER' : 'BENCH'}</span>
             </div>
             <h2 className="max-w-3xl text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight uppercase leading-tight">
               {fullName}
             </h2>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 p-4 sm:p-6 lg:p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600">
           <div className="w-full lg:w-1/2 space-y-6">
              <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.25)]">
                 <h3 className="text-sm font-black uppercase tracking-[0.24em] text-slate-400 mb-6">Advanced Stats</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-y-6 gap-x-2">
                    <PlayerStatDetail value={player.PTS ?? '-'} label="PTS" valueClass="text-orange-500" />
                    <PlayerStatDetail value={player.REB ?? '-'} label="REB" valueClass="text-orange-500" />
                    <PlayerStatDetail value={player.AST ?? '-'} label="AST" valueClass="text-orange-500" />
                    <PlayerStatDetail value={player.STL ?? '-'} label="STL" />
                    <PlayerStatDetail value={player.BLK ?? '-'} label="BLK" />
                    <PlayerStatDetail value={minuteValue(player.MIN)} label="MIN" />
                    <PlayerStatDetail value={player.FG_PCT ? `${(player.FG_PCT * 100).toFixed(1)}%` : '-'} label="FG%" />
                    <PlayerStatDetail value={`${player.FGM ?? '-'}/${player.FGA ?? '-'}`} label="FGM/FGA" />
                    <PlayerStatDetail value={`${player.FG3M ?? '-'}/${player.FG3A ?? '-'}`} label="3PM/3PA" />
                    <PlayerStatDetail value={`${player.FTM ?? '-'}/${player.FTA ?? '-'}`} label="FTM/FTA" />
                    <PlayerStatDetail value={player.TOV ?? '-'} label="TOV" />
                    <PlayerStatDetail value={player.PLUS_MINUS ?? '-'} label="+/-" />
                 </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.25)]">
                 <h3 className="text-sm font-black uppercase tracking-[0.24em] text-slate-400 mb-4">Recent Games</h3>
                 <div className="flex flex-col gap-3">
                    {logs.slice(0, 5).map((log, i) => (
                       <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                          <div className="flex items-center gap-3">
                             <span className="text-xl">{log.PTS >= 20 ? '🔥' : '🏀'}</span>
                             <div>
                                <div className="text-sm font-bold text-white uppercase">{log.PTS} PTS, {log.REB} REB, {log.AST} AST</div>
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{log.GAME_DATE} • {log.MATCHUP}</div>
                             </div>
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-orange-500 bg-orange-500/10 px-2 py-1 rounded-md">{log.PTS >= 25 ? 'Elite' : 'Solid'}</span>
                       </div>
                    ))}
                    {logs.length === 0 && <div className="text-center italic text-slate-500 py-4 text-sm font-bold">No recent games available</div>}
                 </div>
              </div>
           </div>

           <div className="w-full lg:w-1/2 flex flex-col gap-4">
              <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.25)]">
                 <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Match Plays</p>
                      <p className="mt-2 text-sm text-slate-300">{matchPlays.length} total filtered · {madeShotsCount} makes</p>
                    </div>
                    <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
                       {(['all', 'makes', 'misses'] as const).map(f => (
                         <button
                           key={f}
                           onClick={() => setShotFilter(f)}
                           className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${shotFilter === f ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                         >
                           {f}
                         </button>
                       ))}
                    </div>
                 </div>
              </div>

              {playerImpact && (
                 <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.25)] space-y-6">
                   <div className="flex items-center gap-2">
                     <div className="bg-orange-500/20 p-2 rounded-xl">
                       <Zap size={16} className="text-orange-500" />
                     </div>
                     <h3 className="text-sm font-black uppercase tracking-[0.24em] text-slate-200">Intelligence Breakdown</h3>
                   </div>
                   
                   <div className="space-y-4">
                     <div>
                       <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Scoring Methods</div>
                       <div className="flex flex-wrap gap-2">
                         {scoringMethodCounts.map((item) => {
                           return (
                             <div key={item.type} className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                               <span className="text-xs font-bold text-white">{item.type}</span>
                               <span className="text-[10px] font-black text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-md">{item.count}</span>
                             </div>
                           );
                         })}
                         {scoringMethodCounts.length === 0 && (
                           <div className="text-[10px] italic text-slate-600 py-2">No made scoring plays yet</div>
                         )}
                       </div>
                     </div>

                     <div className="pt-2 border-t border-white/5">
                       <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">Who This Player Assisted</div>
                       <div className="space-y-2">
                         {aggregateAssists(playerImpact.assists_tracking || []).slice(0, 6).map((ast, i) => (
                           <div key={i} className="flex items-center justify-between gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                             <div className="flex items-center gap-2">
                               <div className="w-1 h-1 rounded-full bg-orange-500" />
                               <span className="text-xs font-bold text-slate-200">{ast.to_player_name}</span>
                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{ast.count} assisted FG</span>
                             </div>
                             <span className="text-sm font-black text-orange-500 italic">{ast.points_generated} pts scored</span>
                           </div>
                         ))}
                         {(!playerImpact.assists_tracking || playerImpact.assists_tracking.length === 0) && (
                           <div className="text-[10px] italic text-slate-600 text-center py-2">No assist tracking for this match</div>
                         )}
                       </div>
                     </div>
                     
                     <div className="flex items-center justify-between pt-4 border-t border-white/5">
                       <span className="text-[10px] font-black uppercase text-slate-400">Total Generated Impact</span>
                       <span className="text-lg font-black text-orange-500 italic">+{playerImpact.total_generated_points} PTS</span>
                     </div>
                   </div>
                 </div>
               )}
              
              <div className="flex flex-col gap-3">
                                   {matchPlays.map((shot, i) => (
                                         <div key={i} className={`flex flex-col gap-3 rounded-3xl border p-4 transition-colors ${shot.IS_MISS ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-900/70 border-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.25)]'}`}>
                       <div className="flex items-center gap-4">
                         <div className="relative shrink-0">
                           <div className="h-12 w-12 overflow-hidden rounded-full border border-gray-800 bg-gray-900">
                             <img src={getPlayerHeadshotUrl(playerId)} className="h-full w-full object-cover object-top scale-125 translate-y-2" alt={fullName} />
                           </div>
                         </div>
                         <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                               <img src={getTeamLogoUrl(player.TEAM_ID)} className="h-4 w-4 object-contain" alt="team" />
                               <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Q{shot.PERIOD || 1} {shot.MINUTES_REMAINING}:{shot.SECONDS_REMAINING?.toString().padStart(2, '0')}</span>
                            </div>
                            <div className="text-lg font-bold text-white leading-tight">
                                                               {shot.ACTION_TYPE || `${shot.SHOT_DISTANCE}' ${shot.TYPE === '3PT' ? 'three pointer' : shot.TYPE === 'FT' ? 'free throw' : 'shot'}`}
                                {shot.IS_MISS && <span className="ml-2 text-xs text-red-500 font-black uppercase tracking-widest">(Miss)</span>}
                            </div>
                         </div>
                         <div className="text-right text-xs font-bold text-orange-500">
                            {shot.TYPE === '3PT' ? '3pt Play' : shot.TYPE === 'FT' ? 'Free Throw' : '2pt Play'}
                         </div>
                       </div>
                       <div className="flex items-center justify-between text-gray-500 text-xs font-bold pt-2 border-t border-slate-800">
                          <div className="flex items-center gap-2 text-sm">
                                                           <span>Match Action Tracker</span>
                          </div>
                          <div className="flex items-center gap-4 text-gray-400">
                                                           
                                                           
                          </div>
                        </div>
                    </div>
                 ))}
                                   {matchPlays.length === 0 && <div className="py-16 text-center italic text-slate-400">No match data available for this player.</div>}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function PlayerStatDetail({ value, label, valueClass = 'text-white' }: { value: string | number; label: string; valueClass?: string }) {
  return (
    <div className="flex flex-col items-start min-w-[2.5rem]">
      <span className={`text-[19px] leading-none font-black ${valueClass}`}>{value}</span>
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1.5">{label}</span>
    </div>
  );
}

function GameSummary({ game, awayName, homeName, awayPlayers, homePlayers, awayStats, homeStats, awayShots: _awayShots, homeShots: _homeShots, playByPlay, onPlayerClick }: {
  game: Game;
  awayName: string;
  homeName: string;
  awayPlayers: BoxScorePlayer[];
  homePlayers: BoxScorePlayer[];
  awayStats?: BoxScoreTeam;
  homeStats?: BoxScoreTeam;
  awayShots: PlayerShot[];
  homeShots: PlayerShot[];
  playByPlay: PlayByPlay[];
  onPlayerClick: (player: DashboardPlayer, gameId?: string) => void;
}) {
  const awayPeriods = game.away_period_scores?.length ? game.away_period_scores : periodScoresFromFinal(game.away_score);
  const homePeriods = game.home_period_scores?.length ? game.home_period_scores : periodScoresFromFinal(game.home_score);
  
  const awayLeader = [...awayPlayers].sort((a, b) => (stat(b, 'PTS') || 0) - (stat(a, 'PTS') || 0))[0];
  const homeLeader = [...homePlayers].sort((a, b) => (stat(b, 'PTS') || 0) - (stat(a, 'PTS') || 0))[0];

  return (
    <div className="space-y-8">
      {/* Star Matchup comparison */}
      {(awayLeader || homeLeader) && (
        <div className="bg-slate-900/40 border border-white/5 rounded-[3rem] p-10 relative overflow-hidden backdrop-blur-2xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.5em] text-center mb-10">Live Performance Duel</h3>
          
          <div className="flex items-center justify-between gap-6">
            <div 
              className="flex-1 text-center group cursor-pointer relative z-10"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); awayLeader && onPlayerClick(awayLeader, game.game_id); }}
            >
              <div className="relative mb-6 inline-block">
                <div className="absolute -inset-4 bg-orange-600/10 rounded-full blur-2xl group-hover:bg-orange-600/20 transition-all duration-700" />
                <img 
                  src={getPlayerHeadshotUrl(awayLeader?.PLAYER_ID)} 
                  className="h-32 w-32 object-cover rounded-[2.5rem] bg-slate-950 border-2 border-white/5 shadow-2xl relative z-10 transition-transform group-hover:scale-110" 
                  onError={(e:any) => e.target.src = '/assets/images/nba-6.svg'}
                />
              </div>
              <div className="text-xl font-black text-white italic uppercase tracking-tighter truncate">{awayLeader?.PLAYER_NAME?.split(' ').pop()}</div>
              <div className="flex items-center justify-center gap-3 mt-3">
                 <div className="text-4xl font-black text-orange-500 italic tabular-nums">{stat(awayLeader, 'PTS') || 0}</div>
                 <div className="text-[8px] font-black text-gray-600 uppercase">PTS</div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="text-4xl font-black text-gray-900 italic select-none">VS</div>
              <div className="h-16 w-px bg-white/5" />
            </div>

            <div 
              className="flex-1 text-center group cursor-pointer relative z-10"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); homeLeader && onPlayerClick(homeLeader, game.game_id); }}
            >
              <div className="relative mb-6 inline-block">
                <div className="absolute -inset-4 bg-blue-600/10 rounded-full blur-2xl group-hover:bg-blue-600/20 transition-all duration-700" />
                <img 
                  src={getPlayerHeadshotUrl(homeLeader?.PLAYER_ID)} 
                  className="h-32 w-32 object-cover rounded-[2.5rem] bg-slate-950 border-2 border-white/5 shadow-2xl relative z-10 transition-transform group-hover:scale-110" 
                  onError={(e:any) => e.target.src = '/assets/images/nba-6.svg'}
                />
              </div>
              <div className="text-xl font-black text-white italic uppercase tracking-tighter truncate">{homeLeader?.PLAYER_NAME?.split(' ').pop()}</div>
              <div className="flex items-center justify-center gap-3 mt-3">
                 <div className="text-4xl font-black text-blue-500 italic tabular-nums">{stat(homeLeader, 'PTS') || 0}</div>
                 <div className="text-[8px] font-black text-gray-600 uppercase">PTS</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <QuarterBox game={game} awayName={awayName} homeName={homeName} awayPeriods={awayPeriods} homePeriods={homePeriods} />
      <DifferentialCard game={game} awayPeriods={awayPeriods} homePeriods={homePeriods} playByPlay={playByPlay} />
      <BiggestLeads awayName={awayName} homeName={homeName} awayPlayers={awayPlayers} homePlayers={homePlayers} />
      <TeamComparison awayStats={awayStats} homeStats={homeStats} />
    </div>
  );
}

function QuarterBox({ game, awayName, homeName, awayPeriods, homePeriods }: {
  game: Game;
  awayName: string;
  homeName: string;
  awayPeriods: number[];
  homePeriods: number[];
}) {
  const labels = ['1st', '2nd', '3rd', '4th', 'OT', '2OT', '3OT'].slice(0, Math.max(4, awayPeriods.length, homePeriods.length));
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Game</div>
          <div className="text-2xl font-black italic uppercase tracking-tighter text-white">{statusText(game)}</div>
        </div>
        <div className="text-right text-xs font-bold uppercase tracking-[0.18em] text-gray-500">{game.arena || 'Arena TBD'}</div>
      </div>
      <div className="grid gap-2 overflow-x-auto text-center text-sm font-bold text-gray-400" style={{ gridTemplateColumns: `80px repeat(${labels.length}, minmax(44px, 1fr))` }}>
        <div className="text-left">Box</div>
        {labels.map(label => <div key={label}>{label}</div>)}
        <div className="text-left">
          <img src={getTeamLogoUrl(game.away_team_id)} alt={awayName} className="h-8 w-8 object-contain" />
        </div>
        {labels.map((_, index) => <div key={`away-${index}`} className="text-xl text-white">{awayPeriods[index] ?? 0}</div>)}
        <div className="text-left">
          <img src={getTeamLogoUrl(game.home_team_id)} alt={homeName} className="h-8 w-8 object-contain" />
        </div>
        {labels.map((_, index) => <div key={`home-${index}`} className="text-xl text-white">{homePeriods[index] ?? 0}</div>)}
      </div>
    </div>
  );
}

function DifferentialCard({ game, awayPeriods, homePeriods, playByPlay }: { game: Game; awayPeriods: number[]; homePeriods: number[]; playByPlay: PlayByPlay[] }) {
  const points = useMemo(() => {
    const scoringEvents = [...playByPlay]
      .filter(event => event.SCORE && [1, 3].includes(Number(event.EVENTMSGTYPE)))
      .sort((a, b) => {
        if (a.PERIOD !== b.PERIOD) return a.PERIOD - b.PERIOD;
        return clockToSeconds(b.PCTIMESTRING) - clockToSeconds(a.PCTIMESTRING);
      });

    if (scoringEvents.length > 0) {
      const diffs = [0];
      scoringEvents.forEach(event => {
        const [awayScore, homeScore] = String(event.SCORE).split('-').map(value => Number(value.trim()));
        if (Number.isFinite(awayScore) && Number.isFinite(homeScore)) {
          diffs.push(awayScore - homeScore);
        }
      });
      return diffs;
    }

    const diffs = [0];
    let currentAway = 0;
    let currentHome = 0;
    const count = Math.max(awayPeriods.length, homePeriods.length);
    for (let i = 0; i < count; i++) {
      currentAway += awayPeriods[i] || 0;
      currentHome += homePeriods[i] || 0;
      diffs.push(currentAway - currentHome);
    }
    
    // Add current live score for a more real-time momentum graph
    if (game.status === 'live') {
      const liveDiff = (game.away_score || 0) - (game.home_score || 0);
      if (diffs[diffs.length - 1] !== liveDiff) {
        diffs.push(liveDiff);
      }
    }
    return diffs;
  }, [awayPeriods, homePeriods, game.away_score, game.home_score, game.status, playByPlay]);

  const periodsCount = Math.max(4, awayPeriods.length, homePeriods.length);
  const labels = ['Q1', 'Q2', 'Q3', 'Q4', 'OT1', 'OT2', 'OT3', 'OT4'].slice(0, periodsCount);

  // Generate paths
  const scaleX = 520 / Math.max(points.length - 1, 1);
  const maxDiff = Math.max(20, ...points.map(Math.abs));
  const scaleY = 70 / maxDiff; // Keep within bounds

  const pointsStr = points.map((p, i) => `${i * scaleX},${85 - p * scaleY}`).join(' ');
  const linePath = `M ${pointsStr}`;
  const fillPath = `M 0,85 ${pointsStr} ${points.length * scaleX},85 Z`;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-2xl font-black italic uppercase tracking-tighter text-gray-400">Momentum Flow</h3>
        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
           <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500" /> {game.away_team_abbreviation}</div>
           <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> {game.home_team_abbreviation}</div>
        </div>
      </div>
      <div className="grid grid-cols-[44px_1fr] gap-4">
        <div className="flex flex-col justify-between py-2 items-center">
          <img src={getTeamLogoUrl(game.away_team_id)} alt="" className="h-8 w-8 object-contain opacity-50 grayscale hover:grayscale-0 transition-all" />
          <div className="h-12 w-px bg-white/5" />
          <img src={getTeamLogoUrl(game.home_team_id)} alt="" className="h-8 w-8 object-contain opacity-50 grayscale hover:grayscale-0 transition-all" />
        </div>
        <svg viewBox="0 0 520 170" className="h-44 w-full overflow-visible">
          <defs>
            <linearGradient id="diffGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(249,115,22,0.4)" />
              <stop offset="48%" stopColor="rgba(249,115,22,0.05)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="52%" stopColor="rgba(59,130,246,0.05)" />
              <stop offset="100%" stopColor="rgba(59,130,246,0.4)" />
            </linearGradient>
          </defs>

          {Array.from({ length: periodsCount + 1 }).map((_, index) => {
            const x = (index / periodsCount) * 520;
            return <line key={index} x1={x} x2={x} y1="12" y2="145" stroke="white" strokeDasharray="4 6" opacity="0.05" />;
          })}
          
          <line x1="0" x2="520" y1="85" y2="85" stroke="white" opacity="0.1" strokeWidth="1" />
          
          <path d={fillPath} fill="url(#diffGradient)" className="transition-all duration-1000" />
          <path d={linePath} fill="none" stroke="white" strokeWidth="2" opacity="0.2" className="transition-all duration-1000" />
          
          {points.map((p, i) => (
            <circle key={i} cx={i * scaleX} cy={85 - p * scaleY} r="3" fill={p > 0 ? '#f97316' : p < 0 ? '#3b82f6' : 'white'} />
          ))}

          {labels.map((label, index) => {
            const x = ((index + 0.5) / periodsCount) * 520;
            return <text key={label} x={x} y="166" fill="#64748b" fontSize="14" fontWeight="900" textAnchor="middle" className="uppercase tracking-widest">{label}</text>;
          })}
        </svg>
      </div>
    </div>
  );
}

function BiggestLeads({ awayName, homeName, awayPlayers, homePlayers }: { awayName: string; homeName: string; awayPlayers: BoxScorePlayer[]; homePlayers: BoxScorePlayer[] }) {
  const awayTop = topPlayer(awayPlayers);
  const homeTop = topPlayer(homePlayers);
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5">
      <h3 className="mb-5 text-2xl font-black italic uppercase tracking-tighter text-gray-400">Biggest leads · Best player streaks</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {[{ name: awayName, player: awayTop }, { name: homeName, player: homeTop }].map(item => (
          <div key={item.name} className="flex items-center gap-4">
            {item.player ? (
              <img src={getPlayerHeadshotUrl(item.player.PLAYER_ID)} alt={item.player.PLAYER_NAME} className="h-14 w-14 rounded-2xl object-cover object-top scale-110 bg-gray-800" />
            ) : (
              <div className="h-14 w-14 rounded-2xl bg-gray-800" />
            )}
            <div>
              <div className="text-sm font-bold text-gray-500">{item.name}</div>
              <div className="text-xl font-black text-white">{item.player?.PLAYER_NAME || 'No player data'}</div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500">{item.player?.PTS ?? '-'} PTS</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamComparison({ awayStats, homeStats }: { awayStats?: BoxScoreTeam; homeStats?: BoxScoreTeam }) {
  if (!awayStats || !homeStats) {
    return <PlaceholderPanel title="Team comparison loading" />;
  }
  const rows = [
    { label: 'FG', away: `${awayStats.FGM ?? 0}/${awayStats.FGA ?? 0}`, awayPct: pctLabel(awayStats.FG_PCT), home: `${homeStats.FGM ?? 0}/${homeStats.FGA ?? 0}`, homePct: pctLabel(homeStats.FG_PCT), awayValue: awayStats.FGM ?? 0, homeValue: homeStats.FGM ?? 0 },
    { label: '3FG', away: `${awayStats.FG3M ?? 0}/${awayStats.FG3A ?? 0}`, awayPct: pctLabel(awayStats.FG3_PCT), home: `${homeStats.FG3M ?? 0}/${homeStats.FG3A ?? 0}`, homePct: pctLabel(homeStats.FG3_PCT), awayValue: awayStats.FG3M ?? 0, homeValue: homeStats.FG3M ?? 0 },
    { label: 'FTS', away: `${awayStats.FTM ?? 0}/${awayStats.FTA ?? 0}`, awayPct: pctLabel(awayStats.FT_PCT), home: `${homeStats.FTM ?? 0}/${homeStats.FTA ?? 0}`, homePct: pctLabel(homeStats.FT_PCT), awayValue: awayStats.FTM ?? 0, homeValue: homeStats.FTM ?? 0 },
    { label: 'Turnovers', away: awayStats.TO ?? 0, home: homeStats.TO ?? 0, awayValue: awayStats.TO ?? 0, homeValue: homeStats.TO ?? 0 },
    { label: 'Rebounds', away: awayStats.REB ?? 0, home: homeStats.REB ?? 0, awayValue: awayStats.REB ?? 0, homeValue: homeStats.REB ?? 0 },
    { label: 'Assists', away: awayStats.AST ?? 0, home: homeStats.AST ?? 0, awayValue: awayStats.AST ?? 0, homeValue: homeStats.AST ?? 0 },
    { label: 'Blocks', away: awayStats.BLK ?? 0, home: homeStats.BLK ?? 0, awayValue: awayStats.BLK ?? 0, homeValue: homeStats.BLK ?? 0 },
    { label: 'Defensive rebounds', away: awayStats.DREB ?? 0, home: homeStats.DREB ?? 0, awayValue: awayStats.DREB ?? 0, homeValue: homeStats.DREB ?? 0 },
    { label: 'Offensive rebounds', away: awayStats.OREB ?? 0, home: homeStats.OREB ?? 0, awayValue: awayStats.OREB ?? 0, homeValue: homeStats.OREB ?? 0 },
    { label: 'Steals', away: awayStats.STL ?? 0, home: homeStats.STL ?? 0, awayValue: awayStats.STL ?? 0, homeValue: homeStats.STL ?? 0 },
    { label: 'Personal fouls', away: awayStats.PF ?? 0, home: homeStats.PF ?? 0, awayValue: awayStats.PF ?? 0, homeValue: homeStats.PF ?? 0 }
  ];
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5">
      <h3 className="mb-6 text-2xl font-black italic uppercase tracking-tighter text-gray-400">Head-to-head</h3>
      <div className="space-y-5">
        {rows.map(row => <ComparisonRow key={row.label} row={row} />)}
      </div>
    </div>
  );
}

function ComparisonRow({ row }: { row: { label: string; away: string | number; awayPct?: string; home: string | number; homePct?: string; awayValue: number; homeValue: number } }) {
  const total = Math.max(row.awayValue + row.homeValue, 1);
  const awayWidth = Math.max(4, (row.awayValue / total) * 100);
  return (
    <div>
      <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-baseline gap-3">
        <div className="text-left text-xl font-black text-white">{row.away} <span className="text-sm text-gray-500">{row.awayPct}</span></div>
        <div className="text-sm font-bold uppercase tracking-[0.18em] text-gray-500">{row.label}</div>
        <div className="text-right text-xl font-black text-white"><span className="text-sm text-gray-500">{row.homePct}</span> {row.home}</div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-rose-950">
        <div className="h-full bg-orange-500/50" style={{ width: `${awayWidth}%` }} />
      </div>
    </div>
  );
}

function pctLabel(value?: number | null) {
  return value == null ? undefined : `${(value * 100).toFixed(1)}%`;
}

function topPlayer(players: BoxScorePlayer[]) {
  return [...players].sort((a, b) => (b.PTS ?? 0) - (a.PTS ?? 0))[0];
}

function periodScoresFromFinal(score: number) {
  if (!score) return [0, 0, 0, 0];
  const base = Math.floor(score / 4);
  return [base, base, base, score - base * 3];
}

function PlaceholderPanel({ title }: { title: string }) {
  return <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 text-center text-gray-500">{title} data will appear here.</div>;
}


function statusText(game: Game) {
  return gameStatusInIndia(game);
}



function seriesText(game: Game) {
  if (game.series_info && game.series_info.series_leader) {
    return game.series_info.series_leader;
  }
  if (game.status === 'scheduled') return 'Scheduled';
  if (game.away_score > game.home_score) return `${game.away_team_abbreviation || 'Away'} wins`;
  if (game.home_score > game.away_score) return `${game.home_team_abbreviation || 'Home'} wins`;
  return 'Tied';
}

function statusOrder(status: Game['status']) {
  if (status === 'live') return 0;
  if (status === 'final') return 1;
  return 2;
}

function percent(made: number, attempts: number) {
  return attempts > 0 ? `${((made / attempts) * 100).toFixed(1)}%` : '-';
}

function minuteValue(minutes?: string | null) {
  if (!minutes) return '-';
  if (minutes.startsWith('PT')) {
    const match = minutes.match(/PT(\d+)M(?:(\d+)(?:\.\d+)?S)?/);
    if (match) {
      const m = match[1];
      const s = match[2] || '00';
      return `${m}:${s.padStart(2, '0')}`;
    }
  }
  const [mins] = minutes.split(':');
  return mins || minutes;
}

function stat(player: BoxScorePlayer, key: string) {
  const value = (player as unknown as Record<string, number | null | undefined>)[key];
  return typeof value === 'number' ? value : 0;
}

function getPlayShotType(event: PlayByPlay, description: string) {
  const desc = description.toUpperCase();
  // Free throws first — EVENTMSGTYPE 3 or description
  if (Number(event.EVENTMSGTYPE) === 3 || desc.includes('FREE THROW')) return 'FT';
  // SHOT_VALUE from CDN live data is the most reliable 3PT signal
  if (Number((event as unknown as { SHOT_VALUE?: number }).SHOT_VALUE) === 3) return '3PT';
  // Text-based 3PT detection — covers stats API and CDN descriptions
  if (
    desc.includes('3PT') ||
    desc.includes('3-PT') ||
    desc.includes('3 PT') ||
    desc.includes('THREE') ||
    desc.includes('3-POINT') ||
    desc.includes('3 POINT') ||
    desc.includes('3POINT')
  ) return '3PT';
  if (![1, 2, 3].includes(Number(event.EVENTMSGTYPE))) return eventTypeLabel(Number(event.EVENTMSGTYPE));
  return '2PT';
}

function normalizeScoringType(type?: string | null) {
  const value = String(type || '').toUpperCase();
  if (value.includes('3')) return '3PT';
  if (value.includes('FT') || value.includes('FREE')) return 'FT';
  return '2PT';
}

function eventTypeLabel(type: number) {
  if (type === 4) return 'REB';
  if (type === 5) return 'TOV';
  if (type === 6) return 'FOUL';
  if (type === 8) return 'SUB';
  if (type === 9) return 'TIMEOUT';
  return 'PLAY';
}

function getShotChartType(shot: PlayerShot) {
  const action = (shot.ACTION_TYPE || '').toUpperCase();
  const zone = ((shot as any).SHOT_ZONE_BASIC || '').toUpperCase();
  const range = ((shot as any).SHOT_ZONE_RANGE || '').toUpperCase();
  if (action.includes('FREE THROW')) return 'FT';
  if (
    Number(shot.SHOT_DISTANCE) >= 22 ||
    action.includes('3PT') ||
    action.includes('3-PT') ||
    action.includes('3-POINT') ||
    action.includes('3 POINT') ||
    zone.includes('3') ||
    range.includes('3')
  ) return '3PT';
  return '2PT';
}

function isMissedFreeThrow(description: string) {
  const desc = description.toUpperCase();
  return desc.includes('MISS') || desc.includes('MISSED');
}

function stripPlayAnnotations(raw: string) {
  return raw
    .replace(/\(\d+\s*PTS\)/gi, '')
    .replace(/\[\d+-\d+\]/g, '')
    .replace(/\([^()]+?\s+\d+\s*AST\)/gi, '')
    .trim();
}

function extractPlayerNameFromRaw(raw: string) {
  const clean = stripPlayAnnotations(raw).replace(/^MISS(?:ED)?\s+/i, '').trim();
  const actionIndex = clean.search(/\b(3PT|3-PT|3 PT|DUNK|LAYUP|LAY UP|FREE THROW|JUMP SHOT|JUMPER|PULL-UP|PULL UP|HOOK|FLOATER|RUNNER|FADEAWAY|TURNAROUND|OFFENSIVE|DEFENSIVE|REBOUND|STEAL|TURNOVER|SHOOTING|PERSONAL|FOUL)\b/i);
  if (actionIndex <= 0) return null;

  const candidate = clean.slice(0, actionIndex).trim();
  if (!/^[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){1,3}$/.test(candidate)) return null;
  return candidate;
}

function formatPlayDescription(raw: string, eventType: number, player1?: string | null, player2?: string | null): string {
  const rawAssister = raw.match(/\(([^()]+?)\s+\d+\s*AST\)/i)?.[1];
  // Strip score/pts annotations like "(27 PTS)", "[112-108]", "(D. Davis 5 AST)"
  const clean = stripPlayAnnotations(raw);

  const up = clean.toUpperCase();
  const name = player1 || extractPlayerNameFromRaw(raw) || 'Player';
  const assister = player2 || rawAssister || null;

  // ── MADE SHOTS ──────────────────────────────────────────────────────────────
  if (eventType === 1) {
    // 3-pointers
    if (up.includes('3PT') || up.includes('3-PT') || up.includes('THREE') || up.includes('3 PT')) {
      const location = getThreePointLocation(up);
      const assistText = assister ? ` - assisted by ${assister}` : '';
      return `${name} drains a three-pointer${location}!${assistText}`;
    }

    // Dunks
    if (up.includes('DUNK')) {
      const assist = assister ? ` - fed by ${assister}` : '';
      return `${name} slams it home!${assist}`;
    }

    // Layups
    if (up.includes('LAYUP') || up.includes('LAY UP') || up.includes('FINGER ROLL')) {
      const assist = assister ? ` - pass from ${assister}` : '';
      return `${name} finishes at the rim!${assist}`;
    }

    // Alley-oop
    if (up.includes('ALLEY OOP') || up.includes('ALLEY-OOP')) {
      const assist = assister ? ` from ${assister}` : '';
      return `${name} finishes the alley-oop${assist}!`;
    }

    // Hook shot
    if (up.includes('HOOK')) {
      return `${name} hits the hook shot!`;
    }

    // Floater
    if (up.includes('FLOATER') || up.includes('RUNNER')) {
      return `${name} floats it in!`;
    }

    // Turnaround
    if (up.includes('TURNAROUND')) {
      return `${name} hits the turnaround jumper!`;
    }

    // Fadeaway
    if (up.includes('FADEAWAY') || up.includes('FADE AWAY')) {
      return `${name} drains the fadeaway!`;
    }

    // Generic jump shot / mid-range
    if (up.includes('JUMP SHOT') || up.includes('JUMPER') || up.includes('PULL-UP')) {
      const assist = assister ? ` - ${assister} with the assist` : '';
      return `${name} knocks down the jumper!${assist}`;
    }

    // Generic made basket
    const assist = assister ? ` - ${assister} with the assist` : '';
    return `${name} scores!${assist}`;
  }

  // ── MISSED SHOTS ─────────────────────────────────────────────────────────────
  if (eventType === 2) {
    if (up.includes('3PT') || up.includes('THREE') || up.includes('3-PT')) {
      return `${name} misses the three-pointer.`;
    }
    if (up.includes('DUNK')) return `${name} misses the dunk attempt.`;
    if (up.includes('LAYUP') || up.includes('LAY UP')) return `${name} misses the layup.`;
    if (up.includes('HOOK')) return `${name} misses the hook shot.`;
    if (up.includes('FLOATER')) return `${name} misses the floater.`;
    if (up.includes('FADEAWAY')) return `${name} misses the fadeaway.`;
    return `${name} misses the shot.`;
  }

  // ── FREE THROWS ───────────────────────────────────────────────────────────────
  if (eventType === 3) {
    const missed = up.includes('MISS') || up.includes('MISSED');
    // Extract "1 of 2" style
    const ftMatch = clean.match(/(\d+)\s+of\s+(\d+)/i);
    const ftLabel = ftMatch ? ` (${ftMatch[1]} of ${ftMatch[2]})` : '';
    if (missed) return `${name} misses the free throw${ftLabel}.`;
    return `${name} makes the free throw${ftLabel}.`;
  }

  // ── REBOUNDS ─────────────────────────────────────────────────────────────────
  if (eventType === 4) {
    if (up.includes('OFFENSIVE')) return `${name} grabs the offensive rebound!`;
    if (up.includes('DEFENSIVE')) return `${name} pulls down the defensive rebound.`;
    return `${name} gets the rebound.`;
  }

  // ── TURNOVERS ────────────────────────────────────────────────────────────────
  if (eventType === 5) {
    if (up.includes('STEAL')) return `${player2 || 'Defender'} steals it from ${name}!`;
    if (up.includes('OUT OF BOUNDS')) return `${name} turns it over - out of bounds.`;
    if (up.includes('LOST BALL')) return `${name} loses the ball - turnover.`;
    if (up.includes('BAD PASS')) return `${name} throws a bad pass - turnover.`;
    if (up.includes('TRAVELING')) return `${name} called for traveling.`;
    if (up.includes('SHOT CLOCK')) return `Shot clock violation on ${name}'s team.`;
    return `${name} turns it over.`;
  }

  // ── FOULS ─────────────────────────────────────────────────────────────────────
  if (eventType === 6) {
    if (up.includes('SHOOTING')) return `Shooting foul on ${name} - free throws coming.`;
    if (up.includes('LOOSE BALL')) return `Loose ball foul called on ${name}.`;
    if (up.includes('FLAGRANT')) return `Flagrant foul called on ${name}!`;
    if (up.includes('TECHNICAL')) return `Technical foul on ${name}.`;
    return `Foul called on ${name}.`;
  }

  // ── BLOCKS ────────────────────────────────────────────────────────────────────
  // Blocks are embedded in missed shot descriptions — handle via raw text
  if (up.includes('BLOCK') || up.includes('BLK')) {
    return `${name} gets the block!`;
  }

  // ── SUBSTITUTIONS ─────────────────────────────────────────────────────────────
  if (eventType === 8) {
    if (up.includes('IN')) return `${name} checks into the game.`;
    if (up.includes('OUT')) return `${name} heads to the bench.`;
    return `Substitution: ${name}.`;
  }

  // ── TIMEOUTS ──────────────────────────────────────────────────────────────────
  if (eventType === 9) {
    return `Timeout called.`;
  }

  // ── JUMP BALL ─────────────────────────────────────────────────────────────────
  if (eventType === 10) {
    return `Jump ball - ${name} tips it off.`;
  }

  // ── PERIOD START/END ──────────────────────────────────────────────────────────
  if (eventType === 12) return `Quarter underway.`;
  if (eventType === 13) return `End of quarter.`;

  // ── FALLBACK: clean up the raw string ─────────────────────────────────────────
  return clean || raw;
}

function getThreePointLocation(description: string) {
  const locations: Array<[string, string]> = [
    ['TOP OF THE KEY', 'from the top of the key'],
    ['ABOVE THE BREAK', 'from above the break'],
    ['LEFT CORNER', 'from the left corner'],
    ['RIGHT CORNER', 'from the right corner'],
    ['CORNER', 'from the corner'],
    ['LEFT WING', 'from the left wing'],
    ['RIGHT WING', 'from the right wing'],
    ['WING', 'from the wing'],
    ['STEP BACK', 'off a step-back'],
    ['PULL-UP', 'off the dribble'],
    ['PULL UP', 'off the dribble'],
    ['CATCH AND SHOOT', 'on the catch-and-shoot'],
  ];

  const match = locations.find(([key]) => description.includes(key));
  return ` ${match?.[1] ?? 'from the top of the key'}`;
}

function clockToSeconds(clock?: string | null) {
  if (!clock) return 0;
  const [minutes, seconds] = clock.split(':').map(Number);
  return (Number.isFinite(minutes) ? minutes : 0) * 60 + (Number.isFinite(seconds) ? seconds : 0);
}

function aggregateAssists(assists: PlayerImpact['assists_tracking']) {
  const map = new Map<string, { to_player_id: number; to_player_name: string; points_generated: number; count: number }>();
  assists.forEach(assist => {
    const key = String(assist.to_player_id || assist.to_player_name);
    const current = map.get(key) ?? {
      to_player_id: assist.to_player_id,
      to_player_name: assist.to_player_name,
      points_generated: 0,
      count: 0,
    };
    current.points_generated += Number(assist.points_generated || 0);
    current.count += 1;
    map.set(key, current);
  });
  return Array.from(map.values()).sort((a, b) => b.points_generated - a.points_generated);
}

function GameFeed({ playByPlay, boxScore, game }: { playByPlay: PlayByPlay[]; boxScore: BoxScorePlayer[]; game: Game }) {
  const filteredEvents = useMemo(() => {
    return playByPlay
      .filter(event => {
        const desc = event.HOMEDESCRIPTION || event.VISITORDESCRIPTION || event.NEUTRALDESCRIPTION || '';
        if (!desc.trim()) return false;
        const type = event.EVENTMSGTYPE;
        const trackTypes = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11];
        if (trackTypes.includes(type)) return true;
        return desc.length > 15;
      })
      .sort((a, b) => {
        if (a.PERIOD !== b.PERIOD) return b.PERIOD - a.PERIOD;
        const parseTime = (t: string | undefined | null) => {
          if (!t) return 0;
          const parts = t.split(':').map(Number);
          if (parts.length < 2) return parts[0] || 0;
          const [m, s] = parts;
          return m * 60 + (s || 0);
        };
        return parseTime(a.PCTIMESTRING) - parseTime(b.PCTIMESTRING);
      })
      .slice(0, 60);
  }, [playByPlay]);

  const fallbackEvents = useMemo(() => buildFallbackFeed(game, boxScore), [game, boxScore]);
  const eventsToShow = filteredEvents.length > 0 ? filteredEvents : fallbackEvents;

  if (eventsToShow.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-slate-900 flex items-center justify-center mb-4 border border-white/5">
          <Activity size={28} className="text-gray-700" />
        </div>
        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Feed Warming Up</h3>
        <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">Play-by-play hasn't posted yet for this game.</p>
      </div>
    );
  }

  // Win probability bar at bottom
  const homeScore = game.home_score ?? 0;
  const awayScore = game.away_score ?? 0;
  const total = homeScore + awayScore;
  const homeProb = total === 0 ? 50 : Math.min(95, Math.max(5, Math.round((homeScore / total) * 100)));
  const awayProb = 100 - homeProb;

  return (
    <div className="flex flex-col">
      {/* Sticky score header */}
      <div className="sticky top-0 z-10 bg-black/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={getTeamLogoUrl(game.away_team_id)} className="h-6 w-6 object-contain" alt="" />
          <span className="text-2xl font-black text-white tabular-nums">{awayScore}</span>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            {game.status === 'live' && <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />}
            <span className="text-xs font-black text-orange-400 uppercase tracking-widest">{statusText(game)}</span>
          </div>
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
            {filteredEvents.length > 0 ? 'Official NBA PBP' : 'Scoreboard'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-white tabular-nums">{homeScore}</span>
          <img src={getTeamLogoUrl(game.home_team_id)} className="h-6 w-6 object-contain" alt="" />
        </div>
      </div>

      {/* Feed items */}
      <div className="divide-y divide-white/[0.06]">
        {eventsToShow.map((event, i) => (
          <FeedItem
            key={`${event.EVENTNUM}-${i}`}
            event={event}
            boxScore={boxScore}
            game={game}
          />
        ))}
      </div>

      {/* Win probability footer */}
      {game.status !== 'scheduled' && (
        <div className="sticky bottom-0 bg-black/95 backdrop-blur border-t border-white/10 px-4 py-3 flex items-center gap-3">
          <button className="flex-1 rounded-full py-2.5 font-black text-sm uppercase tracking-widest text-white"
            style={{ background: `linear-gradient(135deg, #c8102e, #860038)` }}>
            {game.away_team_abbreviation} {awayProb}%
          </button>
          <button className="flex-1 rounded-full py-2.5 font-black text-sm uppercase tracking-widest text-white"
            style={{ background: `linear-gradient(135deg, #1d428a, #006bb6)` }}>
            {game.home_team_abbreviation} {homeProb}%
          </button>
        </div>
      )}
    </div>
  );
}

function FeedItem({ event, boxScore, game }: { event: PlayByPlay; boxScore: BoxScorePlayer[]; game: Game }) {
  const desc = event.HOMEDESCRIPTION || event.VISITORDESCRIPTION || event.NEUTRALDESCRIPTION || '';
  const isHome = !!event.HOMEDESCRIPTION;
  const teamId = isHome ? game.home_team_id : game.away_team_id;
  const teamAbbr = isHome ? game.home_team_abbreviation : game.away_team_abbreviation;

  const player1 = boxScore.find(p => p.PLAYER_ID === event.PLAYER1_ID);
  const player2 = boxScore.find(p => p.PLAYER_ID === event.PLAYER2_ID);

  // Score margin display (▽ or △)
  const margin = event.SCOREMARGIN;
  const marginNum = margin && margin !== 'TIE' ? Number(margin) : 0;
  const marginDisplay = margin === 'TIE' ? 'TIE'
    : marginNum > 0 ? `▲${Math.abs(marginNum)}`
    : `▽${Math.abs(marginNum)}`;

  // Player stat line
  const statLine = (() => {
    if (!player1) return '';
    const type = event.EVENTMSGTYPE;
    const pts = player1.PTS ?? 0;
    const reb = player1.REB ?? 0;
    const ast = player1.AST ?? 0;
    const fgm = player1.FGM ?? 0;
    const fga = player1.FGA ?? 0;
    const fg3m = player1.FG3M ?? 0;
    const ftm = player1.FTM ?? 0;
    const fta = player1.FTA ?? 0;
    if (type === 1 || type === 2) {
      const parts = [`${pts} pt`];
      if (fgm > 0 || fga > 0) parts.push(`${fgm}/${fga} FG`);
      if (fg3m > 0) parts.push(`${fg3m} three${fg3m > 1 ? 's' : ''}`);
      return parts.join(', ');
    }
    if (type === 3) return `${ftm}/${fta} FT, ${pts} pt`;
    if (type === 4) return `${reb} reb`;
    if (type === 5) return `${pts} pt`;
    return `${pts} pt, ${reb} reb, ${ast} ast`;
  })();

  // Assister line
  const assisterLine = player2 && event.PLAYER2_NAME
    ? `${event.PLAYER2_NAME} · ${player2.AST ?? 0} ast`
    : null;

  const headline = formatPlayDescription(desc, event.EVENTMSGTYPE, event.PLAYER1_NAME, event.PLAYER2_NAME);
  const isMiss = event.EVENTMSGTYPE === 2 || (event.EVENTMSGTYPE === 3 && (desc.toUpperCase().includes('MISS')));

  return (
    <div className="px-3 py-3 hover:bg-white/[0.03] transition-colors">
      {/* Top meta row: score · quarter clock · margin */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <img src={getTeamLogoUrl(teamId)} className="h-3.5 w-3.5 object-contain opacity-80" alt="" />
          <span className="text-[11px] font-black text-gray-300 tabular-nums">{event.SCORE || `${game.away_score}-${game.home_score}`}</span>
          <span className="text-gray-700">·</span>
          <span className="text-[11px] font-bold text-gray-500">Q{event.PERIOD} {event.PCTIMESTRING}</span>
          {player1?.MIN && (
            <>
              <span className="text-gray-700">·</span>
              <span className="text-[11px] text-gray-600">{minuteValue(player1.MIN)}m</span>
            </>
          )}
        </div>
        <span className={`text-[11px] font-black tabular-nums ${marginNum === 0 ? 'text-yellow-400' : isMiss ? 'text-gray-500' : 'text-gray-400'}`}>
          {marginDisplay}
        </span>
      </div>

      {/* Main content row */}
      <div className="flex items-start gap-3">
        {/* Player headshot */}
        <div className="relative shrink-0">
          <div className="h-11 w-11 rounded-full overflow-hidden bg-slate-900 border border-white/10">
            <img
              src={getPlayerHeadshotUrl(event.PLAYER1_ID || 0)}
              className="h-full w-full object-cover object-top scale-125 translate-y-1"
              alt={event.PLAYER1_NAME || ''}
              onError={(e: any) => { e.target.src = getTeamLogoUrl(teamId); e.target.className = 'h-full w-full object-contain p-1.5 opacity-60'; }}
            />
          </div>
          {/* Team badge */}
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-black border border-white/10 p-0.5">
            <img src={getTeamLogoUrl(teamId)} className="h-full w-full object-contain" alt="" />
          </div>
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          {/* Headline */}
          <p className={`text-base font-bold leading-snug ${isMiss ? 'text-gray-400' : 'text-white'}`}>
            {headline}
          </p>

          {/* Player stat line */}
          {event.PLAYER1_NAME && (
            <p className="text-[12px] text-gray-400 mt-0.5">
              <span className="text-gray-300 font-medium">{event.PLAYER1_NAME}</span>
              {statLine && <span> · {statLine}</span>}
            </p>
          )}

          {/* Assister */}
          {assisterLine && (
            <p className="text-[11px] text-gray-500 mt-0.5">{assisterLine}</p>
          )}

          {/* Team abbr badge */}
          <div className="mt-1.5 inline-flex items-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">{teamAbbr}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
