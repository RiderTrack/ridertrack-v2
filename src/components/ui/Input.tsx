import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  rightElement,
  className = '',
  ...props
}) => {
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="block text-xs font-bold text-slate-300">
          {label}
        </label>
      )}
      <div className="relative flex items-center w-full">
        {icon && <div className="absolute left-3.5 text-slate-400 pointer-events-none">{icon}</div>}
        <input
          className={`w-full py-2 text-xs rounded-xl bg-slate-900 border text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
            icon ? 'pl-10' : 'pl-3.5'
          } ${rightElement ? 'pr-12' : 'pr-3.5'} ${
            error ? 'border-red-500/80 focus:border-red-500' : 'border-slate-700/80 focus:border-blue-500/80'
          } ${className}`}
          {...props}
        />
        {rightElement && <div className="absolute right-3 text-slate-400">{rightElement}</div>}
      </div>
      {error && <p className="text-[11px] font-semibold text-red-400">{error}</p>}
    </div>
  );
};
