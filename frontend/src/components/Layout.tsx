import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Activity, BarChart2, Zap, Target, Shuffle, Clock,
  ChevronLeft, ChevronRight, TrendingUp, Menu, Trophy, Landmark, History, Repeat2, Sun, Moon, Search, X, BrainCircuit
} from 'lucide-react';
import { useTheme } from '../lib/theme';

type NavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: string;
  description: string;
  group: 'Live' | 'Analysis' | 'League';
};

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Live Dashboard', icon: <Activity size={18} />, badge: 'LIVE', description: 'Scores, leaders, and game details', group: 'Live' },
  { id: 'insights', label: 'Insights Lab', icon: <BrainCircuit size={18} />, badge: 'NEW', description: 'Compare, predict, recap, and watch', group: 'Live' },
  { id: 'players', label: 'Player Analyzer', icon: <BarChart2 size={18} />, description: 'Player trends and stat profiles', group: 'Analysis' },
  { id: 'fatigue', label: 'Fatigue Detection', icon: <Zap size={18} />, description: 'Workload and rest signals', group: 'Analysis' },
  { id: 'shots', label: 'Shot Predictor', icon: <Target size={18} />, description: 'Shot quality and court zones', group: 'Analysis' },
  { id: 'simulator', label: 'Strategy Simulator', icon: <Shuffle size={18} />, description: 'Lineup and matchup scenarios', group: 'Analysis' },
  { id: 'clutch', label: 'Clutch Moments', icon: <Clock size={18} />, description: 'Late-game performance', group: 'Analysis' },
  { id: 'awards', label: 'Awards History', icon: <Trophy size={18} />, description: 'MVP, DPOY, and award races', group: 'League' },
  { id: 'standings', label: 'League Standings', icon: <BarChart2 size={18} />, description: 'Conference and division tables', group: 'League' },
  { id: 'leaderboard', label: 'Leaderboard', icon: <TrendingUp size={18} />, description: 'Season statistical leaders', group: 'League' },
  { id: 'vault', label: 'Season Vault', icon: <Trophy size={18} />, description: 'Historical season archive', group: 'League' },
  { id: 'trades', label: 'Trade Machine', icon: <Repeat2 size={18} />, description: 'Roster movement scenarios', group: 'League' },
  { id: 'salary', label: 'Salary Cap Hub', icon: <Landmark size={18} />, description: 'Contracts and cap room', group: 'League' },
  { id: 'archive', label: 'Game Archive', icon: <History size={18} />, description: 'Past game lookup', group: 'League' },
];

const navGroups: NavItem['group'][] = ['Live', 'Analysis', 'League'];

type Props = {
  children: ReactNode;
  activePage: string;
  onNavigate: (page: string) => void;
};

export default function Layout({ children, activePage, onNavigate }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navQuery, setNavQuery] = useState('');
  const { theme, toggleTheme } = useTheme();
  const activeItem = navItems.find(n => n.id === activePage) ?? navItems[0];

  const filteredNav = useMemo(() => {
    const query = navQuery.trim().toLowerCase();
    if (!query) return navItems;

    return navItems.filter(item => {
      const searchable = `${item.label} ${item.description} ${item.group}`.toLowerCase();
      return searchable.includes(query);
    });
  }, [navQuery]);

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
    setNavQuery('');
  }

  return (
    <div className="min-h-screen relative flex bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-300">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[var(--bg-main)]" />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full z-30 flex flex-col border-r transition-all duration-500 ease-out backdrop-blur-xl shadow-2xl/10
        bg-[var(--bg-side)]/95 border-[var(--border-main)]
        ${collapsed ? 'w-16' : 'w-64'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className={`flex items-center gap-4 px-4 py-6 border-b border-[var(--border-main)] ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-12 rounded-lg bg-[var(--surface-muted)] p-1.5 flex items-center justify-center flex-shrink-0 border border-[var(--border-main)] group shadow-inner">
            <img src="/assets/images/ideJVe-SgJ_logos.svg" loading="lazy" className="h-full w-auto max-w-full object-contain filter group-hover:brightness-125 transition-all" alt="NBA Live Intelligence logo" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <div className="text-base font-semibold leading-none text-[var(--text-main)] uppercase">NBA Live</div>
              <div className="text-[10px] font-medium text-[var(--accent)] uppercase tracking-[0.18em] mt-1.5">Intelligence</div>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="px-4 pt-4">
            <label className="relative block">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={navQuery}
                onChange={(event) => setNavQuery(event.target.value)}
                className="h-10 w-full rounded-xl border border-[var(--border-main)] bg-[var(--surface-muted)] pl-9 pr-9 text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/20"
                placeholder="Search sections"
                type="search"
              />
              {navQuery && (
                <button
                  type="button"
                  onClick={() => setNavQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-main)]"
                  aria-label="Clear navigation search"
                >
                  <X size={14} />
                </button>
              )}
            </label>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {navGroups.map(group => {
            const groupItems = filteredNav.filter(item => item.group === group);
            if (groupItems.length === 0) return null;

            return (
              <div key={group} className="mb-5 last:mb-0">
                {!collapsed && (
                  <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                    {group}
                  </div>
                )}
                <div className="space-y-1">
                  {groupItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      className={`
                        group/nav w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all duration-200 ease-out
                        ${collapsed ? 'justify-center' : ''}
                        ${activePage === item.id
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-sm ring-1 ring-orange-500/20'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-muted)]'
                        }
                      `}
                      title={collapsed ? item.label : undefined}
                      aria-current={activePage === item.id ? 'page' : undefined}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      {!collapsed && (
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate font-medium">{item.label}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">
                            {item.description}
                          </span>
                        </span>
                      )}
                      {!collapsed && item.badge && (
                        <span className="text-[10px] font-semibold tracking-wide uppercase bg-red-500 text-white px-2 py-1 rounded-full shadow-sm">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {!collapsed && filteredNav.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
              No sections found.
            </div>
          )}
        </nav>

        {/* Collapse toggle */}
        <div className="p-4 border-t border-[var(--border-main)]">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-full items-center justify-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 min-w-0 max-w-full flex flex-col overflow-x-hidden transition-all duration-500 z-10 ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-[var(--surface-strong)]/85 px-3 backdrop-blur-xl transition-all duration-300 border-[var(--border-main)] shadow-slate-950/10 sm:px-4 lg:h-auto lg:px-6 lg:py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-main)] lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-[var(--text-main)]">
                {activeItem.label}
              </h1>
              <p className="hidden truncate text-xs text-gray-400 min-[360px]:block">{activeItem.description}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-[var(--border-main)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs text-[var(--text-muted)] sm:flex">
              <span className="font-medium text-[var(--text-main)]">2025-2026</span>
              <span>Playoffs</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-green-400" aria-label="Live data status">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Live
            </div>
            <button onClick={toggleTheme} className="relative p-2 rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-muted)]" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 max-w-full overflow-auto overflow-x-hidden">
          <div className="mx-auto min-h-[calc(100vh-56px)] w-full max-w-7xl min-w-0 px-4 py-4 transition-all duration-500 animate-fade-in-up sm:px-6 sm:py-5 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
