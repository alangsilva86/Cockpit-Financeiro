import React from 'react';
import { IconButton } from './IconButton';
import { Icons } from '../Icons';

interface ChipProps {
  label: string;
  selected?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
}

export const Chip: React.FC<ChipProps> = ({ label, selected = false, removable = false, onRemove, onClick }) => (
  <div
    role={onClick ? 'button' : undefined}
    onClick={onClick}
    data-ui="chip"
    className={`flex items-center gap-2 rounded-full border px-4 text-[10px] font-bold transition ${selected ? 'border-emerald-500 bg-emerald-500/10 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-300'} ${onClick ? 'cursor-pointer' : ''} h-12`}
  >
    <span>{label}</span>
    {removable && onRemove && (
      <IconButton
        aria-label={`Remover filtro ${label}`}
        icon={<Icons.Close size={16} />}
        className="border-transparent bg-transparent text-zinc-400 hover:text-emerald-400"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      />
    )}
  </div>
);
