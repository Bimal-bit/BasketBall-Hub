import { ReactNode } from 'react';

type Props = {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'orange' | 'blue' | 'green' | 'red' | 'yellow';
  large?: boolean;
};

export default function StatCard({ label, value, sub, icon, trend, trendValue }: Props) {
  const isPositive = trend === 'up';
  const isNegative = trend === 'down';
  
  return (
    <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-3 border border-zinc-200/50 dark:border-zinc-700/50 transition-colors flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1 gap-2">
          <span className="text-[11px] text-zinc-500 font-medium truncate">{label}</span>
          {icon && (
            <div className="text-zinc-400 dark:text-zinc-500 shrink-0">
              {icon}
            </div>
          )}
        </div>
        <div className="text-[22px] font-medium text-zinc-900 dark:text-white leading-tight">
          {value}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        {trend && trendValue && (
          <span className={`text-[11px] font-medium ${isPositive ? 'text-green-700' : isNegative ? 'text-red-600' : 'text-zinc-500'}`}>
            {isPositive ? '↑' : isNegative ? '↓' : '→'} {trendValue}
          </span>
        )}
        {sub && <span className="text-[10px] text-zinc-400 truncate">{sub}</span>}
      </div>
    </div>
  );
}
