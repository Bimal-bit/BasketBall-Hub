import { Component, useState, useEffect, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { checkBackendHealth } from './lib/api';
import Layout from './components/Layout';
import BasketballLoader from './components/BasketballLoader';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const PlayerAnalyzer = lazy(() => import('./pages/PlayerAnalyzer'));
const FatigueDetection = lazy(() => import('./pages/FatigueDetection'));
const ShotPredictor = lazy(() => import('./pages/ShotPredictor'));
const StrategySimulator = lazy(() => import('./pages/StrategySimulator'));
const AICommentary = lazy(() => import('./pages/AICommentary'));
const ClutchMoments = lazy(() => import('./pages/ClutchMoments'));
const Awards = lazy(() => import('./pages/Awards'));
const Standings = lazy(() => import('./pages/Standings'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const SeasonVault = lazy(() => import('./pages/SeasonVault'));
const TradeMachine = lazy(() => import('./pages/TradeMachine'));
const SalaryCapHub = lazy(() => import('./pages/SalaryCapHub'));
const HistoricalGameArchive = lazy(() => import('./pages/HistoricalGameArchive'));
const DreamTeam = lazy(() => import('./pages/DreamTeam'));

const pages: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  players: PlayerAnalyzer,
  fatigue: FatigueDetection,
  shots: ShotPredictor,
  simulator: StrategySimulator,
  commentary: AICommentary,
  clutch: ClutchMoments,
  awards: Awards,
  standings: Standings,
  leaderboard: Leaderboard,
  vault: SeasonVault,
  trades: TradeMachine,
  salary: SalaryCapHub,
  archive: HistoricalGameArchive,
  dreamteam: DreamTeam,
};

const pageTitles: Record<string, string> = {
  dashboard: 'Live Dashboard',
  players: 'Player Analyzer',
  fatigue: 'Fatigue Detection',
  shots: 'Shot Predictor',
  simulator: 'Strategy Simulator',
  commentary: 'AI Commentary',
  clutch: 'Clutch Moments',
  awards: 'Awards History',
  standings: 'League Standings',
  leaderboard: 'Leaderboard',
  vault: 'Season Vault',
  trades: 'Trade Machine',
  salary: 'Salary Cap Hub',
  archive: 'Game Archive',
  dreamteam: 'Dream Team',
};

class SectionErrorBoundary extends Component<
  { children: ReactNode; pageName: string; onRetry: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`The ${this.props.pageName} section failed to render:`, error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="mx-auto my-12 max-w-xl rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
          <h2 className="text-lg font-bold text-white">{this.props.pageName} could not be displayed</h2>
          <p className="mt-2 text-sm text-gray-400">The rest of the site is still available. Retry this section or choose another section from the menu.</p>
          <button
            onClick={this.props.onRetry}
            className="mt-5 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-500"
          >
            Retry section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [pageAttempt, setPageAttempt] = useState(0);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const page = (event as CustomEvent<string>).detail;
      if (page && pages[page]) {
        setActivePage(page);
        setPageAttempt(0);
      }
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  useEffect(() => {
    document.title = `${pageTitles[activePage] || 'NBA Live Intelligence'} | NBA Live Intelligence`;
  }, [activePage]);

  useEffect(() => {
    let mounted = true;
    const checkBackend = async () => {
      try {
        const ok = await checkBackendHealth();
        if (mounted) setBackendOk(ok);
      } catch (error) {
        console.warn('Backend health check failed:', error);
        if (mounted) setBackendOk(false);
      }
    };
    
    // Initial check after a short delay to avoid immediate 429 on load
    const initialTimeout = setTimeout(checkBackend, 1000);
    
    // Periodic check every 2 minutes (reduced from 120s)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') checkBackend();
    }, 120_000);
    
    return () => {
      mounted = false;
      clearTimeout(initialTimeout);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const prepareImages = (root: ParentNode) => {
      root.querySelectorAll('img').forEach(image => {
        image.loading = 'lazy';
        image.decoding = 'async';
      });
    };

    prepareImages(document);
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLImageElement) {
            node.loading = 'lazy';
            node.decoding = 'async';
          } else if (node instanceof HTMLElement) {
            prepareImages(node);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const PageComponent = pages[activePage] || Dashboard;

  return (
    <Layout activePage={activePage} onNavigate={page => {
      setActivePage(page);
      setPageAttempt(0);
    }}>
      {backendOk === false && (
        <div role="alert" className="p-3 bg-red-700 text-white text-sm text-center">
          {import.meta.env.DEV
            ? 'The NBA data service is not responding. Start the local backend or set VITE_API_BASE_URL to a reachable API.'
            : 'The NBA data service is temporarily unavailable. Please try again shortly.'}
        </div>
      )}
      <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><BasketballLoader /></div>}>
        <SectionErrorBoundary
          key={`${activePage}:${pageAttempt}`}
          pageName={pageTitles[activePage] || 'This section'}
          onRetry={() => setPageAttempt(attempt => attempt + 1)}
        >
          <PageComponent />
        </SectionErrorBoundary>
      </Suspense>
    </Layout>
  );
}
