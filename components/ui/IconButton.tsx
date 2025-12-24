import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  size?: number;
  'aria-label': string;
}

export const IconButton: React.FC<IconButtonProps> = ({ icon, size = 20, className = '', ...rest }) => (
  <button
    type={rest.type || 'button'}
    data-ui="icon-button"
    className={`inline-flex h-12 w-12 items-center justify-center rounded-full border border-transparent bg-zinc-900/50 text-zinc-300 transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-emerald-500/50 ${className}`}
    {...rest}
  >
    {typeof icon === 'string' ? <span>{icon}</span> : icon}
  </button>
);
