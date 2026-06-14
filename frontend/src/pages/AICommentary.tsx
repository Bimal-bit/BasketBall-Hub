import { useEffect, useState } from 'react';
import { MessageSquare, Sparkles, RefreshCw, Copy, Check } from 'lucide-react';
import { supabase, type Game, type Team, type PlayerGameStat, type Player } from '../lib/supabase';
import { generateCommentary } from '../lib/analytics';
import BasketballLoader from '../components/BasketballLoader';

type CommentaryEntry = {
  gameId: string;
  text: string;
  homeTeam: string;
  awayTeam: string;
  score: string;
  generated: Date;
};

export default function AICommentary() {
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [stats, setStats] = useState<PlayerGameStat[]>([]);
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());
  const [commentaries, setCommentaries] = useState<CommentaryEntry[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [{ data: gData }, { data: tData }, { data: sData }, { data: pData }] = await Promise.all([
      supabase.from('nba_games').select('*').eq('status', 'final').order('game_date', { ascending: false }).limit(6),
      supabase.from('nba_teams').select('*'),
      supabase.from('nba_player_game_stats').select('*').order('points', { ascending: false }),
      supabase.from('nba_players').select('*'),
    ]);
    if (gData) setGames(gData);
    if (tData) {
      const map = new Map<string, Team>();
      tData.forEach((t: Team) => map.set(t.team_id, t));
      setTeams(map);
    }
    if (sData) setStats(sData);
    if (pData) {
      const map = new Map<string, Player>();
      pData.forEach((p: Player) => map.set(p.player_id, p));
      setPlayers(map);
    }
    setLoading(false);
  }

  function generateForGame(game: Game) {
    setGenerating(game.game_id);

    const homeTeam = teams.get(game.home_team_id);
    const awayTeam = teams.get(game.away_team_id);

    // Find top performer
    const gameStats = stats.filter(s => s.game_id === game.game_id).sort((a, b) => b.points - a.points);
    const top = gameStats[0];
    const topPlayer = top ? players.get(top.player_id) : undefined;

    const topPerformer = topPlayer
      ? { name: topPlayer.name, points: top.points, assists: top.assists, rebounds: top.rebounds }
      : { name: 'A key contributor', points: Math.round(game.home_score / 4 + Math.random() * 8), assists: Math.round(3 + Math.random() * 5), rebounds: Math.round(4 + Math.random() * 5) };

    setTimeout(() => {
      const text = generateCommentary(
        homeTeam?.name ?? game.home_team_id,
        awayTeam?.name ?? game.away_team_id,
        game.home_score,
        game.away_score,
        topPerformer,
      );

      const entry: CommentaryEntry = {
        gameId: game.game_id,
        text,
        homeTeam: homeTeam?.abbreviation ?? game.home_team_id,
        awayTeam: awayTeam?.abbreviation ?? game.away_team_id,
        score: `${game.away_score}-${game.home_score}`,
        generated: new Date(),
      };

      setCommentaries(prev => {
        const filtered = prev.filter(c => c.gameId !== game.game_id);
        return [entry, ...filtered];
      });
      setGenerating(null);
    }, 1200);
  }

  function regenerate(gameId: string) {
    const game = games.find(g => g.game_id === gameId);
    if (game) generateForGame(game);
  }

  async function copyText(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) return <BasketballLoader />;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-white mb-1">AI Commentary Generator</h2>
          <p className="text-sm text-gray-400">Automatically generates professional-grade match summaries using NLP analysis of game stats and player performance patterns.</p>
        </div>
        <button
          onClick={() => games.forEach(g => generateForGame(g))}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg text-xs text-orange-400 transition-colors w-full sm:w-auto shrink-0"
        >
          <Sparkles size={12} />
          Generate All
        </button>
      </div>

      {/* Existing commentaries */}
      {commentaries.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-white mb-3">Generated Summaries</h3>
          <div className="space-y-3">
            {commentaries.map(c => (
              <div key={c.gameId} className="bg-gray-900 border border-orange-500/20 rounded-xl p-4 hover:scale-[1.01] transition-all duration-200 shadow-none hover:shadow-none">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-orange-500/10 flex items-center justify-center">
                      <MessageSquare size={12} className="text-orange-400" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-white">{c.awayTeam} @ {c.homeTeam}</span>
                      <span className="text-xs text-gray-500 ml-2">Final {c.score}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyText(c.text, c.gameId)}
                      className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                    >
                      {copied === c.gameId ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    </button>
                    <button
                      onClick={() => regenerate(c.gameId)}
                      className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                    >
                      <RefreshCw size={12} />
                    </button>
                  </div>
                </div>
                <blockquote className="text-sm text-gray-200 leading-relaxed  border-l-2 border-orange-500/40 pl-3">
                  "{c.text}"
                </blockquote>
                <div className="text-xs text-gray-500 mt-2">
                  Generated {c.generated.toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Game list to generate from */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Recent Games</h3>
        <div className="space-y-2">
          {games.map(game => {
            const home = teams.get(game.home_team_id);
            const away = teams.get(game.away_team_id);
            const hasCommentary = commentaries.some(c => c.gameId === game.game_id);
            const isGenerating = generating === game.game_id;
            const gameStats = stats.filter(s => s.game_id === game.game_id).sort((a,b)=>b.points-a.points);
            const topStat = gameStats[0];
            const topName = topStat ? players.get(topStat.player_id)?.name : undefined;

            return (
              <div key={game.game_id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:scale-[1.01] transition-all duration-200 shadow-none hover:shadow-none">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <TeamBadge team={away} />
                    <span className="text-sm font-medium text-white">{game.away_score} - {game.home_score}</span>
                    <TeamBadge team={home} />
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(game.game_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {game.arena}
                    {topName && <span className="ml-2 text-gray-500">Top: {topName} {topStat?.points}pts</span>}
                  </div>
                </div>
                <button
                  onClick={() => generateForGame(game)}
                  disabled={isGenerating}
                  className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors w-full sm:w-auto ${
                    hasCommentary
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                      : 'bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20'
                  } disabled:opacity-50`}
                >
                  {isGenerating
                    ? <><RefreshCw size={12} className="animate-spin" /> Generating...</>
                    : hasCommentary
                    ? <><RefreshCw size={12} /> Regenerate</>
                    : <><Sparkles size={12} /> Generate</>
                  }
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Example templates */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-white mb-3">Commentary Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { type: 'Dominant Win', example: 'In a commanding performance, the [Team] showcased their depth and firepower, pulling away in the third quarter to claim a decisive victory...', color: 'text-green-400' },
            { type: 'Clutch Thriller', example: 'It came down to the final possession. With the crowd on their feet and the clock ticking, [Player] stepped up to deliver the moment...', color: 'text-orange-400' },
            { type: 'Comeback Story', example: 'Down by 18 entering the fourth quarter, few believed a comeback was possible. Then [Player] caught fire from deep...', color: 'text-blue-400' },
          ].map(({ type, example, color }) => (
            <div key={type} className="bg-gray-800/50 rounded-lg p-3 hover:scale-[1.02] transition-all duration-200 shadow-none hover:shadow">
              <div className={`text-xs font-medium mb-1 ${color}`}>{type}</div>
              <p className="text-xs text-gray-400 leading-relaxed ">"{example}"</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamBadge({ team }: { team?: Team }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-medium text-white"
        style={{ backgroundColor: team?.logo_color ?? '#374151', fontSize: '9px' }}>
        {team?.abbreviation?.[0] ?? '?'}
      </div>
      <span className="text-xs text-gray-300 font-medium">{team?.abbreviation ?? '??'}</span>
    </div>
  );
}
