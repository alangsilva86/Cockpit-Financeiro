import React from 'react';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  tone?: 'emerald' | 'blue' | 'rose' | 'amber' | 'zinc';
  progress?: number;
  footer?: string;
}

const progressToneMap = {
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  zinc: 'bg-zinc-500',
};

export const KpiCard: React.FC<KpiCardProps> = ({ title, value, subtitle, tone = 'zinc', progress, footer }) => (
  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
    <p className="text-[10px] uppercase tracking-widest text-zinc-500">{title}</p>
    <div className="mt-1 text-xl font-bold text-white">{value}</div>
    {subtitle && <div className="text-[10px] text-zinc-500 mt-1">{subtitle}</div>}
    {typeof progress === 'number' && (
      <div className="mt-3">
        <div className="h-1.5 rounded-full bg-zinc-800">
          <div
            className={`h-1.5 rounded-full ${progressToneMap[tone]}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
        {footer && <div className="mt-1 text-[10px] text-zinc-500">{footer}</div>}
      </div>
    )}
  </div>
);
