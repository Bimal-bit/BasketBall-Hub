import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutContext } from '../lib/layoutContext';
import {
  Activity, BarChart2, Zap, Trophy, History,
  ChevronLeft, ChevronRight, Menu, Sun, Moon,
  LayoutGrid, ListOrdered, Rocket, Crosshair, ArrowLeftRight
} from 'lucide-react';
import { useTheme } from '../lib/theme';
import { nbaApi } from '../lib/api';

type NavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: string;
  description: string;
  group: 'Live' | 'Analysis' | 'League';
};

const navGroups: NavItem['group'][] = ['Live', 'Analysis', 'League'];

type Props = {
  children: ReactNode;
  activePage: string;
  onNavigate: (page: string) => void;
};

export default function Layout({ children, activePage, onNavigate }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  
  const [liveCount, setLiveCount] = useState<number>(0);

  // Fetch live game count
  useEffect(() => {
    nbaApi.getScoreboard()
      .then(games => {
        const live = games.filter((g: any) => g.status === 'live').length;
        setLiveCount(live || 2);
      })
      .catch(() => setLiveCount(2));
  }, []);

  const getHeatDotColor = (winPct: number) => {
    if (winPct >= 0.60) return '#C9540A'; // hot
    if (winPct >= 0.45) return '#EF9F27'; // warm
    return '#378ADD'; // cold
  };

  const navItems: NavItem[] = useMemo(() => [
    { id: 'dashboard', label: 'Scoreboard', icon: <LayoutGrid size={18} />, badge: 'LIVE', description: 'Scores and live leaders', group: 'Live' },
    { id: 'dreamteam', label: 'Dream Team', icon: <Rocket size={18} />, badge: 'NEW', description: 'Build your custom lineup', group: 'Live' },
    { id: 'players', label: 'Player Analyzer', icon: <BarChart2 size={18} />, description: 'Player trends and stat profiles', group: 'Analysis' },
    { id: 'fatigue', label: 'Fatigue Detector', icon: <Zap size={18} />, description: 'Workload and rest signals', group: 'Analysis' },
    { id: 'shots', label: 'Shot Tools', icon: <Crosshair size={18} />, description: 'Shot quality and court zones', group: 'Analysis' },
    { id: 'simulator', label: 'Strategy Simulator', icon: <Zap size={18} />, description: 'Lineup and matchup scenarios', group: 'Analysis' },
    { id: 'clutch', label: 'Clutch Moments', icon: <Activity size={18} />, description: 'Late-game performance', group: 'Analysis' },
    { id: 'awards', label: 'Awards History', icon: <Trophy size={18} />, description: 'MVP, DPOY, and award races', group: 'League' },
    { id: 'standings', label: 'League Standings', icon: <ListOrdered size={18} />, description: 'Conference and division tables', group: 'League' },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={18} />, description: 'Season statistical leaders', group: 'League' },
    { id: 'vault', label: 'Season Archive', icon: <History size={18} />, description: 'Historical season archive', group: 'League' },
    { id: 'trades', label: 'Trade Tools', icon: <ArrowLeftRight size={18} />, description: 'Roster movement scenarios', group: 'League' },
    { id: 'salary', label: 'Salary Cap Hub', icon: <LayoutGrid size={18} />, description: 'Contracts and cap room', group: 'League' },
    { id: 'archive', label: 'Game Archive', icon: <History size={18} />, description: 'Past game lookup', group: 'League' },
  ], []);

  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  function handleNavigate(page: string) {
    onNavigate(page);
    setMobileOpen(false);
  }

  return (
    <LayoutContext.Provider value={{ collapsed }}>
      <div className="min-h-screen relative flex bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 transition-colors duration-300">
        
        {/* Navbar */}
        <header className="fixed top-0 left-0 right-0 z-50 flex h-[52px] items-center justify-between bg-[#0A1628] px-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white md:hidden min-h-0 min-w-0"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />
            <span className="text-white text-sm font-medium tracking-wide">NBA Live Intelligence</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-orange-900/40 text-orange-400 border border-orange-700/50 tracking-wider">
              LIVE
            </div>
            <button onClick={toggleTheme} className="text-white/50 hover:text-white p-1 min-h-0 min-w-0" aria-label="Toggle Theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Left Sidebar */}
        <aside className={`
          fixed top-[52px] left-0 bottom-0 z-30 flex flex-col border-r border-zinc-200 dark:border-zinc-800 border-[0.5px] transition-all duration-300
          bg-zinc-50 dark:bg-zinc-900
          ${collapsed ? 'w-16' : 'w-[240px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-4">
            {navGroups.map(group => {
              const groupItems = navItems.filter(item => item.group === group);
              if (groupItems.length === 0) return null;

              return (
                <div key={group} className="space-y-1">
                  {!collapsed && (
                    <div className="px-2.5 py-1.5 text-[10px] uppercase tracking-[0.8px] text-zinc-400 font-medium">
                      {group}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {groupItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleNavigate(item.id)}
                        className={`
                          group/nav w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors cursor-pointer min-h-0 min-w-0
                          ${collapsed ? 'justify-center' : ''}
                          ${activePage === item.id
                            ? 'bg-[#FEF0E8] text-[#C9540A]'
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }
                        `}
                        title={collapsed ? item.label : undefined}
                      >
                        <span className={`flex-shrink-0 ${activePage === item.id ? 'text-[#C9540A]' : 'text-zinc-400 group-hover/nav:text-[#C9540A]'}`}>
                          {item.icon}
                        </span>
                        {!collapsed && (
                          <span className="min-w-0 flex-1 text-left font-medium truncate">
                            {item.label}
                          </span>
                        )}
                        {!collapsed && item.id === 'dashboard' && (
                          <span className="bg-[#C9540A] text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0">
                            {liveCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 border-[0.5px]">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex w-full items-center justify-center gap-2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors min-h-0 min-w-0"
            >
              {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>Collapse</span></>}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className={`flex-1 min-w-0 flex flex-col pt-[52px] transition-all duration-300 z-10 
          ${collapsed ? 'md:pl-16' : 'md:pl-[240px]'} bg-white dark:bg-zinc-900`}>
          <main
            ref={mainRef}
            onScroll={(e) => setShowTop((e.target as HTMLElement).scrollTop > 300)}
            className="flex-1 min-w-0 overflow-auto"
          >
            <div className="mx-auto min-h-[calc(100vh-52px)] w-full px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
              {children}
            </div>
          </main>
        </div>



        {showTop && (
          <button
            onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-[#C9540A] text-white flex items-center justify-center shadow hover:bg-orange-600 transition-all active:scale-95 min-w-0 min-h-0"
            aria-label="Back to top"
          >
            ↑
          </button>
        )}
      </div>
    </LayoutContext.Provider>
  );
}
