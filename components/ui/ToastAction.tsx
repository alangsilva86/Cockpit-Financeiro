import React from 'react';

interface ToastActionProps {
  message: string;
  type?: 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export const ToastAction: React.FC<ToastActionProps> = ({
  message,
  type = 'success',
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}) => {
  const baseTone =
    type === 'error'
      ? 'bg-rose-500/10 border-rose-500/40 text-rose-100'
      : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-100';

  return (
    <div className={`flex items-center justify-between gap-2 rounded-xl border p-4 text-sm shadow-2xl ${baseTone}`}>
      <span className="flex-1">{message}</span>
      <div className="flex items-center gap-2">
        {secondaryLabel && onSecondary && (
          <button onClick={onSecondary} className="text-[10px] font-bold text-zinc-200 hover:text-white">
            {secondaryLabel}
          </button>
        )}
        {actionLabel && onAction && (
          <button onClick={onAction} className="text-[10px] font-bold text-white underline">
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};
