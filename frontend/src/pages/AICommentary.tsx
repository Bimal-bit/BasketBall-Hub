import { useEffect, useState } from 'react';
import { MessageSquare, Sparkles, RefreshCw, Copy, Check } from 'lucide-react';
import { getCompletedNbaSeason, nbaApi, type ArchiveGame, type BoxScorePlayer, type NbaTeam } from '../lib/api';
import { generateCommentary } from '../lib/analytics';
import BasketballLoader from '../components/BasketballLoader';
import PageHero from '../components/PageHero';

type CommentaryEntry = {
  gameId: string;
  text: string;
  homeTeam: string;
  awayTeam: string;
  score: string;
  generated: Date;
};

export default function AICommentary() {
  const [games, setGames] = useState<ArchiveGame[]>([]);
  const [teams, setTeams] = useState<Map<string, NbaTeam>>(new Map());
  const [statsByGame, setStatsByGame] = useState<Map<string, BoxScorePlayer[]>>(new Map());
  const [commentaries, setCommentaries] = useState<CommentaryEntry[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Supabase is not populated by this application. Use the same NBA API
      // backend as the other sections so this page cannot silently stay empty.
      const [gameData, teamData] = await Promise.all([
        nbaApi.getHistoricalGames(getCompletedNbaSeason(), 'Regular Season', undefined, 6),
        nbaApi.getTeams(),
      ]);
      setGames(gameData);
      setTeams(new Map(teamData.map(team => [String(team.id), team])));
      const boxscores = await Promise.all(gameData.map(async game => [
        game.GAME_ID,
        await nbaApi.getBoxScore(game.GAME_ID),
      ] as const));
      setStatsByGame(new Map(boxscores));
    } catch (error) {
      console.error('Commentary data load error:', error);
      setGames([]);
      setTeams(new Map());
      setStatsByGame(new Map());
    } finally {
      setLoading(false);
    }
  }

  function generateForGame(game: ArchiveGame) {
    setGenerating(game.GAME_ID);

    const homeTeam = teams.get(String(game.HOME_TEAM_ID));
    const awayTeam = teams.get(String(game.AWAY_TEAM_ID));

    // Find top performer
    const gameStats = (statsByGame.get(game.GAME_ID) ?? []).slice().sort((a, b) => Number(b.PTS ?? 0) - Number(a.PTS ?? 0));
    const top = gameStats[0];

    const topPerformer = top
      ? { name: top.PLAYER_NAME, points: Number(top.PTS ?? 0), assists: Number(top.AST ?? 0), rebounds: Number(top.REB ?? 0) }
      : { name: 'A key contributor', points: 0, assists: 0, rebounds: 0 };

    setTimeout(() => {
      const text = generateCommentary(
        homeTeam?.full_name ?? game.HOME_TEAM_NAME ?? game.HOME_TEAM_ABBREVIATION ?? 'Home team',
        awayTeam?.full_name ?? game.AWAY_TEAM_NAME ?? game.AWAY_TEAM_ABBREVIATION ?? 'Away team',
        Number(game.HOME_PTS ?? 0),
        Number(game.AWAY_PTS ?? 0),
        topPerformer,
      );

      const entry: CommentaryEntry = {
        gameId: game.GAME_ID,
        text,
        homeTeam: homeTeam?.abbreviation ?? game.HOME_TEAM_ABBREVIATION ?? 'HOME',
        awayTeam: awayTeam?.abbreviation ?? game.AWAY_TEAM_ABBREVIATION ?? 'AWAY',
        score: `${game.AWAY_PTS ?? 0}-${game.HOME_PTS ?? 0}`,
        generated: new Date(),
      };

      setCommentaries(prev => {
        const filtered = prev.filter(c => c.gameId !== game.GAME_ID);
        return [entry, ...filtered];
      });
      setGenerating(null);
    }, 1200);
  }

  function regenerate(gameId: string) {
    const game = games.find(g => g.GAME_ID === gameId);
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
        <PageHero kicker="Analysis · Commentary" title="Game" accent="voice">
          <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.08em] text-gray-500">Match summaries from game stats and player performance</p>
        </PageHero>
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
            const home = teams.get(String(game.HOME_TEAM_ID));
            const away = teams.get(String(game.AWAY_TEAM_ID));
            const hasCommentary = commentaries.some(c => c.gameId === game.GAME_ID);
            const isGenerating = generating === game.GAME_ID;
            const gameStats = (statsByGame.get(game.GAME_ID) ?? []).slice().sort((a, b) => Number(b.PTS ?? 0) - Number(a.PTS ?? 0));
            const topStat = gameStats[0];
            const topName = topStat?.PLAYER_NAME;

            return (
              <div key={game.GAME_ID} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:scale-[1.01] transition-all duration-200 shadow-none hover:shadow-none">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <TeamBadge team={away} />
                    <span className="text-sm font-medium text-white">{game.AWAY_PTS ?? 0} - {game.HOME_PTS ?? 0}</span>
                    <TeamBadge team={home} />
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(game.GAME_DATE).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {topName && <span className="ml-2 text-gray-500">Top: {topName} {topStat?.PTS}pts</span>}
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

function TeamBadge({ team }: { team?: NbaTeam }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-medium text-white"
        style={{ backgroundColor: '#374151', fontSize: '9px' }}>
        {team?.abbreviation?.[0] ?? '?'}
      </div>
      <span className="text-xs text-gray-300 font-medium">{team?.abbreviation ?? '??'}</span>
    </div>
  );
}
