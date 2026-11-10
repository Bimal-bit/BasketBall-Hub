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

export default function ShotChart({ shots, compact = false }: Props) {
  const made = shots.filter(s => s.made).length;
  const pct = shots.length ? Math.round((made / shots.length) * 100) : 0;

  if (!shots.length) {
    return <p className="py-8 text-center text-sm text-gray-500">Shot chart data is unavailable for this game.</p>;
  }

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox="0 0 100 110" className="w-full h-auto max-w-[280px] sm:max-w-[320px] mx-auto block">
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
        {shots.map((shot, i) => (
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
        <text x="72" y="9" fontSize="3.5" fill="#9ca3af">{made}/{shots.length} ({pct}%)</text>
      </svg>
    </div>
  );
}
