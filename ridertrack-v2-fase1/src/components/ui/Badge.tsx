import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate' | 'cyan';
  size?: 'sm' | 'md';
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'blue',
  size = 'md',
  dot = false,
  pulse = false,
  className = '',
}) => {
  const variantStyles = {
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    red: 'bg-red-500/15 text-red-400 border-red-500/30',
    purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    slate: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
    cyan: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  }[variant];

  const dotColors = {
    blue: 'bg-blue-400',
    green: 'bg-emerald-400',
    amber: 'bg-amber-400',
    red: 'bg-red-400',
    purple: 'bg-purple-400',
    slate: 'bg-slate-400',
    cyan: 'bg-cyan-400',
  }[variant];

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-0.5 text-xs',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-full border tracking-wide whitespace-nowrap ${variantStyles} ${sizeStyles} ${className}`}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {pulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColors}`}
            ></span>
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColors}`}></span>
        </span>
      )}
      {children}
    </span>
  );
};
