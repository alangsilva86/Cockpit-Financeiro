import React from 'react';
import { Icons } from '../Icons';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, actionLabel, onAction }) => (
  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
    <Icons.Alert className="mx-auto mb-2 opacity-50" size={28} />
    <p className="text-sm font-semibold text-zinc-200">{title}</p>
    {description && <p className="mt-1 text-xs text-zinc-500">{description}</p>}
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="mt-3 rounded-full border border-emerald-500/40 px-4 py-2 text-[10px] font-bold text-emerald-300 hover:text-white"
      >
        {actionLabel}
      </button>
    )}
  </div>
);
