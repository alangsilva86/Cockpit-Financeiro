import React from 'react';
import { Icons } from '../Icons';

interface FilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

interface FilterChipsProps {
  chips: FilterChip[];
  onClear: () => void;
}

export const FilterChips: React.FC<FilterChipsProps> = ({ chips, onClear }) => {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.id}
          onClick={chip.onRemove}
          className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-[10px] font-bold text-zinc-300 hover:text-white"
        >
          {chip.label}
          <Icons.Close size={12} />
        </button>
      ))}
      <button
        onClick={onClear}
        className="rounded-full border border-emerald-500/40 px-3 py-1 text-[10px] font-bold text-emerald-300 hover:text-white"
      >
        Limpar
      </button>
    </div>
  );
};
