import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  hoverable = false,
  padding = 'md',
  header,
  footer,
  className = '',
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3.5',
    md: 'p-5',
    lg: 'p-6',
  }[padding];

  const hoverStyles = hoverable
    ? 'hover:-translate-y-0.5 hover:border-slate-600/80 hover:shadow-2xl transition-all duration-200 cursor-pointer'
    : '';

  return (
    <div
      className={`rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-xl backdrop-blur-md overflow-hidden ${hoverStyles} ${className}`}
      {...props}
    >
      {header && <div className="px-5 py-3.5 border-b border-slate-700/80 bg-slate-900/40">{header}</div>}
      <div className={paddingStyles}>{children}</div>
      {footer && <div className="px-5 py-3 border-t border-slate-700/80 bg-slate-900/30">{footer}</div>}
    </div>
  );
};
