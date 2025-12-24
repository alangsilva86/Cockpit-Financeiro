import React from 'react';
import { Icons } from '../Icons';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-emerald-600 text-white border border-emerald-500/40 hover:bg-emerald-500 focus-visible:ring-3 focus-visible:ring-emerald-500/60',
  secondary: 'bg-zinc-900 text-zinc-100 border border-zinc-800 hover:border-emerald-500/40 hover:text-white focus-visible:ring-3 focus-visible:ring-emerald-500/40',
  ghost: 'bg-transparent text-zinc-300 border border-transparent hover:text-white focus-visible:ring-3 focus-visible:ring-emerald-500/40',
  destructive: 'bg-rose-500 text-white border border-rose-500/50 hover:bg-rose-400 focus-visible:ring-3 focus-visible:ring-rose-400/40',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  loading,
  disabled,
  children,
  className = '',
  fullWidth,
  ...rest
}) => {
  return (
    <button
      type={rest.type || 'button'}
      disabled={disabled || loading}
      data-ui="button"
      className={`h-12 relative flex items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold uppercase tracking-wide transition ${variantStyles[variant]} ${fullWidth ? 'w-full' : ''} ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
      {...rest}
    >
      {loading && (
        <Icons.Loader className="animate-spin text-current" size={16} />
      )}
      <span className={`${loading ? 'opacity-60' : ''}`}>{children}</span>
    </button>
  );
};
