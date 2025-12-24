import React from 'react';
import { Chip } from './Chip';
import { Button } from './Button';

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
        <Chip key={chip.id} label={chip.label} removable onRemove={chip.onRemove} />
      ))}
      <Button variant="ghost" onClick={onClear} className="h-12 px-4">
        Limpar
      </Button>
    </div>
  );
};
