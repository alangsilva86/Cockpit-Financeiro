import React from 'react';

interface BottomNavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
}

export const BottomNavItem: React.FC<BottomNavItemProps> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex h-14 w-full flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest transition ${active ? 'text-emerald-400' : 'text-zinc-500 hover:text-emerald-300'} ${active ? 'bg-zinc-900/80 border border-emerald-500/20' : 'border border-transparent'}`}
  >
    <Icon size={20} />
    <span>{label}</span>
  </button>
);
