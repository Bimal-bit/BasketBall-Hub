type Shot = {
  x: number;
  y: number;
  made: boolean;
  distance: number;
};

type Props = {
  shots: Shot[];
  compact?: boolean;
};

function generateCourtShots(playerShotPct: number, count = 60): Shot[] {
  const shots: Shot[] = [];
  const zones = [
    { x: 50, y: 85, spread: 5, freq: 0.2, distBase: 3 },   // paint
    { x: 30, y: 68, spread: 8, freq: 0.12, distBase: 12 },  // left mid
    { x: 70, y: 68, spread: 8, freq: 0.12, distBase: 12 },  // right mid
    { x: 50, y: 60, spread: 6, freq: 0.1, distBase: 15 },   // top of key
    { x: 10, y: 80, spread: 4, freq: 0.08, distBase: 22 },  // left corner 3
    { x: 90, y: 80, spread: 4, freq: 0.08, distBase: 22 },  // right corner 3
    { x: 25, y: 45, spread: 8, freq: 0.12, distBase: 24 },  // left wing 3
    { x: 75, y: 45, spread: 8, freq: 0.12, distBase: 24 },  // right wing 3
    { x: 50, y: 38, spread: 6, freq: 0.08, distBase: 27 },  // top 3
  ];

  for (let i = 0; i < count; i++) {
    const zone = zones[Math.floor(Math.random() * zones.length)];
    const x = Math.max(2, Math.min(98, zone.x + (Math.random() - 0.5) * zone.spread * 2));
    const y = Math.max(2, Math.min(98, zone.y + (Math.random() - 0.5) * zone.spread * 2));
    const dist = zone.distBase + (Math.random() - 0.5) * 3;
    const madeProb = dist > 22 ? playerShotPct * 0.85 : playerShotPct;
    shots.push({ x, y, made: Math.random() < madeProb / 100, distance: Math.round(dist) });
  }
  return shots;
}

export default function ShotChart({ shots, compact = false }: Props) {
  const displayShots = shots.length > 0 ? shots : generateCourtShots(46, compact ? 40 : 65);
  const made = displayShots.filter(s => s.made).length;
  const pct = Math.round((made / displayShots.length) * 100);

  const h = compact ? 180 : 260;
  const w = 100;

  return (
    <div>
      <svg viewBox="0 0 100 110" width="100%" height={h} className="block">
        {/* Court background */}
        <rect x="0" y="0" width="100" height="110" fill="#111827" rx="4" />

        {/* Court outline */}
        <rect x="5" y="5" width="90" height="100" fill="none" stroke="#374151" strokeWidth="0.5" rx="2" />

        {/* Paint / key */}
        <rect x="35" y="72" width="30" height="30" fill="none" stroke="#374151" strokeWidth="0.5" />
        <rect x="40" y="72" width="20" height="18" fill="rgba(55,65,81,0.3)" stroke="#374151" strokeWidth="0.5" />

        {/* Basket */}
        <circle cx="50" cy="95" r="2" fill="none" stroke="#6b7280" strokeWidth="0.8" />
        <line x1="50" y1="93" x2="50" y2="72" stroke="#374151" strokeWidth="0.4" />

        {/* Three point arc */}
        <path
          d="M 14 95 L 14 75 A 37 37 0 0 1 86 75 L 86 95"
          fill="none" stroke="#374151" strokeWidth="0.5"
        />

        {/* Free throw circle */}
        <ellipse cx="50" cy="72" rx="10" ry="8" fill="none" stroke="#374151" strokeWidth="0.4" />

        {/* Shot dots */}
        {displayShots.map((shot, i) => (
          <circle
            key={i}
            cx={shot.x}
            cy={shot.y}
            r={compact ? 1.6 : 1.8}
            fill={shot.made ? '#22c55e' : '#ef4444'}
            fillOpacity="0.75"
            stroke={shot.made ? '#16a34a' : '#dc2626'}
            strokeWidth="0.3"
          />
        ))}

        {/* Legend */}
        <circle cx="10" cy="7" r="1.5" fill="#22c55e" />
        <text x="13" y="9" fontSize="3.5" fill="#9ca3af">Made</text>
        <circle cx="30" cy="7" r="1.5" fill="#ef4444" />
        <text x="33" y="9" fontSize="3.5" fill="#9ca3af">Missed</text>
        <text x="72" y="9" fontSize="3.5" fill="#9ca3af">{made}/{displayShots.length} ({pct}%)</text>
      </svg>
    </div>
  );
}
