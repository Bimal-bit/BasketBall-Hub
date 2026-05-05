type Props = {
  data: number[];
  color?: string;
  height?: number;
  showDots?: boolean;
  label?: string;
};

export default function MiniLineChart({ data, color = '#f97316', height = 60, showDots = false, label }: Props) {
  if (!data.length) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = height;
  const pad = 4;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + ((max - v) / range) * (h - pad * 2);
    return `${x},${y}`;
  });

  const polyline = points.join(' ');

  // Fill polygon
  const first = points[0];
  const last = points[points.length - 1];
  const [lastX] = last.split(',');
  const [firstX] = first.split(',');
  const fillPoints = `${firstX},${h} ${polyline} ${lastX},${h}`;

  return (
    <div>
      {label && <div className="text-xs text-gray-400 mb-1">{label}</div>}
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={height} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon
          points={fillPoints}
          fill={`url(#grad-${color.replace('#', '')})`}
        />
        <polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {showDots && data.map((v, i) => {
          const [x, y] = points[i].split(',');
          return (
            <circle key={i} cx={x} cy={y} r="2" fill={color} />
          );
        })}
      </svg>
    </div>
  );
}
