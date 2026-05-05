import { ReactNode, useState } from 'react';
import {
  Activity, BarChart2, Zap, Target, Shuffle, Clock,
  ChevronLeft, ChevronRight, TrendingUp, Menu, Trophy, Landmark, History, Repeat2, Sun, Moon
} from 'lucide-react';
import { useTheme } from '../lib/theme';

type NavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: string;
};

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Live Dashboard', icon: <Activity size={18} />, badge: 'LIVE' },
  { id: 'players', label: 'Player Analyzer', icon: <BarChart2 size={18} /> },
  { id: 'fatigue', label: 'Fatigue Detection', icon: <Zap size={18} /> },
  { id: 'shots', label: 'Shot Predictor', icon: <Target size={18} /> },
  { id: 'simulator', label: 'Strategy Simulator', icon: <Shuffle size={18} /> },
  { id: 'clutch', label: 'Clutch Moments', icon: <Clock size={18} /> },
  { id: 'awards', label: 'Awards History', icon: <Trophy size={18} /> },
  { id: 'standings', label: 'League Standings', icon: <BarChart2 size={18} /> },
  { id: 'leaderboard', label: 'Leaderboard', icon: <TrendingUp size={18} /> },
  { id: 'vault', label: 'Season Vault', icon: <Trophy size={18} /> },
  { id: 'trades', label: 'Trade Machine', icon: <Repeat2 size={18} /> },
  { id: 'salary', label: 'Salary Cap Hub', icon: <Landmark size={18} /> },
  { id: 'archive', label: 'Game Archive', icon: <History size={18} /> },
];

type Props = {
  children: ReactNode;
  activePage: string;
  onNavigate: (page: string) => void;
};

export default function Layout({ children, activePage, onNavigate }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

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
            <img src="/assets/images/ideJVe-SgJ_logos.svg" className="h-full w-auto object-contain filter group-hover:brightness-125 transition-all" alt="Logo" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <div className="text-base font-semibold leading-none text-[var(--text-main)] uppercase">NBA Live</div>
              <div className="text-[10px] font-medium text-[var(--accent)] uppercase tracking-[0.18em] mt-1.5">Intelligence</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-sm rounded-2xl transition-all duration-200 ease-out
                ${collapsed ? 'justify-center' : ''}
                ${activePage === item.id
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-sm ring-1 ring-orange-500/20'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-muted)]'
                }
              `}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <span className="flex-1 text-left">{item.label}</span>
              )}
              {!collapsed && item.badge && (
                <span className="text-[10px] font-semibold tracking-wide uppercase bg-red-500 text-white px-2 py-1 rounded-full shadow-sm">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
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
      <div className={`flex-1 flex flex-col transition-all duration-500 z-10 ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-10 backdrop-blur-xl border-b px-4 lg:px-6 py-3 flex items-center justify-between transition-all duration-300 bg-[var(--surface-strong)]/85 border-[var(--border-main)] shadow-slate-950/10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-[var(--text-main)]">
                {navItems.find(n => n.id === activePage)?.label}
              </h1>
              <p className="text-xs text-gray-400">2025-2026 Season • Playoffs</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Live
            </div>
            <button onClick={toggleTheme} className="relative p-2 rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-muted)]" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="min-h-[calc(100vh-88px)] px-4 py-6 sm:px-6 lg:px-8 xl:px-10 transition-all duration-500 animate-fade-in-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
