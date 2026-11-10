import { ReactNode, useEffect, useMemo, useState } from 'react';
import { LayoutContext } from '../lib/layoutContext';
import {
  Activity, BarChart2, Zap, Trophy, History,
  Menu, Sun, Moon,
  LayoutGrid, ListOrdered, Rocket, Crosshair, ArrowLeftRight, X
} from 'lucide-react';
import { useTheme } from '../lib/theme';
import { nbaApi, type Game } from '../lib/api';

type NavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: string;
  description: string;
  group: 'Live' | 'Analysis' | 'League';
};

type Props = {
  children: ReactNode;
  activePage: string;
  onNavigate: (page: string) => void;
};

const ACCENTS: Array<[string, string] | null> = [
  null,
  ['232 62 140', '10 165 184'],
  ['47 107 255', '217 154 0'],
  ['139 92 246', '18 163 127'],
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-10 w-8 shrink-0 place-items-center overflow-hidden rounded-sm bg-[#1D428A]">
        <img src="/assets/images/ideJVe-SgJ_logos.svg" alt="" className="h-9 w-auto" />
      </span>
      <div className="font-display text-[26px] uppercase leading-none tracking-[0.04em] text-white">
        NBA<i className="not-italic text-orange-500">/</i>Live
      </div>
    </div>
  );
}

function Court() {
  return (
    <svg className="hi-court" viewBox="0 0 940 500" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="10" y="10" width="920" height="480" />
      <path d="M470 10V490" />
      <circle cx="470" cy="250" r="60" />
      <rect x="10" y="170" width="190" height="160" />
      <rect x="740" y="170" width="190" height="160" />
      <circle cx="200" cy="250" r="60" />
      <circle cx="740" cy="250" r="60" />
      <path d="M10 60H80A237 237 0 0 1 80 440H10M930 60H860A237 237 0 0 0 860 440H930" />
      <circle cx="52" cy="250" r="9" />
      <circle cx="888" cy="250" r="9" />
    </svg>
  );
}

export default function Layout({ children, activePage, onNavigate }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [query, setQuery] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [accent, setAccent] = useState(0);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    nbaApi.getScoreboard()
      .then(rows => setGames(rows))
      .catch(() => setGames([]));
  }, []);

  useEffect(() => {
    const stored = Number(localStorage.getItem('hi-acc') || 0);
    if (stored >= 0 && stored < ACCENTS.length) setAccent(stored);
  }, []);

  useEffect(() => {
    const pair = ACCENTS[accent];
    const root = document.documentElement.style;
    if (!pair) {
      root.removeProperty('--hi-acc');
      root.removeProperty('--hi-acc2');
    } else {
      root.setProperty('--hi-acc', pair[0]);
      root.setProperty('--hi-acc2', pair[1]);
    }
    localStorage.setItem('hi-acc', String(accent));
  }, [accent]);

  useEffect(() => {
    const onScroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(height > 0 ? (window.scrollY / height) * 100 : 0);
      setShowTop(window.scrollY > 600);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const liveCount = games.filter(game => game.status === 'live').length;

  const navItems: NavItem[] = useMemo(() => [
    { id: 'dashboard', label: 'Scoreboard', icon: <LayoutGrid size={16} />, badge: 'LIVE', description: 'Scores and live leaders', group: 'Live' },
    { id: 'dreamteam', label: 'Dream Team', icon: <Rocket size={16} />, badge: 'NEW', description: 'Build your custom lineup', group: 'Live' },
    { id: 'players', label: 'Player Analyzer', icon: <BarChart2 size={16} />, description: 'Player trends and stat profiles', group: 'Analysis' },
    { id: 'fatigue', label: 'Fatigue Detector', icon: <Zap size={16} />, description: 'Workload and rest signals', group: 'Analysis' },
    { id: 'shots', label: 'Shot Tools', icon: <Crosshair size={16} />, description: 'Shot quality and court zones', group: 'Analysis' },
    { id: 'simulator', label: 'Strategy Simulator', icon: <Zap size={16} />, description: 'Lineup and matchup scenarios', group: 'Analysis' },
    { id: 'clutch', label: 'Clutch Moments', icon: <Activity size={16} />, description: 'Late-game performance', group: 'Analysis' },
    { id: 'awards', label: 'Awards History', icon: <Trophy size={16} />, description: 'MVP, DPOY, and award races', group: 'League' },
    { id: 'standings', label: 'League Standings', icon: <ListOrdered size={16} />, description: 'Conference and division tables', group: 'League' },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={16} />, description: 'Season statistical leaders', group: 'League' },
    { id: 'vault', label: 'Season Archive', icon: <History size={16} />, description: 'Historical season archive', group: 'League' },
    { id: 'trades', label: 'Trade Tools', icon: <ArrowLeftRight size={16} />, description: 'Roster movement scenarios', group: 'League' },
    { id: 'salary', label: 'Salary Cap Hub', icon: <LayoutGrid size={16} />, description: 'Contracts and cap room', group: 'League' },
    { id: 'archive', label: 'Game Archive', icon: <History size={16} />, description: 'Past game lookup', group: 'League' },
  ], []);

  const activePageLabel = useMemo(() => {
    return navItems.find(item => item.id === activePage)?.label || 'NBA Live';
  }, [activePage, navItems]);

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  };

  const mobileTabs = useMemo(() => [
    { id: 'dashboard', label: 'Scores', icon: <LayoutGrid size={18} /> },
    { id: 'players', label: 'Players', icon: <BarChart2 size={18} /> },
    { id: 'standings', label: 'Standings', icon: <ListOrdered size={18} /> },
    { id: 'leaderboard', label: 'Leaders', icon: <Trophy size={18} /> },
    { id: 'more', label: 'More', icon: <Menu size={18} /> },
  ], []);

  const tickerGames = games.filter(game => game.status !== 'scheduled').slice(0, 12);
  const ticker = tickerGames.length
    ? tickerGames.map(game => `${game.away_team_abbreviation || 'AWY'} ${game.away_score} — ${game.home_score} ${game.home_team_abbreviation || 'HME'} · ${game.status === 'live' ? (game.time_remaining || `Q${game.quarter}`) : 'Final'}`).join('     ')
    : 'NBA Live Intelligence · scores, standings, player analysis';

  const needle = query.trim().toLowerCase();

  return (
    <LayoutContext.Provider value={{ collapsed: false }}>
      <div className="relative min-h-screen bg-gray-950 font-sans text-white">
        <Court />
        <i className="hi-orb hi-orb-a" />
        <i className="hi-orb hi-orb-b" />
        <div className="hi-grain" />

        <aside className={`fixed bottom-0 left-0 top-0 z-50 flex w-64 flex-col overflow-y-auto border-r border-gray-800 bg-gray-900 px-3.5 pb-7 pt-[max(18px,env(safe-area-inset-top))] transition-transform duration-300 ${menuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex items-center justify-between px-2.5 pb-3">
            <Brand />
            <button className="grid h-9 w-9 place-items-center rounded-full border border-gray-800 text-white md:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu">
              <X size={16} />
            </button>
          </div>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Jump to a section…"
            aria-label="Search sections"
            className="mb-2 w-full border border-gray-800 bg-gray-850 px-3 py-2.5 text-[13px] font-medium text-white outline-none placeholder:text-gray-500 focus:border-orange-500"
          />
          <nav className="flex flex-col gap-0.5">
            {(['Live', 'Analysis', 'League'] as const).map(group => {
              const groupItems = navItems.filter(item => item.group === group && item.label.toLowerCase().includes(needle));
              if (!groupItems.length) return null;
              return (
                <div key={group}>
                  <h4 className="mb-1.5 ml-2.5 mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-gray-500">{group}</h4>
                  {groupItems.map(item => {
                    const isActive = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavigate(item.id)}
                        className={`flex min-h-0 w-full items-center gap-3 border-l-[3px] px-3 py-2.5 text-left text-[13.5px] font-medium transition ${
                          isActive
                            ? 'border-orange-500 bg-orange-500/15 text-orange-500'
                            : 'border-transparent text-gray-500 hover:translate-x-0.5 hover:bg-gray-850 hover:text-white'
                        }`}
                      >
                        <span className={isActive ? 'text-orange-500' : 'text-gray-500'}>{item.icon}</span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.id === 'dashboard' && liveCount > 0 && (
                          <i className="ml-auto rounded-full bg-orange-500 px-2 py-0.5 font-mono text-[11px] font-bold not-italic text-[#0a0a0a]">{liveCount}</i>
                        )}
                        {item.id === 'dreamteam' && (
                          <i className="ml-auto rounded-full bg-orange-500 px-2 py-0.5 font-mono text-[11px] font-bold not-italic text-[#0a0a0a]">New</i>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
          <div className="mt-6 flex flex-col gap-1.5 border border-gray-800 bg-gray-850 p-3.5">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-green-500">
              <b className="hi-live-dot !bg-green-500" />
              {liveCount > 0 ? `${liveCount} live` : 'Sync · ready'}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-gray-500">NBA Live Intelligence</span>
            <div className="mt-2 flex gap-2">
              {ACCENTS.map((pair, index) => (
                <button
                  key={index}
                  aria-label={`Accent colour ${index + 1}`}
                  onClick={() => setAccent(index)}
                  className={`h-6 w-6 min-h-0 min-w-0 rounded-full border-2 ${accent === index ? 'border-white' : 'border-gray-800'}`}
                  style={{
                    background: pair
                      ? `linear-gradient(135deg, rgb(${pair[0]}) 50%, rgb(${pair[1]}) 50%)`
                      : 'linear-gradient(135deg, #ff5a1f 50%, #c6ff3d 50%)',
                  }}
                />
              ))}
            </div>
          </div>
        </aside>

        {menuOpen && <button className="fixed inset-0 z-40 bg-black/40 md:hidden" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

        <div className="relative z-[1] md:pl-64">
          <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/85 backdrop-blur-md">
            {tickerGames.length > 0 && (
              <div className="hi-ticker overflow-hidden whitespace-nowrap bg-orange-500 font-mono text-[12px] uppercase tracking-[0.06em] text-[#0a0a0a]">
                <div className="hi-tick">
                  <span className="px-6">{ticker}</span>
                  <span className="px-6">{ticker}</span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 px-4 py-3 md:justify-end">
              <button className="grid h-9 w-9 min-h-0 min-w-0 place-items-center rounded-full border border-gray-800 text-white md:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
                <Menu size={16} />
              </button>
              <div className="mr-auto md:hidden">
                <Brand />
              </div>
              <div className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-gray-500 md:block">{activePageLabel}</div>
              <button
                onClick={toggleTheme}
                className="grid h-9 w-9 min-h-0 min-w-0 place-items-center rounded-full border border-gray-800 text-[17px] text-white transition hover:rotate-12 hover:border-orange-500"
                aria-label="Toggle light or dark theme"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
            <div className="h-0.5 w-full bg-transparent">
              <div className="h-0.5 bg-gradient-to-r from-orange-500 to-green-500" style={{ width: `${progress}%` }} />
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1100px] px-4 py-6 pb-28 md:px-6 md:pb-10 xl:max-w-[1280px]">
            {children}
          </main>

          <footer className="mx-auto flex max-w-[1100px] flex-wrap justify-between gap-2 border-t border-gray-800 px-5 py-6 pb-24 font-mono text-[12px] uppercase tracking-[0.06em] text-gray-500 md:pb-8 xl:max-w-[1280px]">
            <span>NBA Live Intelligence</span>
            <span>Scores · standings · analysis</span>
          </footer>
        </div>

        <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-gray-800 bg-gray-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
          {mobileTabs.map(tab => {
            const isMore = tab.id === 'more';
            const isActive = isMore ? menuOpen : activePage === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (isMore) setMenuOpen(open => !open);
                  else handleNavigate(tab.id);
                }}
                className={`flex min-h-0 min-w-0 flex-1 flex-col items-center gap-0.5 py-2 font-mono text-[10px] uppercase tracking-[0.06em] ${isActive ? 'text-orange-500' : 'text-gray-500'}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>

        {showTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-20 right-4 z-30 grid h-10 w-10 min-h-0 min-w-0 place-items-center rounded-full border border-gray-800 bg-gray-900 text-white md:bottom-6 md:right-6"
            aria-label="Back to top"
          >
            ↑
          </button>
        )}
      </div>
    </LayoutContext.Provider>
  );
}
