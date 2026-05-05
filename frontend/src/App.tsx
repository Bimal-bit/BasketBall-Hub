import { useState, useEffect, lazy, Suspense } from 'react';
import Layout from './components/Layout';
import BasketballLoader from './components/BasketballLoader';
import { getScoreboard } from './api';

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
};

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    const handleNavigate = (e: any) => {
      if (e.detail && pages[e.detail]) {
        setActivePage(e.detail);
      }
    };
    window.addEventListener('navigate', handleNavigate);
    
    getScoreboard()
      .then(data => {
        console.log('API Response (Scoreboard):', data);
      })
      .catch(err => {
        console.error('API Error:', err);
      });

    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  const PageComponent = pages[activePage] || Dashboard;

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      <Suspense fallback={<div className="h-[80vh] flex items-center justify-center"><BasketballLoader /></div>}>
        <PageComponent />
      </Suspense>
    </Layout>
  );
}
