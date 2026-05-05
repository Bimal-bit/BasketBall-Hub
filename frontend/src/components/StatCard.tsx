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

const colorMap = {
  orange: 'text-orange-400 bg-orange-500/10',
  blue: 'text-blue-400 bg-blue-500/10',
  green: 'text-green-400 bg-green-500/10',
  red: 'text-red-400 bg-red-500/10',
  yellow: 'text-yellow-400 bg-yellow-500/10',
};

export default function StatCard({ label, value, sub, icon, trend, trendValue, color = 'orange', large }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</span>
        {icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
            {icon}
          </div>
        )}
      </div>
      <div className={`${large ? 'text-3xl' : 'text-2xl'} font-bold text-white mb-1`}>{value}</div>
      <div className="flex items-center gap-2">
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
        {trend && trendValue && (
          <span className={`text-xs font-medium ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
          </span>
        )}
      </div>
    </div>
  );
}
