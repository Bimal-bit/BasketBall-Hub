type Bar = {
  label: string;
  value: number;
  color?: string;
  secondaryValue?: number;
  secondaryColor?: string;
};

type Props = {
  bars: Bar[];
  maxValue?: number;
  height?: number;
  showValues?: boolean;
  horizontal?: boolean;
};

export default function BarChart({ bars, maxValue, height = 160, showValues = true, horizontal = false }: Props) {
  const max = maxValue ?? Math.max(...bars.map(b => Math.max(b.value, b.secondaryValue ?? 0)));

  if (horizontal) {
    return (
      <div className="space-y-2">
        {bars.map((bar, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="text-xs text-gray-400 w-20 text-right flex-shrink-0 truncate">{bar.label}</div>
            <div className="flex-1 flex items-center gap-1">
              <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all duration-700 ease-out"
                  style={{
                    width: `${(bar.value / max) * 100}%`,
                    backgroundColor: bar.color ?? '#f97316',
                  }}
                />
              </div>
              {showValues && (
                <span className="text-xs text-white font-medium w-10">{bar.value}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {bars.map((bar, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex gap-0.5 items-end" style={{ height: height - 20 }}>
            <div
              className="flex-1 rounded-t transition-all duration-700 ease-out"
              style={{
                height: `${(bar.value / max) * 100}%`,
                backgroundColor: bar.color ?? '#f97316',
                minHeight: 2,
              }}
            />
            {bar.secondaryValue !== undefined && (
              <div
                className="flex-1 rounded-t transition-all duration-700 ease-out"
                style={{
                  height: `${(bar.secondaryValue / max) * 100}%`,
                  backgroundColor: bar.secondaryColor ?? '#3b82f6',
                  minHeight: 2,
                }}
              />
            )}
          </div>
          <div className="text-xs text-gray-500 truncate w-full text-center" style={{ fontSize: '10px' }}>
            {bar.label}
          </div>
        </div>
      ))}
    </div>
  );
}
