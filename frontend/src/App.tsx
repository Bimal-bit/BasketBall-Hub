import { useState, useEffect, lazy, Suspense } from 'react';
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
const InsightsLab = lazy(() => import('./pages/InsightsLab'));

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
  insights: InsightsLab,
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
  insights: 'Insights Lab',
};

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const page = (event as CustomEvent<string>).detail;
      if (page && pages[page]) {
        setActivePage(page);
      }
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  useEffect(() => {
    document.title = `${pageTitles[activePage] || 'NBA Live Intelligence'} | NBA Live Intelligence`;
  }, [activePage]);

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
    <Layout activePage={activePage} onNavigate={setActivePage}>
      <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><BasketballLoader /></div>}>
        <PageComponent />
      </Suspense>
    </Layout>
  );
}
