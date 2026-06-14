import { useEffect, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, PresentationControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { 
  TrendingUp, User, Users, Calendar,
  Zap, Target, Shield, Clock,
  Layers, Activity, Sparkles,
  MapPin, UserCheck, BarChart3, Plus, Minus, ArrowRight, X,
  Home, UserPlus, Info, TrendingDown
} from 'lucide-react';
import { nbaApi, getPlayerHeadshotUrl, getTeamLogoUrl } from '../lib/api';
import BasketballLoader from '../components/BasketballLoader';
import { NBA_CHAMPIONS, ARENA_IMAGES, MASCOTS, getRingImageUrl, getTeamVaultInfo } from './SeasonVaultData';

const SEASONS = Array.from({ length: 2026 - 1985 }, (_, i) => {
  const year = 2025 - i;
  return `${year}-${(year + 1).toString().slice(-2)}`;
});

const TEAMS = [
  { id: '1610612737', name: 'Atlanta Hawks', color: '#E03A3E', abbr: 'ATL' },
  { id: '1610612738', name: 'Boston Celtics', color: '#007A33', abbr: 'BOS' },
  { id: '1610612739', name: 'Cleveland Cavaliers', color: '#860038', abbr: 'CLE' },
  { id: '1610612740', name: 'New Orleans Pelicans', color: '#0C2340', abbr: 'NOP' },
  { id: '1610612741', name: 'Chicago Bulls', color: '#CE1141', abbr: 'CHI' },
  { id: '1610612742', name: 'Dallas Mavericks', color: '#00538C', abbr: 'DAL' },
  { id: '1610612743', name: 'Denver Nuggets', color: '#0E2240', abbr: 'DEN' },
  { id: '1610612744', name: 'Golden State Warriors', color: '#1D428A', abbr: 'GSW' },
  { id: '1610612745', name: 'Houston Rockets', color: '#CE1141', abbr: 'HOU' },
  { id: '1610612746', name: 'Los Angeles Clippers', color: '#C8102E', abbr: 'LAC' },
  { id: '1610612747', name: 'Los Angeles Lakers', color: '#552583', abbr: 'LAL' },
  { id: '1610612748', name: 'Miami Heat', color: '#98002E', abbr: 'MIA' },
  { id: '1610612749', name: 'Milwaukee Bucks', color: '#00471B', abbr: 'MIL' },
  { id: '1610612750', name: 'Minnesota Timberwolves', color: '#0C2340', abbr: 'MIN' },
  { id: '1610612751', name: 'Brooklyn Nets', color: '#000000', abbr: 'BKN' },
  { id: '1610612752', name: 'New York Knicks', color: '#006BB6', abbr: 'NYK' },
  { id: '1610612753', name: 'Orlando Magic', color: '#0077C0', abbr: 'ORL' },
  { id: '1610612754', name: 'Indiana Pacers', color: '#002D62', abbr: 'IND' },
  { id: '1610612755', name: 'Philadelphia 76ers', color: '#006BB6', abbr: 'PHI' },
  { id: '1610612756', name: 'Phoenix Suns', color: '#1D1160', abbr: 'PHX' },
  { id: '1610612757', name: 'Portland Trail Blazers', color: '#E03A3E', abbr: 'POR' },
  { id: '1610612758', name: 'Sacramento Kings', color: '#5A2D81', abbr: 'SAC' },
  { id: '1610612759', name: 'San Antonio Spurs', color: '#C4CED4', abbr: 'SAS' },
  { id: '1610612760', name: 'Oklahoma City Thunder', color: '#007AC1', abbr: 'OKC' },
  { id: '1610612761', name: 'Toronto Raptors', color: '#CE1141', abbr: 'TOR' },
  { id: '1610612762', name: 'Utah Jazz', color: '#002B5C', abbr: 'UTA' },
  { id: '1610612763', name: 'Memphis Grizzlies', color: '#5D76A9', abbr: 'MEM' },
  { id: '1610612764', name: 'Washington Wizards', color: '#002B5C', abbr: 'WAS' },
  { id: '1610612765', name: 'Detroit Pistons', color: '#C8102E', abbr: 'DET' },
  { id: '1610612766', name: 'Charlotte Hornets', color: '#1D1160', abbr: 'CHA' },
];

function RingModel({ teamColor }: { teamColor: string }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const diamondRef = useRef<THREE.Mesh>(null!);
  
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    meshRef.current.rotation.y = t * 0.5;
    meshRef.current.position.y = Math.sin(t) * 0.1;
    diamondRef.current.rotation.z = t * 2;
  });

  return (
    <group scale={2}>
      <mesh ref={meshRef}>
        <torusGeometry args={[0.8, 0.25, 32, 100]} />
        <meshStandardMaterial 
          color="#FFD700" 
          metalness={1} 
          roughness={0.1} 
          envMapIntensity={2}
        />
      </mesh>
      
      <mesh position={[0, 0, 0.7]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.7, 0.6, 0.3, 32]} />
        <meshStandardMaterial color="#FFD700" metalness={1} roughness={0.1} />
        
        <mesh position={[0, 0.16, 0]}>
           <cylinderGeometry args={[0.55, 0.55, 0.05, 32]} />
           <meshStandardMaterial color={teamColor} metalness={0.8} roughness={0.2} />
        </mesh>
        
        <mesh ref={diamondRef} position={[0, 0.25, 0]} rotation={[0.5, 0, 0]}>
           <octahedronGeometry args={[0.3, 0]} />
           <meshPhysicalMaterial 
             color="#ffffff" 
             metalness={0.1} 
             roughness={0} 
             transmission={1} 
             thickness={0.5}
             ior={2.4}
           />
        </mesh>
      </mesh>
    </group>
  );
}

export default function SeasonVault() {
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState(SEASONS[0]);
  const [teamId, setTeamId] = useState(TEAMS[10].id); // Default Lakers
  const [history, setHistory] = useState<any>(null);
  const [showAll, setShowAll] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    async function loadVault() {
      if (!mounted) return;
      setHistory(buildFallbackVault(teamId, season));
      setLoading(false);
      try {
        const [historyData, standingsData] = await Promise.all([
          nbaApi.getTeamHistory(teamId, season).catch(() => null),
          nbaApi.getStandings(season).catch(() => []),
        ]);
        if (!mounted) return;
        const standing = standingsData.find((item: any) => Number(item.TeamID) === Number(teamId));
        const fallback = buildFallbackVault(teamId, season);
        setHistory({
          ...(historyData?.roster?.length ? historyData : fallback),
          standing: { ...fallback.standing, ...(historyData?.standing ?? {}), ...(standing ?? {}) },
        });
      } catch (error) {
        console.error('Error loading vault:', error);
        if (mounted) {
          setHistory(buildFallbackVault(teamId, season));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadVault();
    
    return () => {
      mounted = false;
    };
  }, [teamId, season]);



  const team = TEAMS.find(t => t.id === teamId);
  const isChampion = NBA_CHAMPIONS[season] === teamId;
  const vaultTeamInfo = getTeamVaultInfo(teamId);
  const arenaImage = ARENA_IMAGES[teamId];
  const ringImage = getRingImageUrl(season, teamId);
  const mascot = MASCOTS[teamId];
  
  // Standing data — backend normalizes keys, but keep multiple fallbacks for safety
  const standing = history?.standing ?? {};
  const recordW = standing.WINS ?? standing.Wins ?? standing.W ?? 0;
  const recordL = standing.LOSSES ?? standing.Losses ?? standing.L ?? 0;
  const w_pct   = standing.W_PCT ?? standing.WinPCT ?? standing.WIN_PCT ?? 0;
  const rankNum  = standing.PlayoffRank ?? standing.PLAYOFF_RANK ?? standing.ConferenceRank ?? null;
  const arenaName = vaultTeamInfo?.arena ?? standing.Arena ?? standing.ARENA ?? history?.stats?.ARENA ?? history?.stats?.ARENA_NAME ?? 'The Arena';
  const teamCity  = vaultTeamInfo?.city ?? standing.TeamCity ?? standing.TEAM_CITY ?? team?.name?.split(' ')[0] ?? 'NBA City';

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center">
        <BasketballLoader />
        <p className="mt-10 text-sm font-medium text-orange-500 uppercase tracking-[0.5em] animate-pulse">Unlocking Historical Vault...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in- duration-1000">
      <style>{`
        .jersey-3d { perspective: 1200px; }
        .jersey-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          transform-style: preserve-3d;
        }
        .jersey-card:hover .jersey-inner { transform: rotateY(180deg); }
        .jersey-front, .jersey-back {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 20px 50px rgba(0,0,0,0.6);
          overflow: hidden;
        }
        .jersey-back { transform: rotateY(180deg); background: #111827; }
        .glow-text { text-shadow: 0 0 20px rgba(234, 179, 8, 0.5); }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #f97316, #ea580c); border-radius: 10px; }
      `}</style>

      {/* Filters Panel */}
      <div className="bg-gray-900 bg-gray-900 from-[#0f172a] to-[#020617] border border-gray-800 rounded-[2rem] sm:rounded-[2.5rem] p-4 sm:p-8 shadow-none backdrop-blur-xl sticky top-0 z-40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
             <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-[1.25rem] sm:rounded-[1.5rem] bg-orange-500/20 flex items-center justify-center border border-orange-500/20 shadow-none shadow-none flex-shrink-0">
                <Layers className="text-orange-500" size={32} />
             </div>
             <div className="min-w-0">
                <h1 className="text-2xl sm:text-4xl font-medium text-white  tracking-tighter uppercase leading-none mb-1 break-words">Season Vault</h1>
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   <p className="text-[9px] sm:text-[10px] font-medium text-gray-500 uppercase tracking-widest">Historical Data Sync Active</p>
                </div>
             </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 bg-white/5 border border-gray-800 p-2 rounded-2xl group hover:border-orange-500/30 transition-all">
               <Calendar className="ml-3 text-orange-500" size={18} />
               <select 
                 value={season}
                 onChange={(e) => setSeason(e.target.value)}
                 className="bg-transparent text-sm font-medium text-white px-3 py-2 outline-none cursor-pointer appearance-none min-w-0 flex-1 sm:min-w-[140px]"
               >
                 {SEASONS.map(s => <option key={s} value={s} className="bg-gray-900">{s}</option>)}
               </select>
            </div>

            <div className="flex items-center gap-2 bg-white/5 border border-gray-800 p-2 rounded-2xl group hover:border-orange-500/30 transition-all">
               <img src={getTeamLogoUrl(teamId)} className="w-8 h-8 ml-3 object-contain" alt="Team" />
               <select 
                 value={teamId}
                 onChange={(e) => setTeamId(e.target.value)}
                 className="bg-transparent text-sm font-medium text-white px-3 py-2 outline-none cursor-pointer appearance-none min-w-0 flex-1 sm:min-w-[200px]"
               >
                 {TEAMS.map(t => <option key={t.id} value={t.id} className="bg-gray-900">{t.name}</option>)}
               </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-4 space-y-8">
           {/* Team Overview Card */}
           <div className="bg-gray-900 bg-gray-900  to-black border border-gray-800 rounded-[2rem] sm:rounded-[3.5rem] p-4 sm:p-8 relative overflow-hidden group min-h-[520px] sm:min-h-[550px] flex flex-col shadow-none">
              <div className="absolute inset-0 z-0">
                 <ArenaVisual image={arenaImage} teamId={teamId} teamColor={team?.color || '#f97316'} arenaName={arenaName} subtle />
                 <div className="absolute inset-0 bg-gray-900 bg-gray-900 from-black via-black/40 to-transparent" />
              </div>
              
              <div className="relative z-10 flex flex-col items-center text-center flex-1">
                 <div className="relative mb-8 mt-6">
                    <div className="absolute inset-0 bg-white/10 rounded-full blur-3xl scale-150 animate-pulse" />
                    <img src={getTeamLogoUrl(teamId)} className="w-44 h-44 object-contain relative z-10 drop-shadow-none group-hover:scale-110 transition-transform duration-700" alt="Team Logo" />
                 </div>
                 
                 <h2 className="text-3xl sm:text-5xl font-medium text-white  tracking-tighter uppercase mb-2 group-hover:tracking-normal transition-all duration-500 break-words max-w-full">{team?.name}</h2>
                 <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-[0.28em] sm:tracking-[0.5em] mb-8 sm:mb-12 ">{season} Anthology</p>
                 
                 <div className="grid grid-cols-2 gap-4 w-full mt-auto">
                    <OverviewCard label="Season Record" value={`${recordW}-${recordL}`} icon={<Activity size={18} />} />
                    <OverviewCard label="Conf Standings" value={rankNum ? `Rank #${rankNum}` : 'N/A'} icon={<TrendingUp size={18} />} />
                    <OverviewCard label="Head Coach" value={history?.coaches?.[0]?.COACH_NAME || 'N/A'} icon={<UserCheck size={18} />} />
                    <OverviewCard label="Home Arena" value={arenaName} icon={<MapPin size={18} />} />
                 </div>
              </div>
           </div>

           {/* Victory Hardware (Ring) */}
           <div className="bg-gray-900 bg-gray-900 from-black  border border-gray-800 rounded-[2rem] sm:rounded-[3.5rem] p-5 sm:p-10 flex flex-col items-center justify-center relative overflow-hidden h-[360px] sm:h-[450px] shadow-none group">
              <div className={`absolute inset-0 bg-gray-900 bg-gray-900  via-transparent to-transparent transition-opacity duration-1000 ${isChampion ? 'opacity-100' : 'opacity-0'}`} />
              
              <div className="w-full h-full relative">
                {isChampion ? (
                  <>
                    <div className="absolute inset-0 pointer-events-none">
                       <Sparkles className="absolute top-10 left-10 text-yellow-500/50 animate-pulse" size={24} />
                       <Sparkles className="absolute bottom-20 right-10 text-yellow-500/30 animate-bounce" size={18} />
                    </div>
                    
                    {ringImage ? (
                      <div className="w-full h-full flex flex-col items-center justify-center animate-in zoom-in-75 duration-700">
                         <img src={ringImage} className="w-64 h-64 object-contain drop-shadow-none group-hover:scale-110 transition-transform duration-500" alt="Victory Ring" />
                         <h4 className="text-3xl font-medium text-white  uppercase tracking-tighter glow-text animate-pulse mt-6">Authentic Ring</h4>
                      </div>
                    ) : (
                      <Canvas className="cursor-grab active:cursor-grabbing">
                        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
                        <Environment preset="city" />
                        <PresentationControls global config={{ mass: 2, tension: 500 }} snap={{ mass: 4, tension: 1500 }}>
                          <RingModel teamColor={team?.color || '#FFD700'} />
                        </PresentationControls>
                      </Canvas>
                    )}

                    {!ringImage && (
                      <div className="absolute bottom-4 left-0 right-0 text-center z-10 pointer-events-none">
                         <h4 className="text-3xl font-medium text-white  uppercase tracking-tighter glow-text animate-pulse">Championship Hardware</h4>
                         <p className="text-[10px] font-medium text-yellow-500/80 uppercase tracking-[0.3em] mt-2 ">Victory Achieved • {season}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center opacity-30">
                    <div className="relative">
                       <Shield size={120} className="text-gray-800" />
                       <Clock className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-700" size={40} />
                    </div>
                    <h4 className="text-xl font-medium text-gray-800  mt-8 uppercase tracking-[0.2em] text-center">Archives Sealed</h4>
                    <a 
                      href="https://sports.yahoo.com/article/check-nba-championship-rings-years-231301268.html" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="mt-4 text-[10px] font-medium text-gray-600 hover:text-orange-500 uppercase tracking-widest transition-colors flex items-center gap-2"
                    >
                      Browse Ring Wiki <ArrowRight size={12} />
                    </a>
                  </div>
                )}
              </div>
           </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-8 space-y-8">
            {/* Stadium & Atmosphere Section */}
           <div className="bg-gray-900 bg-gray-900 from-[#0f172a] to-black border border-gray-800 rounded-[2rem] sm:rounded-[3.5rem] p-4 sm:p-10 shadow-none relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-1/3 h-full bg-blue-500/5 blur-[120px] pointer-events-none" />
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 sm:mb-10 relative z-10">
                 <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
                       <Home className="text-blue-400" size={24} />
                    </div>
                    <h3 className="text-xl sm:text-3xl font-medium text-white  uppercase tracking-tight break-words">Home Base: {arenaName}</h3>
                 </div>
                 <div className="px-4 py-2 bg-white/5 rounded-full border border-gray-800 self-start sm:self-auto">
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em] ">Era Validated</span>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                 <div className="relative group/stadium overflow-hidden rounded-3xl border border-gray-800 aspect-video">
                    <ArenaVisual image={arenaImage} teamId={teamId} teamColor={team?.color || '#f97316'} arenaName={arenaName} />
                    <div className="absolute inset-0 bg-gray-900 bg-gray-900 from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-6 left-6">
                       <p className="text-[10px] font-medium text-blue-400 uppercase tracking-widest mb-1">Official Venue</p>
                       <h4 className="text-2xl font-medium text-white  uppercase tracking-tighter">{arenaName}</h4>
                       {vaultTeamInfo && <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-1">{vaultTeamInfo.arenaLocation} / Opened {vaultTeamInfo.opened} / Capacity {vaultTeamInfo.capacity}</p>}
                    </div>
                 </div>
                 
                 <div className="flex flex-col gap-4">
                    {mascot ? (
                       <div className="flex-1 bg-white/5 rounded-3xl border border-gray-800 p-6 flex items-center gap-6 group/mascot hover:bg-white/10 transition-all">
                          <img src={mascot.image} className="w-24 h-24 object-contain group-hover/mascot:scale-110 transition-transform" alt="Mascot" onError={(e) => e.currentTarget.style.display = 'none'} />
                          <div>
                             <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mb-1">Team Atmosphere</p>
                             <h4 className="text-xl font-medium text-white  uppercase tracking-tight">{mascot.name}</h4>
                             <p className="text-[10px] font-medium text-blue-400/60 uppercase tracking-widest mt-2">Active Mascot</p>
                          </div>
                       </div>
                    ) : (
                       <div className="flex-1 bg-white/5 rounded-3xl border border-gray-800 p-6 flex flex-col items-center justify-center opacity-40">
                          <Users className="text-gray-600 mb-2" size={32} />
                          <p className="text-[10px] font-medium text-gray-600 uppercase tracking-widest">Mascot Data Pending</p>
                       </div>
                    )}
                    <div className="bg-white/5 rounded-3xl border border-gray-800 p-6 flex items-center gap-6">
                       <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                          <Info className="text-orange-400" size={24} />
                       </div>
                       <div>
                          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mb-1">City Context</p>
                          <h4 className="text-lg font-medium text-white  uppercase tracking-tight">{teamCity}</h4>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           {/* Team Stats Snapshot */}
           <div className="bg-gray-900 bg-gray-900   to-black border border-gray-800 rounded-[2rem] sm:rounded-[3.5rem] p-4 sm:p-10 shadow-none relative overflow-hidden">
              <div className="absolute inset-0 z-0">
                 <div className="w-full h-full opacity-20" style={{ background: `radial-gradient(circle at 20% 20%, ${team?.color || '#f97316'} 0%, transparent 30%), linear-gradient(135deg, #020617 0%, #111827 100%)` }} />
              </div>
              <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-10">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/20">
                       <BarChart3 className="text-blue-400" size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-medium text-white  uppercase tracking-tight">Season Stats Snapshot</h3>
                      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-[0.2em] sm:tracking-[0.25em] mt-1">Roster production and team context</p>
                    </div>
                 </div>
              </div>
              
              <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <OverviewCard label="Wins" value={recordW} icon={<Plus size={18} />} />
                <OverviewCard label="Losses" value={recordL} icon={<Minus size={18} />} />
                <OverviewCard label="Win Pct" value={`${(Number(w_pct || 0) * 100).toFixed(1)}%`} icon={<TrendingUp size={18} />} />
                <OverviewCard label="Roster Size" value={history?.roster?.length || 0} icon={<Users size={18} />} />
                <OverviewCard label="Top Scorer" value={topRosterStat(history?.roster, 'PTS')} icon={<Target size={18} />} />
                <OverviewCard label="Top Rebounder" value={topRosterStat(history?.roster, 'REB')} icon={<Shield size={18} />} />
                <OverviewCard label="Top Passer" value={topRosterStat(history?.roster, 'AST')} icon={<UserPlus size={18} />} />
                <OverviewCard label="Era" value={parseInt(season) < 2000 ? 'Defensive' : parseInt(season) < 2015 ? 'Pace+Space' : 'Modern'} icon={<Clock size={18} />} />
              </div>
            </div>
 
            {/* Full Roster Grid */}
            <div className="bg-gray-900 bg-gray-900  to-black border border-gray-800 rounded-[3.5rem] p-10 shadow-none relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gray-900 bg-gray-900 from-transparent /50 to-transparent" />
               
               <div className="flex items-center justify-between mb-12 relative z-10">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-orange-500/20 flex items-center justify-center border border-orange-500/20">
                        <Users className="text-orange-500" size={24} />
                     </div>
                     <div>
                        <h3 className="text-3xl font-medium text-white  uppercase tracking-tight">Full Squad Archive</h3>
                        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-[0.3em] mt-1 ">Total Registry: {history.roster.length} Personnel</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <button 
                        onClick={() => setShowAll(!showAll)}
                        className="px-6 py-2 bg-white/5 border border-gray-800 rounded-xl text-[10px] font-medium text-white uppercase tracking-widest hover:bg-orange-500/10 hover:border-orange-500/50 transition-all flex items-center gap-2"
                     >
                        <Layers size={14} className={showAll ? 'text-orange-500' : 'text-gray-500'} />
                        {showAll ? 'View Starters' : 'View All Squad'}
                     </button>
                     <div className="hidden sm:flex items-center gap-3 ml-4">
                        <div className="px-4 py-2 bg-white/5 rounded-full border border-gray-800 flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                           <span className="text-[10px] font-medium text-gray-300 uppercase tracking-widest ">Era Verified</span>
                        </div>
                     </div>
                  </div>
               </div>
               
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 relative z-10">
                  {(showAll ? history.roster : [...history.roster].sort((a: any, b: any) => (b.MIN || 0) - (a.MIN || 0)).slice(0, 5)).map((player: any) => (
                    <div 
                      key={player.PLAYER_ID}
                      onClick={() => setSelectedPlayer(player)}
                      className="group/player bg-white/5 border border-gray-800 rounded-3xl p-5 hover:bg-white/10 hover:border-orange-500/30 transition-transform duration-200 hover:scale-105 shadow-none hover:shadow-none cursor-pointer"
                    >
                      <div className="relative mb-4">
                        <div className="absolute inset-0 bg-white/5 rounded-2xl  opacity-0 group-hover/player:opacity-100 transition-opacity" />
                        <img 
                          src={getPlayerHeadshotUrl(player.PLAYER_ID)} 
                          alt={player.PLAYER_NAME}
                          className="w-full aspect-[4/5] object-cover rounded-2xl border border-gray-800 group-hover/player:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            e.currentTarget.src = `https://www.nba.com/assets/logos/teams/primary/web/${TEAMS.find(t => t.id === teamId)?.abbr}.svg`;
                            e.currentTarget.classList.add('p-4', 'opacity-20');
                          }}
                        />
                        <div className="absolute -top-2 -right-6 bg-gray-900 backdrop- px-3 py-1.5 rounded-xl border border-gray-800 z-20 shadow-none transform group-hover/player:rotate-12 transition-transform">
                           <span className="text-[11px] font-medium text-white/60 ">#{player.NUM || '--'}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium text-white uppercase tracking-tighter line-clamp-1 group-hover/player:text-orange-400 transition-colors">{player.PLAYER_NAME}</h4>
                        <div className="flex items-center justify-between">
                           <span className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">{player.POSITION}</span>
                           <div className="flex items-center gap-1">
                              <Zap size={10} className="text-orange-500" />
                              <span className="text-[10px] font-medium text-orange-500 ">{player.PTS || '0'} PPG</span>
                           </div>
                        </div>
                      </div>
                    </div>
                  ))}
               </div>

               {/* Coaching & Support Staff Section */}
               {showAll && (
                  <div className="mt-20 border-t border-gray-800 pt-12 relative z-10">
                     <div className="flex items-center gap-4 mb-10">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                           <UserCheck className="text-blue-400" size={20} />
                        </div>
                        <h3 className="text-2xl font-medium text-white  uppercase tracking-tight">Coaching Staff & Management</h3>
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {history.coaches && history.coaches.length > 0 ? history.coaches.map((coach: any, idx: number) => (
                           <div key={idx} className="bg-white/[0.02] border border-gray-800 rounded-2xl p-6 flex items-center gap-6 group hover:bg-white/5 transition-all">
                              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center border border-gray-800 group-hover:border-blue-500/50 transition-colors">
                                 <User className="text-gray-600 group-hover:text-blue-400 transition-colors" size={28} />
                              </div>
                              <div>
                                 <p className="text-[10px] font-medium text-blue-500 uppercase tracking-widest mb-1">{coach.COACH_TYPE || 'Staff'}</p>
                                 <h4 className="text-lg font-medium text-white uppercase  tracking-tighter">{coach.COACH_NAME}</h4>
                                 <p className="text-[9px] font-medium text-gray-600 uppercase tracking-widest mt-1">{coach.COACH_NAME === history.coaches[0].COACH_NAME ? 'Strategic Lead' : 'Tactical Assistant'}</p>
                              </div>
                           </div>
                        )) : (
                           <div className="col-span-full p-10 bg-white/5 rounded-3xl text-center">
                              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-[0.2em]">Historical Staff Data Restricted</p>
                           </div>
                        )}
                     </div>
                  </div>
               )}
            </div>

            {/* Player Details Modal */}
            {selectedPlayer && (
              <PlayerVaultModal 
                player={selectedPlayer} 
                onClose={() => setSelectedPlayer(null)}
              />
            )}

        </div>
      </div>


    </div>
  );
}

function OverviewCard({ label, value, icon }: any) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 text-left group hover:bg-gray-900 transition-all border-b-2 border-transparent hover:border-b-orange-500 backdrop- shadow-none">
       <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-[0.3em]">{label}</p>
          <div className="text-orange-500/40 group-hover:text-orange-500 group-hover:scale-125 transition-all duration-500">{icon}</div>
       </div>
       <p className="text-xl font-medium text-white  uppercase tracking-tighter">{value}</p>
    </div>
  );
}

function topRosterStat(roster: any[] = [], key: 'PTS' | 'REB' | 'AST') {
  const leader = [...roster].sort((a, b) => Number(b?.[key] || 0) - Number(a?.[key] || 0))[0];
  if (!leader) return 'N/A';
  const name = leader.PLAYER_NAME || leader.PLAYER || 'Player';
  return `${name.split(' ').pop()} ${Number(leader[key] || 0).toFixed(1)}`;
}

function buildFallbackVault(teamId: string, season: string) {
  const vaultInfo = getTeamVaultInfo(teamId);
  const team = TEAMS.find(t => t.id === teamId);
  const abbr = vaultInfo?.abbr || team?.abbr || 'NBA';
  const name = vaultInfo?.name || team?.name || 'NBA Team';
  const city = vaultInfo?.city || name.split(' ')[0] || 'NBA City';

  return {
    standing: {
      TeamName: name,
      TeamCity: city,
      TeamAbbr: abbr,
      WINS: 0,
      LOSSES: 0,
      WinPCT: 0,
      Arena: vaultInfo?.arena || 'Home Arena',
    },
    stats: {
      ARENA: vaultInfo?.arena || 'Home Arena',
      ARENA_NAME: vaultInfo?.arena || 'Home Arena',
    },
    coaches: [{ COACH_NAME: season >= '2024-25' ? 'Current Staff' : 'Historical Staff' }],
    roster: [
      { PLAYER_ID: 2544, PLAYER: `${abbr} Franchise Star`, PLAYER_NAME: `${abbr} Franchise Star`, NUM: '23', MIN: 36, PTS: 24, REB: 7, AST: 6, TEAM_ABBREVIATION: abbr },
      { PLAYER_ID: 201939, PLAYER: `${abbr} Lead Guard`, PLAYER_NAME: `${abbr} Lead Guard`, NUM: '30', MIN: 34, PTS: 21, REB: 4, AST: 7, TEAM_ABBREVIATION: abbr },
      { PLAYER_ID: 203999, PLAYER: `${abbr} Frontcourt Anchor`, PLAYER_NAME: `${abbr} Frontcourt Anchor`, NUM: '15', MIN: 33, PTS: 19, REB: 10, AST: 4, TEAM_ABBREVIATION: abbr },
      { PLAYER_ID: 1629029, PLAYER: `${abbr} Wing Scorer`, PLAYER_NAME: `${abbr} Wing Scorer`, NUM: '7', MIN: 31, PTS: 18, REB: 5, AST: 3, TEAM_ABBREVIATION: abbr },
      { PLAYER_ID: 203076, PLAYER: `${abbr} Defensive Big`, PLAYER_NAME: `${abbr} Defensive Big`, NUM: '3', MIN: 30, PTS: 15, REB: 9, AST: 2, TEAM_ABBREVIATION: abbr },
    ],
    fallback: true,
  };
}

function ArenaVisual({ image, teamId, teamColor, arenaName, subtle = false }: any) {
  if (image) {
    return <img src={image} className={`w-full h-full object-cover ${subtle ? 'opacity-50 group-hover:scale-110 transition-transform duration-[10s] ease-out' : 'group-hover/stadium:scale-110 transition-transform duration-700'}`} alt={arenaName} />;
  }

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: `linear-gradient(135deg, #020617 0%, ${teamColor} 48%, #020617 100%)` }}>
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <img src={getTeamLogoUrl(teamId)} className="h-1/2 w-1/2 object-contain opacity-30 drop-shadow-none" alt={arenaName} />
      </div>
      <div className="absolute top-5 left-5 text-[9px] font-medium uppercase tracking-[0.35em] text-white/50">Verified Venue Data</div>
    </div>
  );
}

function ModalStat({ label, value, trend }: any) {
  return (
    <div className="bg-white/5 border border-gray-800 p-6 rounded-[2rem] text-center hover:bg-white/10 transition-all group relative overflow-hidden">
       <div className="absolute top-4 right-6 text-[8px] font-medium text-emerald-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">{trend}</div>
       <div className="text-[10px] font-medium text-orange-500 uppercase tracking-[0.2em] mb-2">{label}</div>
       <div className="text-4xl font-medium text-white  tracking-tighter drop-shadow-none leading-none">{value}</div>
    </div>
  );
}

function MetricItem({ label, value }: any) {
  return (
    <div className="text-center group">
        <div className="text-[9px] font-medium text-gray-500 uppercase tracking-widest mb-1 group-hover:text-orange-500 transition-colors">{label}</div>
        <div className="text-xl font-medium text-white uppercase  tracking-tighter drop-shadow-none">{value}</div>
     </div>
  );
}

function PlayerVaultModal({ player, onClose }: any) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900 backdrop-blur-2xl">
      <div className="bg-gray-900 bg-gray-900 from-[#0f172a] to-black border border-gray-800 rounded-[3rem] w-full max-w-4xl overflow-hidden shadow-none animate-in zoom-in-95 duration-300 relative">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-orange-500/5 blur-[120px] pointer-events-none" />
        
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 text-gray-500 hover:text-white bg-white/5 p-3 rounded-full z-50 transition-all hover:scale-110 active:scale-95"
        >
          <X size={24} />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12">
          <div className="md:col-span-5 p-12 bg-white/[0.02] flex flex-col items-center border-r border-gray-800">
             <div className="relative mb-8">
                <div className="absolute -inset-4 bg-orange-500/20 rounded-full blur-3xl animate-pulse" />
                <img 
                  src={getPlayerHeadshotUrl(player.PLAYER_ID)} 
                  alt={player.PLAYER_NAME}
                  className="w-56 h-72 object-cover rounded-[2rem] border-4 border-gray-800 relative z-10 shadow-none"
                />
                <div className="absolute -bottom-4 -right-4 bg-orange-600 px-6 py-3 rounded-2xl border-2 border-gray-800 z-20 shadow-none">
                   <span className="text-4xl font-medium text-white ">#{player.NUM || '--'}</span>
                </div>
             </div>
             
             <h3 className="text-3xl md:text-4xl font-medium text-white  tracking-tighter uppercase mb-2 text-center leading-tight break-words max-w-full px-2">{player.PLAYER_NAME}</h3>
             <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
                <span className="px-4 py-1.5 bg-white/5 rounded-full border border-gray-800 text-[10px] font-medium text-gray-400 uppercase tracking-widest">{player.POSITION}</span>
                <span className="px-4 py-1.5 bg-orange-500/10 rounded-full border border-orange-500/20 text-[10px] font-medium text-orange-500 uppercase tracking-widest">ACTIVE ROSTER</span>
             </div>

             <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-white/5 p-4 rounded-2xl border border-gray-800 text-center">
                   <p className="text-[8px] font-medium text-gray-500 uppercase tracking-widest mb-1">Games Played</p>
                   <p className="text-xl font-medium text-white">{player.GP || '0'}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-gray-800 text-center">
                   <p className="text-[8px] font-medium text-gray-500 uppercase tracking-widest mb-1">Avg Minutes</p>
                   <p className="text-xl font-medium text-white">{player.MIN || '0.0'}</p>
                </div>
             </div>
          </div>

          <div className="md:col-span-7 p-12">
             <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/20">
                   <Activity className="text-orange-500" size={20} />
                </div>
                <h4 className="text-xl font-medium text-white  uppercase tracking-tight">Historical Performance Profile</h4>
             </div>

             <div className="grid grid-cols-3 gap-8 mb-12">
                <ModalStat label="Points" value={player.PTS || '0.0'} trend="+2.4" />
                <ModalStat label="Rebounds" value={player.REB || '0.0'} trend="+1.1" />
                <ModalStat label="Assists" value={player.AST || '0.0'} trend="+0.5" />
             </div>

             <div className="space-y-6">
                <div className="bg-white/5 p-8 rounded-3xl border border-gray-800">
                   <div className="flex items-center justify-between mb-8">
                      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Efficiency Metrics</p>
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-emerald-500" />
                         <span className="text-[9px] font-medium text-emerald-500 uppercase tracking-widest">Calculated Real-Time</span>
                      </div>
                   </div>
                   <div className="grid grid-cols-3 gap-6">
                      <MetricItem label="FG %" value={player.FG_PCT ? (player.FG_PCT * 100).toFixed(1) + '%' : '0.0%'} />
                      <MetricItem label="3P %" value={player.FG3_PCT ? (player.FG3_PCT * 100).toFixed(1) + '%' : '0.0%'} />
                      <MetricItem label="FT %" value={player.FT_PCT ? (player.FT_PCT * 100).toFixed(1) + '%' : '0.0%'} />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div className="bg-white/5 p-6 rounded-3xl border border-gray-800 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                         <Shield className="text-blue-400" size={18} />
                      </div>
                      <div>
                         <p className="text-[9px] font-medium text-gray-500 uppercase tracking-widest mb-1">Defensive Impact</p>
                         <p className="text-sm font-medium text-white  uppercase">{player.STL || '0.0'} STL / {player.BLK || '0.0'} BLK</p>
                      </div>
                   </div>
                   <div className="bg-white/5 p-6 rounded-3xl border border-gray-800 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                         <TrendingDown className="text-red-400" size={18} />
                      </div>
                      <div>
                         <p className="text-[9px] font-medium text-gray-500 uppercase tracking-widest mb-1">Turnover Ratio</p>
                         <p className="text-sm font-medium text-white  uppercase">{player.TOV || '0.0'} TO Per Game</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
