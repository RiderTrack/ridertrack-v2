import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export interface KPIStatCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  periodText?: string;
  icon: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  progressPercent?: number;
  progressColor?: string;
  onClick?: () => void;
}

export const KPIStatCard: React.FC<KPIStatCardProps> = ({
  title,
  value,
  change,
  trend = 'up',
  periodText = 'vs ayer',
  icon,
  iconBgColor = 'bg-blue-500/10',
  iconColor = 'text-blue-400',
  progressPercent,
  progressColor = 'bg-blue-500',
  onClick,
}) => {
  const trendColor =
    trend === 'up'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : trend === 'down'
      ? 'text-red-400 bg-red-500/10 border-red-500/20'
      : 'text-slate-400 bg-slate-700/50 border-slate-600/50';

  const TrendIcon =
    trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;

  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-xl backdrop-blur-md transition-all duration-200 ${
        onClick ? 'hover:-translate-y-1 hover:border-blue-500/50 cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`p-3 rounded-xl ${iconBgColor} ${iconColor} shrink-0`}>
          {icon}
        </div>

        {change && (
          <span
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ${trendColor}`}
          >
            <TrendIcon className="w-3 h-3" />
            {change}
          </span>
        )}
      </div>

      <div className="mt-4">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
          {title}
        </span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {value}
          </span>
          {periodText && (
            <span className="text-[11px] text-slate-400 font-medium">
              {periodText}
            </span>
          )}
        </div>
      </div>

      {progressPercent !== undefined && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1">
          <div className="flex justify-between text-[10px] font-semibold text-slate-400">
            <span>Rendimiento de Meta</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
