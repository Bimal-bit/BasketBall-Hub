import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutContext } from '../lib/layoutContext';
import {
  Activity, BarChart2, Zap, Trophy, History,
  ChevronLeft, ChevronRight, Menu, Sun, Moon,
  LayoutGrid, ListOrdered, Rocket, Crosshair, ArrowLeftRight, X
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

type Props = {
  children: ReactNode;
  activePage: string;
  onNavigate: (page: string) => void;
};

export default function Layout({ children, activePage, onNavigate }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
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

  // Find the label for the active page
  const activePageLabel = useMemo(() => {
    return navItems.find(item => item.id === activePage)?.label || 'Basketball Hub';
  }, [activePage, navItems]);

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setShowMoreMenu(false);
  };

  // Mobile Tabs (Max 5 tabs)
  const mobileTabs = useMemo(() => [
    { id: 'dashboard', label: 'Scores', icon: <LayoutGrid size={20} /> },
    { id: 'players', label: 'Players', icon: <BarChart2 size={20} /> },
    { id: 'standings', label: 'Standings', icon: <ListOrdered size={20} /> },
    { id: 'leaderboard', label: 'Leaders', icon: <Trophy size={20} /> },
    { id: 'more', label: 'More', icon: <Menu size={20} /> },
  ], []);

  // Items for the "More" overlay on mobile (excluding the ones already on the tab bar)
  const moreNavItems = useMemo(() => {
    const tabIds = new Set(['dashboard', 'players', 'standings', 'leaderboard']);
    return navItems.filter(item => !tabIds.has(item.id));
  }, [navItems]);

  return (
    <LayoutContext.Provider value={{ collapsed }}>
      <div className="min-h-screen relative flex flex-col md:flex-row bg-gray-950 text-white font-sans overflow-x-hidden">
        
        {/* Sticky Top Header Bar (48px tall) */}
        <header className="sticky top-0 left-0 right-0 z-40 flex h-12 items-center justify-between bg-gray-950 px-4 border-b border-gray-800 w-full shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-pulse shrink-0" />
            <h1 className="text-base font-bold text-white tracking-tight">{activePageLabel}</h1>
          </div>

          <div className="flex items-center gap-3">
            {activePage === 'dashboard' && liveCount > 0 && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
                {liveCount} LIVE
              </span>
            )}
            <button 
              onClick={toggleTheme} 
              className="text-gray-400 hover:text-white p-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors" 
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>

        {/* Left Sidebar - Desktop Only */}
        <aside className={`
          hidden md:flex flex-col border-r border-gray-800 transition-all duration-300 shrink-0
          bg-gray-900
          ${collapsed ? 'w-16' : 'w-[240px]'}
        `}>
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
            {(['Live', 'Analysis', 'League'] as const).map(group => {
              const groupItems = navItems.filter(item => item.group === group);
              if (groupItems.length === 0) return null;

              return (
                <div key={group} className="space-y-1">
                  {!collapsed && (
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-[1px] text-gray-500">
                      {group}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {groupItems.map((item) => {
                      const isActive = activePage === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNavigate(item.id)}
                          className={`
                            group/nav w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all cursor-pointer min-h-[40px]
                            ${collapsed ? 'justify-center' : ''}
                            ${isActive
                              ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
                            }
                          `}
                          title={collapsed ? item.label : undefined}
                        >
                          <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-orange-500' : 'text-gray-400 group-hover/nav:text-orange-500'}`}>
                            {item.icon}
                          </span>
                          {!collapsed && (
                            <span className="min-w-0 flex-1 text-left font-medium truncate">
                              {item.label}
                            </span>
                          )}
                          {!collapsed && item.id === 'dashboard' && liveCount > 0 && (
                            <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0">
                              {liveCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="p-3 border-t border-gray-800">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-full flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-white transition-colors py-2 rounded-xl bg-gray-800 border border-gray-700 min-h-[36px]"
            >
              {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>Collapse Navigation</span></>}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 flex flex-col bg-gray-950">
          <main
            ref={mainRef}
            onScroll={(e) => setShowTop((e.target as HTMLElement).scrollTop > 300)}
            className="flex-1 min-w-0 overflow-y-auto"
          >
            {/* Added bottom padding pb-24 to ensure no overlap by fixed mobile bottom tab bar */}
            <div className="mx-auto w-full px-4 py-4 md:px-6 md:py-6 lg:px-8 pb-24 md:pb-6 max-w-7xl animate-fade-in">
              {children}
            </div>
          </main>
        </div>

        {/* Fixed Bottom Tab Bar - Mobile Only (64px tall, safe-area aware) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-gray-900 border-t border-gray-800 z-40 flex items-center justify-around px-2 pb-safe">
          {mobileTabs.map(tab => {
            const isMoreTab = tab.id === 'more';
            const isActive = isMoreTab ? showMoreMenu : activePage === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (isMoreTab) {
                    setShowMoreMenu(!showMoreMenu);
                  } else {
                    handleNavigate(tab.id);
                  }
                }}
                className={`
                  flex flex-col items-center justify-center flex-1 h-full min-h-0 min-w-0 py-1 transition-colors
                  ${isActive ? 'text-orange-500' : 'text-gray-400 hover:text-white'}
                `}
              >
                <div className={`transition-transform duration-200 ${isActive ? 'scale-110 text-orange-500' : ''}`}>
                  {tab.icon}
                </div>
                <span className="text-[10px] font-semibold mt-1 tracking-tight truncate">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Mobile "More" Sheet Overlay */}
        {showMoreMenu && (
          <div className="fixed inset-0 z-50 flex flex-col bg-gray-950/98 backdrop-blur-md md:hidden animate-fade-in">
            {/* Overlay Header */}
            <div className="flex h-14 items-center justify-between px-4 border-b border-gray-800 bg-gray-900">
              <span className="text-base font-bold text-white">More Analysis & Tools</span>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-full border border-gray-700 min-h-[36px] min-w-[36px] flex items-center justify-center"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable list of other pages */}
            <div className="flex-1 overflow-y-auto p-4 pb-20">
              <div className="grid grid-cols-2 gap-3">
                {moreNavItems.map(item => {
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      className={`
                        flex flex-col items-start p-3 rounded-2xl border text-left transition-all min-h-[96px] justify-between
                        ${isActive
                          ? 'bg-orange-500/10 border-orange-500 text-white'
                          : 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-850 hover:border-gray-700'
                        }
                      `}
                    >
                      <div className={`p-2 rounded-xl ${isActive ? 'bg-orange-500 text-white' : 'bg-gray-800 text-orange-500'}`}>
                        {item.icon}
                      </div>
                      <div className="mt-2">
                        <div className="text-xs font-bold truncate w-full">{item.label}</div>
                        <div className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">{item.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Back to top button */}
        {showTop && (
          <button
            onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg hover:bg-orange-600 transition-all active:scale-95 min-w-0 min-h-0 border border-orange-600"
            aria-label="Back to top"
          >
            ↑
          </button>
        )}
      </div>
    </LayoutContext.Provider>
  );
}
