import { useEffect, useMemo, useState, useRef } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Dice5,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  User,
  X,
  Volume2,
  VolumeX,
  Crown,
  Dribbble,
  ArrowRight,
  Check
} from 'lucide-react';
import {
  nbaApi,
  getPlayerHeadshotUrl,
  getPlayerId,
  getPlayerName,
  type Player,
} from '../lib/api';
import BasketballLoader from '../components/BasketballLoader';
import { CURRENT_TEAM_VAULT } from './SeasonVaultData';

type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
type TeamKey = 'A' | 'B';
type ActivePick = { team: TeamKey; position: Position };

type PrimeStats = {
  season: string;
  gp: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgPct: number;
  fg3Pct: number;
  ftPct: number;
  estimated?: boolean;
};

type DreamPlayer = {
  id: number;
  name: string;
  position: Position;
  teamAbbr: string;
  teamId: number;
  prime: PrimeStats;
};

type TeamRoster = Record<Position, DreamPlayer | null>;

type PlayerLine = {
  player: DreamPlayer;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  plusMinus: number;
};

type SimulationResult = {
  scoreA: number;
  scoreB: number;
  winner: TeamKey | 'OT';
  pace: number;
  teamA: PlayerLine[];
  teamB: PlayerLine[];
  notes: string[];
};

const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
const TEAM_LABELS: Record<TeamKey, string> = { A: 'Team A', B: 'Team B' };
const STORAGE_KEY = 'nba_dream_team_matchup_v2';

// Team Colors for the Spinning Wheel
const TEAM_COLORS: Record<string, { primary: string; secondary: string; text: string }> = {
  "1610612737": { primary: "#E03A3E", secondary: "#C1D32F", text: "#FFFFFF" }, // ATL
  "1610612738": { primary: "#007A33", secondary: "#BA9653", text: "#FFFFFF" }, // BOS
  "1610612739": { primary: "#860038", secondary: "#FDBB30", text: "#FFFFFF" }, // CLE
  "1610612740": { primary: "#0C2340", secondary: "#C8102E", text: "#FFFFFF" }, // NOP
  "1610612741": { primary: "#CE1141", secondary: "#000000", text: "#FFFFFF" }, // CHI
  "1610612742": { primary: "#00538C", secondary: "#B8C4CA", text: "#FFFFFF" }, // DAL
  "1610612743": { primary: "#0E2240", secondary: "#FEC524", text: "#FFFFFF" }, // DEN
  "1610612744": { primary: "#1D428A", secondary: "#FFC72C", text: "#FFFFFF" }, // GSW
  "1610612745": { primary: "#CE1141", secondary: "#000000", text: "#FFFFFF" }, // HOU
  "1610612746": { primary: "#C8102E", secondary: "#1D428A", text: "#FFFFFF" }, // LAC
  "1610612747": { primary: "#552583", secondary: "#FDB927", text: "#FFFFFF" }, // LAL
  "1610612748": { primary: "#98002E", secondary: "#F9A01B", text: "#FFFFFF" }, // MIA
  "1610612749": { primary: "#00471B", secondary: "#EEE1C6", text: "#FFFFFF" }, // MIL
  "1610612750": { primary: "#0C2340", secondary: "#236192", text: "#FFFFFF" }, // MIN
  "1610612751": { primary: "#000000", secondary: "#FFFFFF", text: "#FFFFFF" }, // BKN
  "1610612752": { primary: "#006BB6", secondary: "#F58426", text: "#FFFFFF" }, // NYK
  "1610612753": { primary: "#0077C0", secondary: "#C4CED4", text: "#FFFFFF" }, // ORL
  "1610612754": { primary: "#002D62", secondary: "#FDBB30", text: "#FFFFFF" }, // IND
  "1610612755": { primary: "#006BB6", secondary: "#ED174C", text: "#FFFFFF" }, // PHI
  "1610612756": { primary: "#1D1160", secondary: "#E56020", text: "#FFFFFF" }, // PHX
  "1610612757": { primary: "#E03A3E", secondary: "#000000", text: "#FFFFFF" }, // POR
  "1610612758": { primary: "#5A2D81", secondary: "#63727A", text: "#FFFFFF" }, // SAC
  "1610612759": { primary: "#000000", secondary: "#C4CED4", text: "#FFFFFF" }, // SAS
  "1610612760": { primary: "#007AC1", secondary: "#EF3B24", text: "#FFFFFF" }, // OKC
  "1610612761": { primary: "#CE1141", secondary: "#000000", text: "#FFFFFF" }, // TOR
  "1610612762": { primary: "#002B5C", secondary: "#F9A01B", text: "#FFFFFF" }, // UTA
  "1610612763": { primary: "#12173F", secondary: "#5D76A9", text: "#FFFFFF" }, // MEM
  "1610612764": { primary: "#002B5C", secondary: "#E31837", text: "#FFFFFF" }, // WAS
  "1610612765": { primary: "#1D42BA", secondary: "#C8102E", text: "#FFFFFF" }, // DET
  "1610612766": { primary: "#00788C", secondary: "#1D1160", text: "#FFFFFF" }, // CHA
};

// Curated All-Time Greatest Players for each NBA Team
const TEAM_LEGENDS: Record<string, string[]> = {
  "1610612737": ["Dominique Wilkins", "Bob Pettit", "Pete Maravich", "Lou Hudson", "Trae Young", "Joe Johnson", "Dikembe Mutombo", "Al Horford"],
  "1610612738": ["Larry Bird", "Bill Russell", "Paul Pierce", "John Havlicek", "Bob Cousy", "Kevin McHale", "Robert Parish", "Jayson Tatum", "Jaylen Brown", "Sam Jones"],
  "1610612739": ["LeBron James", "Kyrie Irving", "Mark Price", "Brad Daugherty", "Zydrunas Ilgauskas", "Kevin Love", "Donovan Mitchell", "Larry Nance"],
  "1610612740": ["Chris Paul", "Anthony Davis", "Zion Williamson", "DeMarcus Cousins", "Brandon Ingram", "Jrue Holiday", "David West", "Baron Davis"],
  "1610612741": ["Michael Jordan", "Scottie Pippen", "Derrick Rose", "Dennis Rodman", "Artis Gilmore", "Jimmy Butler", "Zach LaVine", "Luol Deng", "Joakim Noah", "Toni Kukoc"],
  "1610612742": ["Dirk Nowitzki", "Luka Doncic", "Jason Kidd", "Steve Nash", "Rolando Blackman", "Michael Finley", "Jason Terry", "Kyrie Irving", "Mark Aguirre"],
  "1610612743": ["Nikola Jokic", "Alex English", "Carmelo Anthony", "Dan Issel", "David Thompson", "Jamal Murray", "Fat Lever", "Chauncey Billups", "Marcus Camby"],
  "1610612744": ["Stephen Curry", "Wilt Chamberlain", "Rick Barry", "Klay Thompson", "Draymond Green", "Kevin Durant", "Chris Mullin", "Nate Thurmond", "Baron Davis", "Tim Hardaway"],
  "1610612745": ["Hakeem Olajuwon", "James Harden", "Moses Malone", "Clyde Drexler", "Yao Ming", "Tracy McGrady", "Rudy Tomjanovich", "Calvin Murphy", "Chris Paul", "Steve Francis"],
  "1610612746": ["Chris Paul", "Blake Griffin", "Kawhi Leonard", "Paul George", "Bob McAdoo", "Elton Brand", "DeAndre Jordan", "Corey Maggette", "James Harden"],
  "1610612747": ["Kobe Bryant", "Magic Johnson", "Kareem Abdul-Jabbar", "Shaquille O'Neal", "Jerry West", "LeBron James", "Elgin Baylor", "Wilt Chamberlain", "James Worthy", "Anthony Davis", "Pau Gasol"],
  "1610612748": ["Dwyane Wade", "LeBron James", "Alonzo Mourning", "Jimmy Butler", "Tim Hardaway", "Chris Bosh", "Shaquille O'Neal", "Bam Adebayo", "Glen Rice"],
  "1610612749": ["Giannis Antetokounmpo", "Kareem Abdul-Jabbar", "Oscar Robertson", "Ray Allen", "Sidney Moncrief", "Khris Middleton", "Jrue Holiday", "Bob Dandridge", "Michael Redd"],
  "1610612750": ["Kevin Garnett", "Anthony Edwards", "Karl-Anthony Towns", "Kevin Love", "Sam Cassell", "Latrell Sprewell", "Jimmy Butler", "Wally Szczerbiak"],
  "1610612751": ["Julius Erving", "Jason Kidd", "Kevin Durant", "Kyrie Irving", "James Harden", "Vince Carter", "Brook Lopez", "Derrick Coleman", "Buck Williams", "Richard Jefferson"],
  "1610612752": ["Patrick Ewing", "Walt Frazier", "Willis Reed", "Carmelo Anthony", "Bernard King", "Earl Monroe", "Jalen Brunson", "Allan Houston", "John Starks"],
  "1610612753": ["Shaquille O'Neal", "Dwight Howard", "Penny Hardaway", "Tracy McGrady", "Nick Anderson", "Darrell Armstrong", "Paolo Banchero", "Franz Wagner", "Hedo Turkoglu"],
  "1610612754": ["Reggie Miller", "Paul George", "Tyrese Haliburton", "Jermaine O'Neal", "Danny Granger", "Rik Smits", "George McGinnis", "Mel Daniels", "Ron Artess"],
  "1610612755": ["Allen Iverson", "Julius Erving", "Wilt Chamberlain", "Joel Embiid", "Moses Malone", "Charles Barkley", "Hal Greer", "Maurice Cheeks", "Bobby Jones"],
  "1610612756": ["Steve Nash", "Charles Barkley", "Devin Booker", "Kevin Johnson", "Paul Westphal", "Amar'e Stoudemire", "Shawn Marion", "Chris Paul", "Kevin Durant", "Walter Davis"],
  "1610612757": ["Clyde Drexler", "Damian Lillard", "Bill Walton", "Brandon Roy", "LaMarcus Aldridge", "Maurice Lucas", "Terry Porter", "Rasheed Wallace", "CJ McCollum"],
  "1610612758": ["Oscar Robertson", "Chris Webber", "Mitch Richmond", "De'Aaron Fox", "Domantas Sabonis", "Peja Stojakovic", "Mike Bibby", "Vlade Divac", "Jerry Lucas"],
  "1610612759": ["Tim Duncan", "David Robinson", "George Gervin", "Tony Parker", "Manu Ginobili", "Kawhi Leonard", "Victor Wembanyama", "Sean Elliott", "Bruce Bowen"],
  "1610612760": ["Kevin Durant", "Russell Westbrook", "James Harden", "Gary Payton", "Shawn Kemp", "Ray Allen", "Shai Gilgeous-Alexander", "Paul George", "Serge Ibaka", "Jack Sikma"],
  "1610612761": ["Vince Carter", "Kawhi Leonard", "Kyle Lowry", "DeMar DeRozan", "Chris Bosh", "Pascal Siakam", "Fred VanVleet", "Scottie Barnes", "Damon Stoudamire"],
  "1610612762": ["Karl Malone", "John Stockton", "Pete Maravich", "Adrian Dantley", "Donovan Mitchell", "Rudy Gobert", "Deron Williams", "Andrei Kirilenko", "Lauri Markkanen", "Mark Eaton"],
  "1610612763": ["Marc Gasol", "Pau Gasol", "Zach Randolph", "Mike Conley", "Ja Morant", "Shareef Abdur-Rahim", "Jaren Jackson Jr.", "Tony Allen", "Rudy Gay"],
  "1610612764": ["Wes Unseld", "Elvin Hayes", "John Wall", "Bradley Beal", "Gilbert Arenas", "Chris Webber", "Rod Strickland", "Gus Johnson", "Earl Monroe"],
  "1610612765": ["Isiah Thomas", "Joe Dumars", "Chauncey Billups", "Ben Wallace", "Dennis Rodman", "Bob Lanier", "Grant Hill", "Richard Hamilton", "Rasheed Wallace", "Dave Bing"],
  "1610612766": ["Kemba Walker", "Alonzo Mourning", "Larry Johnson", "Glen Rice", "LaMelo Ball", "Gerald Wallace", "Baron Davis", "Al Jefferson"],
};

const ALL_TEAMS = Object.values(CURRENT_TEAM_VAULT);

const emptyRoster = (): TeamRoster => ({
  PG: null,
  SG: null,
  SF: null,
  PF: null,
  C: null,
});

const fallbackPrime = (player: any, position: Position): PrimeStats => {
  const pts = numberFrom(player.PTS, player.pts, position === 'C' ? 18 : 20);
  const reb = numberFrom(player.REB, player.reb, position === 'C' || position === 'PF' ? 9 : 5);
  const ast = numberFrom(player.AST, player.ast, position === 'PG' ? 7 : 3);
  const stl = numberFrom(player.STL, player.stl, 1.1);
  const blk = numberFrom(player.BLK, player.blk, position === 'C' ? 1.6 : 0.6);

  return {
    season: 'Prime',
    gp: numberFrom(player.GP, 72),
    min: numberFrom(player.MIN, 34),
    pts,
    reb,
    ast,
    stl,
    blk,
    tov: numberFrom(player.TOV, Math.max(1.2, ast * 0.32)),
    fgPct: numberFrom(player.FG_PCT, 0.47),
    fg3Pct: numberFrom(player.FG3_PCT, 0.35),
    ftPct: numberFrom(player.FT_PCT, 0.78),
    estimated: true,
  };
};

function getTeamAbbr(teamId: string): string {
  const team = CURRENT_TEAM_VAULT[teamId];
  return team ? team.abbr : 'NBA';
}

function getTeamLegendsForDraft(teamId: string, allPlayers: any[]) {
  const names = TEAM_LEGENDS[teamId] || [];
  const matched: any[] = [];
  
  names.forEach(name => {
    const found = allPlayers.find(p => {
      const pName = (p.full_name || p.PLAYER_NAME || p.name || '').toLowerCase();
      return pName === name.toLowerCase();
    });
    if (found) {
      matched.push({
        id: found.id || found.PERSON_ID || found.PLAYER_ID,
        name: found.full_name || found.PLAYER_NAME || found.name,
        TEAM_ID: Number(teamId),
        TEAM_ABBREVIATION: found.team_abbreviation || found.TEAM_ABBREVIATION || getTeamAbbr(teamId),
        is_legend: true
      });
    } else {
      matched.push({
        id: Math.floor(Math.random() * 90000) + 10000,
        name: name,
        TEAM_ID: Number(teamId),
        TEAM_ABBREVIATION: getTeamAbbr(teamId),
        is_legend: true
      });
    }
  });
  return matched;
}

// Confetti Particle System
class ConfettiParticle {
  x: number;
  y: number;
  color: string;
  size: number;
  vx: number;
  vy: number;
  alpha: number;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = Math.random() * 6 + 4;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6 + 3;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 1.5;
    this.alpha = 1;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.12; // gravity
    this.vx *= 0.98; // friction
    this.alpha -= 0.015;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

// Canvas Confetti Effect
function LandingConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || 450;
    canvas.height = canvas.parentElement?.clientHeight || 550;

    const particles: ConfettiParticle[] = [];
    const colors = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#eab308', '#ec4899'];

    const x = canvas.width / 2;
    const y = canvas.height / 3;
    for (let i = 0; i < 60; i++) {
      particles.push(new ConfettiParticle(x, y, colors[Math.floor(Math.random() * colors.length)]));
    }

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, index) => {
        p.update();
        p.draw(ctx);
        if (p.alpha <= 0) {
          particles.splice(index, 1);
        }
      });

      if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-50 h-full w-full" />;
}

// Wheel Component
interface WheelProps {
  teams: any[];
  onSpinEnd: (team: any) => void;
  isSpinning: boolean;
  setIsSpinning: (spinning: boolean) => void;
  targetIndex: number;
  soundEnabled: boolean;
}

function Wheel({ teams, onSpinEnd, isSpinning, setIsSpinning, targetIndex, soundEnabled }: WheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const requestRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playTickSound = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioCtx = audioCtxRef.current;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(550, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.04);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    drawWheel();
  }, [teams]);

  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 15;
    ctx.clearRect(0, 0, size, size);

    const sliceAngle = (2 * Math.PI) / teams.length;

    // Draw background outer ring
    ctx.beginPath();
    ctx.arc(center, center, radius + 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#27272a'; // zinc-800
    ctx.fill();
    ctx.strokeStyle = '#3f3f46'; // zinc-700
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(rotationRef.current);

    teams.forEach((team, i) => {
      const angle = i * sliceAngle;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, angle, angle + sliceAngle);
      ctx.closePath();

      const colors = TEAM_COLORS[team.id] || { primary: "#3f3f46", secondary: "#18181b", text: "#ffffff" };
      ctx.fillStyle = colors.primary;
      ctx.fill();

      // Thin separator lines
      ctx.strokeStyle = 'rgba(24, 24, 27, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text label
      ctx.save();
      ctx.rotate(angle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colors.text;
      ctx.font = 'bold 13px system-ui, sans-serif';
      
      // Shadow effect
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 3;
      
      ctx.fillText(team.abbreviation, radius - 28, 0);
      ctx.restore();
    });

    ctx.restore();

    // Draw center pin
    ctx.beginPath();
    ctx.arc(center, center, 32, 0, 2 * Math.PI);
    ctx.fillStyle = '#f97316'; // orange-500
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Center icon/text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPIN', center, center);

    // Draw pointer at top (pointer points down)
    ctx.beginPath();
    ctx.moveTo(center - 12, 5);
    ctx.lineTo(center + 12, 5);
    ctx.lineTo(center, 25);
    ctx.closePath();
    ctx.fillStyle = '#f43f5e'; // rose-500
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const spin = () => {
    if (isSpinning) return;
    setIsSpinning(true);

    const sliceAngle = (2 * Math.PI) / teams.length;
    // Align targetIndex with top pointer (top is -Math.PI / 2)
    const targetRotation = -Math.PI / 2 - (targetIndex * sliceAngle + sliceAngle / 2);
    const minSpins = 4;
    const finalRotation = targetRotation + 2 * Math.PI * (minSpins + Math.random() * 0.15);
    const startRotation = rotationRef.current % (2 * Math.PI);
    rotationRef.current = startRotation;

    const duration = 3800;
    const startTime = performance.now();
    let lastTickAngle = 0;

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const currentRotation = startRotation + ease * (finalRotation - startRotation);
      rotationRef.current = currentRotation;

      drawWheel();

      // Tick audio logic
      const currentAngleInSlices = currentRotation / sliceAngle;
      if (Math.floor(currentAngleInSlices) !== Math.floor(lastTickAngle)) {
        playTickSound();
        lastTickAngle = currentAngleInSlices;
      }

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        onSpinEnd(teams[targetIndex]);
      }
    };

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center p-2">
      <canvas
        ref={canvasRef}
        width={340}
        height={340}
        className="max-w-full cursor-pointer rounded-full transition-transform hover:scale-[1.02]"
        onClick={spin}
      />
    </div>
  );
}

export default function DreamTeam() {
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [activePick, setActivePick] = useState<ActivePick | null>(null);
  const [loadingPrimeId, setLoadingPrimeId] = useState<number | null>(null);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [rosters, setRosters] = useState<Record<TeamKey, TeamRoster>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : { A: emptyRoster(), B: emptyRoster() };
    } catch {
      return { A: emptyRoster(), B: emptyRoster() };
    }
  });

  // Wheel draft specific state variables
  const [wheelTeams, setWheelTeams] = useState<any[]>([]);
  const [wheelTargetIndex, setWheelTargetIndex] = useState<number>(0);
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [phase, setPhase] = useState<'spin' | 'select' | 'search'>('spin');
  const [currentRoster, setCurrentRoster] = useState<any[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [showAllPositions, setShowAllPositions] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rosters));
  }, [rosters]);

  useEffect(() => {
    Promise.all([
      nbaApi.getAllPlayers().catch(() => []),
      nbaApi.getTopPlayers().catch(() => []),
    ])
      .then(([players, leaders]) => {
        setAllPlayers(Array.isArray(players) ? players : []);
        setTopPlayers(Array.isArray(leaders) ? leaders : []);
      })
      .finally(() => setLoadingList(false));
  }, []);

  const selectedIds = useMemo(() => {
    const ids = new Set<number>();
    (['A', 'B'] as TeamKey[]).forEach(team => {
      POSITIONS.forEach(position => {
        const player = rosters[team][position];
        if (player) ids.add(player.id);
      });
    });
    return ids;
  }, [rosters]);

  const filteredPlayers = useMemo(() => {
    if (!search.trim()) return [];
    const s = search.toLowerCase();
    return allPlayers
      .filter(player => {
        const id = getPlayerId(player);
        const name = getPlayerName(player).toLowerCase();
        return id > 0 && name.includes(s) && !selectedIds.has(id);
      })
      .slice(0, 12);
  }, [allPlayers, search, selectedIds]);

  const teamScores = useMemo(() => ({
    A: rateTeam(Object.values(rosters.A).filter(Boolean) as DreamPlayer[]),
    B: rateTeam(Object.values(rosters.B).filter(Boolean) as DreamPlayer[]),
  }), [rosters]);

  const complete = POSITIONS.every(position => rosters.A[position] && rosters.B[position]);
  const nextPick = getNextPick(rosters);

  // Pick 10 random teams whenever activePick is loaded
  useEffect(() => {
    if (activePick) {
      const shuffled = [...ALL_TEAMS].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 10);
      setWheelTeams(selected);
      setWheelTargetIndex(Math.floor(Math.random() * 10));
      setSelectedTeam(null);
      setPhase('spin');
      setCurrentRoster([]);
      setPlayerSearch('');
    }
  }, [activePick]);

  async function handleAddPlayer(player: any, pickOverride?: ActivePick) {
    const pick = pickOverride || activePick;
    if (!pick) return;
    const id = getPlayerId(player);
    if (!id) return;

    setLoadingPrimeId(id);
    try {
      const dreamPlayer = await buildDreamPlayer(player, pick.position);
      const updatedRosters = {
        ...rosters,
        [pick.team]: {
          ...rosters[pick.team],
          [pick.position]: dreamPlayer,
        },
      };
      setRosters(updatedRosters);
      setSimResult(null);

      // Advance automatically or close
      const next = getNextPick(updatedRosters);
      if (next) {
        setActivePick(next);
      } else {
        setActivePick(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPrimeId(null);
    }
  }

  async function buildDreamPlayer(player: any, position: Position): Promise<DreamPlayer> {
    const id = getPlayerId(player);
    const profile = await nbaApi.getPlayerProfile(id).catch(() => null);
    const prime = await getPrimeSeason(id, profile, player, position);

    return {
      id,
      name: getPlayerName(player),
      position,
      teamAbbr: player.team_abbreviation || player.TEAM_ABBREVIATION || 'NBA',
      teamId: Number(player.TEAM_ID || player.team_id || 0),
      prime,
    };
  }

  async function getPrimeSeason(playerId: number, profile: any, player: any, position: Position): Promise<PrimeStats> {
    const seasons = Array.isArray(profile?.seasons) ? profile.seasons : [];
    const candidates = seasons.length > 0 ? pickPrimeCandidateSeasons(seasons) : [];

    const seasonStats = await Promise.all(
      candidates.map(async (season: string) => {
        const avg = await nbaApi.getPlayerAverages(playerId, season).catch(() => null);
        return normalizePrime(avg, season);
      })
    );

    const best = seasonStats
      .filter(Boolean)
      .sort((a, b) => primeScore(b as PrimeStats) - primeScore(a as PrimeStats))[0] as PrimeStats | undefined;

    return best || fallbackPrime(player, position);
  }

  function removePlayer(team: TeamKey, position: Position) {
    setRosters(prev => ({
      ...prev,
      [team]: {
        ...prev[team],
        [position]: null,
      },
    }));
    setSimResult(null);
  }

  function clearRosters() {
    setRosters({ A: emptyRoster(), B: emptyRoster() });
    setSimResult(null);
  }

  const handleWheelEnd = async (team: any) => {
    setSelectedTeam(team);
    setPhase('select');
    setRosterLoading(true);
    try {
      const roster = await nbaApi.getTeamRoster(team.id).catch(() => []);
      setCurrentRoster(roster);
    } finally {
      setRosterLoading(false);
    }
  };

  const filteredLegends = useMemo(() => {
    if (!selectedTeam) return [];
    const legends = getTeamLegendsForDraft(String(selectedTeam.id), allPlayers);
    const unused = legends.filter(p => !selectedIds.has(p.id));
    if (!playerSearch.trim()) return unused;
    const s = playerSearch.toLowerCase();
    return unused.filter(p => p.name.toLowerCase().includes(s));
  }, [selectedTeam, allPlayers, playerSearch, selectedIds]);

  const filteredRoster = useMemo(() => {
    if (!selectedTeam || !currentRoster) return [];
    const s = playerSearch.toLowerCase();
    return currentRoster.filter(p => {
      const id = getPlayerId(p);
      const name = getPlayerName(p).toLowerCase();
      const pos = (p.POSITION || p.position || '').toString().toUpperCase();
      
      const matchesSearch = !playerSearch.trim() || name.includes(s);
      const matchesPosition = showAllPositions || positionMatches(pos, activePick?.position || 'PG');
      const isUnused = !selectedIds.has(id);
      
      return matchesSearch && matchesPosition && isUnused;
    });
  }, [selectedTeam, currentRoster, playerSearch, showAllPositions, activePick, selectedIds]);

  function autoAssignNext() {
    if (!nextPick) return;
    const used = new Set(selectedIds);
    const candidate = pickRandomPlayer(topPlayers, used);
    if (!candidate) return;
    handleAddPlayer(candidate, nextPick);
  }

  function simulateMatch() {
    if (!complete) return;
    setSimResult(simulate(rosters));
  }

  // Helper to trigger wheel modal on click "Spin Wheel Draft"
  const startSpinDraft = () => {
    if (nextPick) {
      setActivePick(nextPick);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header Panel */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 p-6 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between shadow-xl">
        <div className="relative z-10">
          <h2 className="flex items-center gap-3 text-2xl sm:text-4xl font-semibold text-white tracking-tight uppercase">
            <Trophy className="text-orange-500 animate-pulse" size={36} />
            Prime Dream Match
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-500">
            Build two starting fives by spinning the team wheel, selecting all-time legends, and simulating matches on a professional court engine.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap gap-2.5">
          <button 
            onClick={startSpinDraft} 
            disabled={!nextPick || loadingList} 
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white hover:bg-orange-500 transition-colors shadow-lg shadow-orange-600/10 disabled:opacity-40"
          >
            <Dribbble size={16} className={isSpinning ? 'animate-spin' : ''} />
            Spin Wheel Draft
          </button>
          
          <button 
            onClick={autoAssignNext} 
            disabled={!nextPick || loadingList} 
            className="inline-flex items-center gap-2 rounded-xl border border-gray-800 border-gray-800 bg-gray-900 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500  hover:bg-gray-900  transition-all disabled:opacity-40"
          >
            <Dice5 size={16} />
            Quick Pick
          </button>

          <button 
            onClick={clearRosters} 
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-red-400 hover:bg-red-500/10 transition-all"
          >
            <RefreshCw size={16} />
            Reset Match
          </button>
        </div>
      </div>

      {loadingList ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <BasketballLoader />
        </div>
      ) : (
        <>
          {/* Main Draft Area */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px_1fr]">
            {/* Team A Panel */}
            <TeamPanel 
              team="A" 
              roster={rosters.A} 
              score={teamScores.A} 
              activePick={activePick}
              onPick={setActivePick} 
              onRemove={removePlayer} 
            />

            {/* Simulation Controller Panel */}
            <div className="flex flex-col justify-center gap-5 rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-md relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-orange-500 via-yellow-500 to-orange-500" />
              
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
                  <Swords size={30} />
                </div>
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">Draft Status</div>
                
                <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm bg-gray-900 border border-gray-800">
                  <div className={`h-2.5 w-2.5 rounded-full ${nextPick ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
                  <span className="font-medium text-white">
                    {nextPick ? `${TEAM_LABELS[nextPick.team]} - ${nextPick.position} Slot` : 'Lineups Finished'}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 bg-gray-900/40 p-4 rounded-xl border border-gray-800/40">
                <div className="text-[10px] uppercase font-bold tracking-widest text-gray-500 text-center mb-1">Position Path</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {POSITIONS.map(position => {
                    const isDrafted = rosters.A[position] && rosters.B[position];
                    return (
                      <div 
                        key={position} 
                        className={`rounded-lg py-2.5 text-center text-xs font-semibold transition-all ${
                          isDrafted 
                            ? 'bg-orange-950/20 text-orange-400 border border-orange-500/20' 
                            : 'bg-gray-900 text-gray-500 border border-transparent'
                        }`}
                      >
                        {position}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={simulateMatch}
                disabled={!complete}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 text-sm uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-orange-600/10"
              >
                <Sparkles size={18} />
                Simulate Game
              </button>

              {!complete && (
                <div className="flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3.5 text-xs text-yellow-500/90 leading-relaxed">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <span>Fill all five positions on both Team A and Team B to unlock the live court simulation.</span>
                </div>
              )}
            </div>

            {/* Team B Panel */}
            <TeamPanel 
              team="B" 
              roster={rosters.B} 
              score={teamScores.B} 
              activePick={activePick}
              onPick={setActivePick} 
              onRemove={removePlayer} 
            />
          </div>

          {/* Quick Stats Bar */}
          <Diagnostics rosters={rosters} scores={teamScores} />

          {/* Simulation Output */}
          {simResult && <SimulationPanel result={simResult} />}
        </>
      )}

      {/* SPIN WHEEL DRAFT MODAL */}
      {activePick && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-2xl overflow-hidden">
            {/* Confetti Explosion Canvas */}
            {phase === 'select' && <LandingConfetti />}

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-4 z-10">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-orange-500">
                  Draft Selector - {TEAM_LABELS[activePick.team]}
                </span>
                <h3 className="text-xl font-bold uppercase tracking-tight text-white mt-0.5">
                  Pick {activePick.position} Position
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Audio controls */}
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="rounded-lg p-2 bg-gray-900 hover:bg-gray-900 text-gray-500 transition"
                  title="Toggle Wheel Sound"
                >
                  {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                <button
                  onClick={() => { setActivePick(null); }}
                  className="rounded-lg p-2 bg-gray-900 hover:bg-gray-900 text-gray-500 hover:text-white transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* SPIN PHASE */}
            {phase === 'spin' && (
              <div className="flex-1 flex flex-col justify-between items-center py-4 z-10">
                <div className="text-center mb-2">
                  <p className="text-sm text-gray-500">Spin the wheel to lock in a random team. You must draft a player from that team roster.</p>
                </div>

                <Wheel
                  teams={wheelTeams}
                  targetIndex={wheelTargetIndex}
                  isSpinning={isSpinning}
                  setIsSpinning={setIsSpinning}
                  onSpinEnd={handleWheelEnd}
                  soundEnabled={soundEnabled}
                />

                <div className="w-full flex flex-col gap-2 mt-4">
                  <button
                    disabled={isSpinning}
                    onClick={() => {
                      // Trigger click simulation on canvas to spin
                      const canvas = document.querySelector('canvas');
                      if (canvas) canvas.click();
                    }}
                    className="w-full rounded-xl bg-orange-600 hover:bg-orange-500 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition disabled:opacity-40 shadow-lg shadow-orange-600/20"
                  >
                    {isSpinning ? 'Wheel Spinning...' : 'Spin Team Wheel'}
                  </button>
                  
                  <button
                    disabled={isSpinning}
                    onClick={() => setPhase('search')}
                    className="w-full rounded-xl border border-gray-800 bg-gray-900 hover:bg-gray-900 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-500 transition"
                  >
                    Bypass Wheel & Search League
                  </button>
                </div>
              </div>
            )}

            {/* SELECTION PHASE */}
            {phase === 'select' && selectedTeam && (
              <div className="flex-1 flex flex-col min-h-0 z-10">
                {/* Landed Banner */}
                <div 
                  className="mb-4 flex items-center justify-between rounded-2xl p-4 border"
                  style={{ 
                    borderColor: `${TEAM_COLORS[selectedTeam.id]?.primary}30`,
                    background: `linear-gradient(135deg, ${TEAM_COLORS[selectedTeam.id]?.primary}15, #09090b)` 
                  }}
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src={`https://cdn.nba.com/logos/nba/${selectedTeam.id}/global/L/logo.svg`} 
                      alt="" 
                      className="h-14 w-14 drop-shadow-md"
                    />
                    <div>
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">WHEEL LANDED ON</div>
                      <div className="text-lg font-bold text-white uppercase">{selectedTeam.full_name}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setPhase('spin')}
                    className="rounded-lg bg-gray-900 hover:bg-gray-900 border border-gray-800 px-3 py-1.5 text-xs text-gray-500 transition"
                  >
                    Spin Again
                  </button>
                </div>

                {/* Filter and Search Bar */}
                <div className="relative mb-3 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      value={playerSearch}
                      onChange={e => setPlayerSearch(e.target.value)}
                      placeholder="Search team roster..."
                      className="w-full rounded-xl border border-gray-800 bg-gray-900 py-3 pl-10 pr-4 text-xs text-white outline-none focus:border-orange-500"
                    />
                  </div>
                  <button
                    onClick={() => setShowAllPositions(!showAllPositions)}
                    className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${
                      showAllPositions 
                        ? 'border-orange-500/50 bg-orange-950/20 text-orange-400' 
                        : 'border-gray-800 bg-gray-900 text-gray-500 hover:text-gray-500'
                    }`}
                  >
                    {showAllPositions ? 'All Pos' : `Only ${activePick.position}`}
                  </button>
                </div>

                {/* Scrollable Player Lists */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
                  {/* ALL TIME LEGENDS TAB */}
                  <div>
                    <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2 px-1">All-Time Franchise Greats</div>
                    {filteredLegends.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2">
                        {filteredLegends.map(player => (
                          <button
                            key={player.id}
                            disabled={loadingPrimeId !== null}
                            onClick={() => selectPlayerForDraft(player)}
                            className="group flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/40 hover:bg-gray-900 p-2.5 transition hover:border-orange-500/40 text-left"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={getPlayerHeadshotUrl(player.id)}
                                alt=""
                                className="h-10 w-10 rounded-full bg-gray-900 object-cover border border-gray-800"
                                onError={(e) => {
                                  // Fallback generic photo if headshot not found
                                  (e.target as HTMLImageElement).src = 'https://cdn.nba.com/headshots/nba/latest/260x190/fallback.png';
                                }}
                              />
                              <div>
                                <div className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors">
                                  {player.name}
                                </div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                                  Legendary Season Lookup
                                </div>
                              </div>
                            </div>
                            {loadingPrimeId === player.id ? (
                              <RefreshCw size={15} className="animate-spin text-orange-500" />
                            ) : (
                              <ArrowRight size={14} className="text-gray-500 group-hover:text-orange-400 transition" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-xs text-gray-500 uppercase font-semibold">No Matching Legends</div>
                    )}
                  </div>

                  {/* ACTIVE ROSTER TAB */}
                  <div>
                    <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2 px-1">Modern & Active Roster</div>
                    {rosterLoading ? (
                      <div className="flex justify-center py-6">
                        <RefreshCw className="animate-spin text-orange-500" size={20} />
                      </div>
                    ) : filteredRoster.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2">
                        {filteredRoster.map(player => {
                          const id = getPlayerId(player);
                          return (
                            <button
                              key={id}
                              disabled={loadingPrimeId !== null}
                              onClick={() => selectPlayerForDraft(player)}
                              className="group flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/40 hover:bg-gray-900 p-2.5 transition hover:border-orange-500/40 text-left"
                            >
                              <div className="flex items-center gap-3">
                                <img
                                  src={getPlayerHeadshotUrl(id)}
                                  alt=""
                                  className="h-10 w-10 rounded-full bg-gray-900 object-cover border border-gray-800"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://cdn.nba.com/headshots/nba/latest/260x190/fallback.png';
                                  }}
                                />
                                <div>
                                  <div className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors">
                                    {getPlayerName(player)}
                                  </div>
                                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                                    {(player.POSITION || player.position || 'N/A')} &bull; PTS: {player.PTS || 0}
                                  </div>
                                </div>
                              </div>
                              {loadingPrimeId === id ? (
                                <RefreshCw size={15} className="animate-spin text-orange-500" />
                              ) : (
                                <ArrowRight size={14} className="text-gray-500 group-hover:text-orange-400 transition" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-xs text-gray-500 uppercase font-semibold">No Matching Roster Players</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* DIRECT SEARCH PHASE */}
            {phase === 'search' && (
              <div className="flex-1 flex flex-col min-h-0 z-10">
                <div className="mb-4">
                  <p className="text-xs text-gray-500">Search the entire league database to draft any player directly.</p>
                </div>

                <label className="relative block mb-4">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    autoFocus
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search player name..."
                    className="w-full rounded-xl border border-gray-800 bg-gray-900 py-3 pl-11 pr-4 text-xs text-white outline-none focus:border-orange-500"
                  />
                </label>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                  {filteredPlayers.map(player => {
                    const id = getPlayerId(player);
                    return (
                      <button
                        key={id}
                        onClick={() => selectPlayerForDraft(player)}
                        disabled={loadingPrimeId !== null}
                        className="group flex w-full items-center justify-between rounded-xl border border-gray-800 bg-gray-900/30 p-2.5 text-left transition hover:border-orange-500/40 hover:bg-gray-900"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={getPlayerHeadshotUrl(id)}
                            className="h-10 w-10 rounded-full bg-gray-900 object-cover border border-gray-800"
                            alt=""
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://cdn.nba.com/headshots/nba/latest/260x190/fallback.png';
                            }}
                          />
                          <div>
                            <div className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors">
                              {getPlayerName(player)}
                            </div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                              {player.TEAM_ABBREVIATION || 'NBA'} &bull; Career Prime season lookup
                            </div>
                          </div>
                        </div>
                        {loadingPrimeId === id ? (
                          <RefreshCw size={15} className="animate-spin text-orange-500" />
                        ) : (
                          <ArrowRight size={14} className="text-gray-500 group-hover:text-orange-400 transition" />
                        )}
                      </button>
                    );
                  })}

                  {search.trim() && filteredPlayers.length === 0 && (
                    <div className="py-12 text-center text-xs font-semibold uppercase tracking-widest text-gray-500">
                      No matching players found
                    </div>
                  )}

                  {!search.trim() && (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-xs text-gray-500">
                      <User size={32} className="opacity-30" />
                      Search a player, then the app will auto-locate their prime stats.
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setPhase('spin')}
                  className="mt-4 w-full rounded-xl bg-gray-900 hover:bg-gray-900 border border-gray-800 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 transition"
                >
                  Return to Spinning Wheel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  async function selectPlayerForDraft(player: any) {
    if (!activePick) return;
    const id = getPlayerId(player);
    if (!id) return;

    setLoadingPrimeId(id);
    try {
      const name = getPlayerName(player);
      const playerObj = {
        ...player,
        PLAYER_ID: id,
        PLAYER_NAME: name,
        TEAM_ID: player.team_id || player.TEAM_ID || selectedTeam?.id || 0,
        TEAM_ABBREVIATION: player.team_abbreviation || player.TEAM_ABBREVIATION || selectedTeam?.abbreviation || 'NBA',
      };
      
      const dreamPlayer = await buildDreamPlayer(playerObj, activePick.position);
      
      const nextRosters = {
        ...rosters,
        [activePick.team]: {
          ...rosters[activePick.team],
          [activePick.position]: dreamPlayer,
        },
      };
      
      setRosters(nextRosters);
      setSimResult(null);

      // Check if there is a next slot in turn
      const next = getNextPick(nextRosters);
      if (next) {
        setActivePick(next);
      } else {
        setActivePick(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPrimeId(null);
    }
  }
}

// Redesigned TeamPanel Component with letter grades
function TeamPanel({ team, roster, score, activePick, onPick, onRemove }: {
  team: TeamKey;
  roster: TeamRoster;
  score: ReturnType<typeof rateTeam>;
  activePick: ActivePick | null;
  onPick: (pick: ActivePick) => void;
  onRemove: (team: TeamKey, position: Position) => void;
}) {
  const getLetterGrade = (val: number) => {
    if (val >= 94) return 'A+';
    if (val >= 90) return 'A';
    if (val >= 85) return 'A-';
    if (val >= 80) return 'B+';
    if (val >= 75) return 'B';
    if (val >= 70) return 'B-';
    if (val >= 65) return 'C+';
    if (val >= 60) return 'C';
    if (val >= 50) return 'D';
    return 'F';
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-emerald-400 bg-emerald-950/20 border-emerald-500/20';
    if (grade.startsWith('B')) return 'text-cyan-400 bg-cyan-950/20 border-cyan-500/20';
    if (grade.startsWith('C')) return 'text-yellow-400 bg-yellow-950/20 border-yellow-500/20';
    return 'text-red-400 bg-red-950/20 border-red-500/20';
  };

  const overallGrade = getLetterGrade(score.overall);
  const gradeColorClass = getGradeColor(overallGrade);

  return (
    <section className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gray-900/60 border border-gray-800">
        <div>
          <h3 className="text-xl font-bold uppercase tracking-tight text-white">{TEAM_LABELS[team]}</h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">POWER rating</span>
            <div className={`px-2 py-0.5 rounded text-xs font-bold border ${gradeColorClass}`}>
              {score.overall} ({overallGrade})
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <TinyGrade label="OFF" value={score.offense} grade={getLetterGrade(score.offense)} />
          <TinyGrade label="DEF" value={score.defense} grade={getLetterGrade(score.defense)} />
          <TinyGrade label="FIT" value={score.fit} grade={getLetterGrade(score.fit)} />
        </div>
      </div>

      {/* Roster Cards Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5 xl:grid-cols-1">
        {POSITIONS.map(position => {
          const player = roster[position];
          const isActiveDrafting = activePick && activePick.team === team && activePick.position === position;

          return player && player.prime ? (
            <div 
              key={position} 
              className="group relative flex items-center gap-3.5 rounded-2xl border border-gray-800 bg-gray-900/30 p-3.5 transition hover:border-orange-500/50"
            >
              {/* Trash button */}
              <button
                onClick={() => onRemove(team, position)}
                className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-gray-500 transition hover:bg-red-500/10 hover:text-red-400"
                aria-label={`Remove ${player.name}`}
              >
                <Trash2 size={14} />
              </button>

              {/* Headshot */}
              <div className="relative">
                <img 
                  src={getPlayerHeadshotUrl(player.id)} 
                  alt="" 
                  className="h-16 w-16 rounded-xl bg-gray-900 object-cover border border-gray-800" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://cdn.nba.com/headshots/nba/latest/260x190/fallback.png';
                  }}
                />
                <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-orange-400 border border-gray-800">
                  {position}
                </span>
              </div>

              {/* Player Details */}
              <div className="min-w-0 flex-1 pr-6">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500">
                    {player.prime.season}
                  </span>
                  {player.prime.estimated && (
                    <span className="text-[8px] font-semibold text-gray-500 uppercase tracking-wider px-1 bg-gray-900 rounded">
                      EST.
                    </span>
                  )}
                </div>
                <div className="truncate text-base font-bold text-white uppercase mt-0.5">
                  {player.name}
                </div>
                
                {/* Stats row */}
                <div className="mt-1.5 grid grid-cols-3 gap-2 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                  <div className="bg-gray-900/40 px-2 py-0.5 rounded text-center">
                    <span className="text-gray-500 mr-0.5">P:</span> {player.prime.pts || 0}
                  </div>
                  <div className="bg-gray-900/40 px-2 py-0.5 rounded text-center">
                    <span className="text-gray-500 mr-0.5">R:</span> {player.prime.reb || 0}
                  </div>
                  <div className="bg-gray-900/40 px-2 py-0.5 rounded text-center">
                    <span className="text-gray-500 mr-0.5">A:</span> {player.prime.ast || 0}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <button
              key={position}
              onClick={() => onPick({ team, position })}
              className={`flex min-h-[92px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition ${
                isActiveDrafting
                  ? 'border-orange-500 bg-orange-950/5 text-orange-400 scale-[1.01] shadow-lg shadow-orange-500/5'
                  : 'border-gray-800 bg-gray-900/20 text-gray-500 hover:border-gray-800 hover:bg-gray-900/40'
              }`}
            >
              <Plus size={20} className={`mb-1.5 transition-transform ${isActiveDrafting ? 'animate-bounce text-orange-500' : 'text-gray-500'}`} />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em]">
                {isActiveDrafting ? 'SELECTING...' : `+ ${position}`}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// Redesigned Diagnostics
function Diagnostics({ rosters, scores }: { rosters: Record<TeamKey, TeamRoster>; scores: Record<TeamKey, ReturnType<typeof rateTeam>> }) {
  const teamA = Object.values(rosters.A).filter(Boolean) as DreamPlayer[];
  const teamB = Object.values(rosters.B).filter(Boolean) as DreamPlayer[];
  const allPlayers = [...teamA, ...teamB].filter(p => p && p.prime);
  const topScorer = allPlayers.length > 0 ? allPlayers.sort((a, b) => (b.prime.pts || 0) - (a.prime.pts || 0))[0] : null;
  const topDefender = allPlayers.length > 0 ? allPlayers.sort((a, b) => ((b.prime.stl || 0) + (b.prime.blk || 0)) - ((a.prime.stl || 0) + (a.prime.blk || 0)))[0] : null;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <InfoTile 
        icon={<BarChart3 size={20} />} 
        label="Projected Edge" 
        value={scores.A.overall === scores.B.overall ? 'Even Match' : scores.A.overall > scores.B.overall ? 'Team A Edge' : 'Team B Edge'} 
      />
      <InfoTile 
        icon={<Sparkles size={20} />} 
        label="Top Scorer" 
        value={topScorer ? topScorer.name : '--'} 
      />
      <InfoTile 
        icon={<Shield size={20} />} 
        label="Defensive Stopper" 
        value={topDefender ? topDefender.name : '--'} 
      />
      <InfoTile 
        icon={<Swords size={20} />} 
        label="Draft Progress" 
        value={teamA.length + teamB.length === 10 ? 'Rosters Final' : `${teamA.length + teamB.length} / 10 Drafted`} 
      />
    </section>
  );
}

// Redesigned Simulation Panel (Broadcast scoreboard style)
function SimulationPanel({ result }: { result: SimulationResult }) {
  const sorted = [...result.teamA, ...result.teamB].sort((a, b) => b.pts - a.pts);
  const mostPtsPlayer = sorted[0];
  const mostRebPlayer = [...sorted].sort((a, b) => b.reb - a.reb)[0];
  const mostAstPlayer = [...sorted].sort((a, b) => b.ast - a.ast)[0];

  return (
    <section className="space-y-6 rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-xl relative overflow-hidden">
      {/* Broadcast Scoreboard Header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between border-b border-gray-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/30 border border-rose-500/20 text-rose-400 text-[10px] uppercase font-bold tracking-widest">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
            Sim Completed (Final)
          </div>
          
          <div className="mt-3 flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-4xl sm:text-5xl font-black text-white tracking-tighter">
                Team A <span className="text-orange-500">{result.scoreA}</span>
              </span>
            </div>
            
            <div className="text-gray-500 text-3xl font-extralight">&mdash;</div>
            
            <div className="flex flex-col">
              <span className="text-4xl sm:text-5xl font-black text-white tracking-tighter">
                <span className="text-orange-500">{result.scoreB}</span> Team B
              </span>
            </div>
          </div>
          
          <p className="mt-2 text-sm text-gray-500">
            {result.winner === 'OT' 
              ? 'Dead even after regulation. Settled in sudden death Overtime.' 
              : `Winner: ${TEAM_LABELS[result.winner]} (Tempo: ${result.pace} possessions).`
            }
          </p>
        </div>

        {/* Live Commentary Notes */}
        <div className="w-full lg:max-w-md space-y-2.5">
          <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Match Analysis</div>
          <div className="grid grid-cols-1 gap-2 text-xs text-gray-500">
            {result.notes.map((note, idx) => (
              <div key={idx} className="flex gap-2 rounded-xl bg-gray-900/50 border border-gray-800 p-3 leading-normal">
                <div className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0 mt-1.5" />
                <span>{note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Box Scores */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <BoxScore title="Team A Box Score" lines={result.teamA} />
        <BoxScore title="Team B Box Score" lines={result.teamB} />
      </div>

      {/* Game MVP & Leaders Banner */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900/20 p-5">
        <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Game Leaders & MVP</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <LeaderCard label="Points Leader" line={mostPtsPlayer} value={mostPtsPlayer?.pts} valueSuffix="PTS" />
          <LeaderCard label="Rebounds Leader" line={mostRebPlayer} value={mostRebPlayer?.reb} valueSuffix="REB" />
          <LeaderCard label="Assists Leader" line={mostAstPlayer} value={mostAstPlayer?.ast} valueSuffix="AST" />
        </div>
      </div>
    </section>
  );
}

// Redesigned BoxScore Table
function BoxScore({ title, lines }: { title: string; lines: PlayerLine[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/20">
      <div className="border-b border-gray-800 bg-gray-900/60 px-4 py-3 text-xs font-bold uppercase tracking-widest text-gray-500">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-xs">
          <thead className="border-b border-gray-800 text-[10px] uppercase font-bold tracking-widest text-gray-500">
            <tr>
              <th className="px-4 py-3.5">Player</th>
              <th>MIN</th>
              <th>PTS</th>
              <th>REB</th>
              <th>AST</th>
              <th>STL</th>
              <th>BLK</th>
              <th>TO</th>
              <th>FG</th>
              <th>3PT</th>
              <th>FT</th>
              <th className="pr-4">+/-</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/60 font-medium">
            {lines.map(line => (
              <tr key={line.player.id} className="hover:bg-gray-900/20 transition-colors">
                <td className="px-4 py-3.5 font-bold text-white">{line.player.name}</td>
                <td className="text-gray-500">{line.min}</td>
                <td className="font-extrabold text-orange-500 text-sm">{line.pts}</td>
                <td className="text-gray-500">{line.reb}</td>
                <td className="text-gray-500">{line.ast}</td>
                <td className="text-gray-500">{line.stl}</td>
                <td className="text-gray-500">{line.blk}</td>
                <td className="text-gray-500">{line.tov}</td>
                <td className="text-gray-500">{line.fgm}-{line.fga}</td>
                <td className="text-gray-500">{line.fg3m}-{line.fg3a}</td>
                <td className="text-gray-500">{line.ftm}-{line.fta}</td>
                <td className={`pr-4 font-bold ${line.plusMinus > 0 ? 'text-emerald-500' : line.plusMinus < 0 ? 'text-rose-500' : 'text-gray-500'}`}>
                  {line.plusMinus > 0 ? `+${line.plusMinus}` : line.plusMinus}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Redesigned TinyGrade for Team stats
function TinyGrade({ label, value, grade }: { label: string; value: number; grade: string }) {
  const getGradeColor = (g: string) => {
    if (g.startsWith('A')) return 'text-emerald-400';
    if (g.startsWith('B')) return 'text-cyan-400';
    if (g.startsWith('C')) return 'text-yellow-400';
    return 'text-red-400';
  };
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 px-3 py-2.5">
      <div className="flex items-baseline justify-center gap-1">
        <span className="text-sm font-bold text-white">{value}</span>
        <span className={`text-[10px] font-black ${getGradeColor(grade)}`}>{grade}</span>
      </div>
      <div className="text-[9px] font-semibold uppercase tracking-widest text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

// Redesigned InfoTile
function InfoTile({ icon, label, value }: { icon: JSX.Element; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-800 bg-gray-900/30 p-4 hover:border-gray-800 transition-colors">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-600/10 text-orange-500 border border-orange-500/15">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">{label}</div>
        <div className="truncate text-base font-bold text-white mt-0.5 uppercase tracking-tight">{value}</div>
      </div>
    </div>
  );
}

// Redesigned LeaderCard with Player Headshot support
function LeaderCard({ label, line, value, valueSuffix }: { label: string; line?: PlayerLine; value?: number; valueSuffix: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/60 p-3.5">
      {line?.player.id ? (
        <img 
          src={getPlayerHeadshotUrl(line.player.id)} 
          alt="" 
          className="h-12 w-12 rounded-full object-cover bg-gray-900 border border-gray-800 shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://cdn.nba.com/headshots/nba/latest/260x190/fallback.png';
          }}
        />
      ) : (
        <div className="h-12 w-12 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center shrink-0">
          <User size={20} className="text-gray-500" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{label}</div>
        <div className="truncate text-sm font-bold text-white uppercase mt-0.5">{line?.player.name || '--'}</div>
        <div className="text-base font-black text-orange-500 mt-0.5">
          {value ?? 0} <span className="text-[10px] text-gray-500 font-bold">{valueSuffix}</span>
        </div>
      </div>
    </div>
  );
}

function numberFrom(...values: any[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function positionMatches(posRaw: string | undefined | null, target: Position) {
  const pos = (posRaw || '').toString().toUpperCase();
  if (!pos) return false;
  if (pos.includes(target)) return true;
  if ((target === 'PG' || target === 'SG') && pos.includes('G')) return true;
  if ((target === 'SF' || target === 'PF') && (pos.includes('F') || pos.includes('SF') || pos.includes('PF'))) return true;
  if (target === 'C' && pos.includes('C')) return true;
  return false;
}

function normalizePrime(avg: any, season: string): PrimeStats | null {
  if (!avg || Number(avg.GP ?? 0) <= 0) return null;
  const prime: PrimeStats = {
    season,
    gp: Number(avg.GP ?? 0),
    min: round(Number(avg.MIN ?? 0), 1),
    pts: round(Number(avg.PTS ?? 0), 1),
    reb: round(Number(avg.REB ?? 0), 1),
    ast: round(Number(avg.AST ?? 0), 1),
    stl: round(Number(avg.STL ?? 0), 1),
    blk: round(Number(avg.BLK ?? 0), 1),
    tov: round(Number(avg.TOV ?? 0), 1),
    fgPct: Number(avg.FG_PCT ?? 0),
    fg3Pct: Number(avg.FG3_PCT ?? 0),
    ftPct: Number(avg.FT_PCT ?? 0),
    estimated: false,
  };
  return primeScore(prime) > 0 ? prime : null;
}

function pickPrimeCandidateSeasons(seasons: string[]) {
  const sorted = [...seasons].sort();
  if (sorted.length <= 8) return sorted;
  const start = Math.max(0, Math.floor(sorted.length * 0.2) - 1);
  const end = Math.min(sorted.length, Math.ceil(sorted.length * 0.85));
  const primeWindow = sorted.slice(start, end);
  const everyOther = primeWindow.filter((_, index) => index % 2 === 0);
  return everyOther.slice(-8);
}

function primeScore(stats: PrimeStats) {
  return stats.pts + stats.reb * 0.8 + stats.ast * 0.9 + stats.stl * 2.3 + stats.blk * 2.1 - stats.tov * 0.6 + stats.min * 0.12;
}

function rateTeam(players: DreamPlayer[]) {
  const offense = clamp(Math.round(players.reduce((sum, p) => sum + p.prime.pts + p.prime.ast * 1.4, 0) * 1.2), 0, 100);
  const defense = clamp(Math.round(players.reduce((sum, p) => sum + p.prime.reb * 0.8 + p.prime.stl * 3 + p.prime.blk * 3.2, 0) * 1.35), 0, 100);
  const spacing = players.reduce((sum, p) => sum + p.prime.fg3Pct, 0) / Math.max(players.length, 1);
  const balance = players.length === 5 ? 15 : players.length * 2;
  const fit = clamp(Math.round(balance + spacing * 95 + players.reduce((sum, p) => sum + Math.min(p.prime.ast, 8), 0) * 1.2), 0, 100);
  return { offense, defense, fit, overall: Math.round((offense * 0.44 + defense * 0.36 + fit * 0.2)) };
}

function getNextPick(rosters: Record<TeamKey, TeamRoster>): ActivePick | null {
  for (const position of POSITIONS) {
    if (!rosters.A[position]) return { team: 'A', position };
    if (!rosters.B[position]) return { team: 'B', position };
  }
  return null;
}

function pickRandomPlayer(pool: any[], used: Set<number>) {
  const available = pool.filter(player => !used.has(getPlayerId(player)) && getPlayerId(player) > 0);
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function simulate(rosters: Record<TeamKey, TeamRoster>): SimulationResult {
  const playersA = POSITIONS.map(position => rosters.A[position]).filter(Boolean) as DreamPlayer[];
  const playersB = POSITIONS.map(position => rosters.B[position]).filter(Boolean) as DreamPlayer[];
  const ratingA = rateTeam(playersA);
  const ratingB = rateTeam(playersB);
  const pace = Math.round(96 + Math.random() * 8);

  const linesA = simulateLines(playersA, ratingA, ratingB, pace);
  const linesB = simulateLines(playersB, ratingB, ratingA, pace);
  const rawA = linesA.reduce((sum, line) => sum + line.pts, 0);
  const rawB = linesB.reduce((sum, line) => sum + line.pts, 0);
  const targetA = Math.max(82, Math.round(rawA + (ratingA.overall - ratingB.overall) * 0.18 + randomBetween(-5, 7)));
  const targetB = Math.max(82, Math.round(rawB + (ratingB.overall - ratingA.overall) * 0.18 + randomBetween(-5, 7)));

  scalePoints(linesA, targetA);
  scalePoints(linesB, targetB);

  const scoreA = linesA.reduce((sum, line) => sum + line.pts, 0);
  const scoreB = linesB.reduce((sum, line) => sum + line.pts, 0);
  linesA.forEach(line => { line.plusMinus = scoreA - scoreB + Math.round(randomBetween(-6, 6)); });
  linesB.forEach(line => { line.plusMinus = scoreB - scoreA + Math.round(randomBetween(-6, 6)); });

  const winner = scoreA === scoreB ? 'OT' : scoreA > scoreB ? 'A' : 'B';
  return {
    scoreA,
    scoreB,
    winner,
    pace,
    teamA: linesA,
    teamB: linesB,
    notes: buildNotes(linesA, linesB, ratingA, ratingB),
  };
}

function simulateLines(players: DreamPlayer[], own: ReturnType<typeof rateTeam>, opp: ReturnType<typeof rateTeam>, pace: number): PlayerLine[] {
  const usageTotal = players.reduce((sum, player) => sum + player.prime.pts + player.prime.ast * 0.8, 0) || 1;
  return players.map(player => {
    const usage = (player.prime.pts + player.prime.ast * 0.8) / usageTotal;
    const defenseTax = 1 - Math.max(-0.1, Math.min(0.12, (opp.defense - own.offense) / 600));
    const pts = Math.max(4, Math.round((player.prime.pts * (0.88 + usage) * defenseTax * pace) / 100 + randomBetween(-4, 5)));
    const reb = Math.max(1, Math.round(player.prime.reb * randomBetween(0.78, 1.22)));
    const ast = Math.max(0, Math.round(player.prime.ast * randomBetween(0.75, 1.25)));
    const stl = Math.max(0, Math.round(player.prime.stl * randomBetween(0.55, 1.55)));
    const blk = Math.max(0, Math.round(player.prime.blk * randomBetween(0.55, 1.55)));
    const tov = Math.max(0, Math.round(player.prime.tov * randomBetween(0.65, 1.4)));
    const fgPct = clamp(player.prime.fgPct + randomBetween(-0.045, 0.045), 0.34, 0.66);
    const fga = Math.max(5, Math.round(pts / Math.max(0.75, fgPct * 2) + randomBetween(0, 5)));
    const fgm = clamp(Math.round(fga * fgPct), 1, fga);
    const fg3a = Math.max(0, Math.round((player.position === 'C' ? fga * 0.16 : fga * 0.34) * randomBetween(0.7, 1.25)));
    const fg3m = clamp(Math.round(fg3a * clamp(player.prime.fg3Pct + randomBetween(-0.05, 0.05), 0.22, 0.48)), 0, fg3a);
    const fta = Math.max(0, Math.round(pts * randomBetween(0.16, 0.34)));
    const ftm = clamp(Math.round(fta * clamp(player.prime.ftPct + randomBetween(-0.04, 0.04), 0.55, 0.94)), 0, fta);

    return {
      player,
      min: Math.round(clamp(player.prime.min + randomBetween(-3, 3), 28, 42)),
      pts,
      reb,
      ast,
      stl,
      blk,
      tov,
      fgm,
      fga,
      fg3m,
      fg3a,
      ftm,
      fta,
      plusMinus: 0,
    };
  });
}

function scalePoints(lines: PlayerLine[], target: number) {
  const current = lines.reduce((sum, line) => sum + line.pts, 0) || 1;
  let remaining = target;
  lines.forEach((line, index) => {
    if (index === lines.length - 1) {
      line.pts = Math.max(0, remaining);
    } else {
      line.pts = Math.max(0, Math.round(line.pts * target / current));
      remaining -= line.pts;
    }
  });
}

function buildNotes(teamA: PlayerLine[], teamB: PlayerLine[], ratingA: ReturnType<typeof rateTeam>, ratingB: ReturnType<typeof rateTeam>) {
  const all = [...teamA, ...teamB];
  const scorer = [...all].sort((a, b) => b.pts - a.pts)[0];
  const passer = [...all].sort((a, b) => b.ast - a.ast)[0];
  const glass = [...all].sort((a, b) => b.reb - a.reb)[0];
  return [
    scorer ? `${scorer.player.name} leads all scorers with ${scorer.pts} points.` : 'Close scoring distribution.',
    passer ? `${passer.player.name} controls playmaking with ${passer.ast} assists.` : 'Balanced playmaking setup.',
    glass ? `${glass.player.name} dominates the boards with ${glass.reb} rebounds.` : 'Shared rebounding effort.',
    ratingA.defense > ratingB.defense ? 'Team A has the stronger defensive profile.' : 'Team B has the stronger defensive profile.',
  ];
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
