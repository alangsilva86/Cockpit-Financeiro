import React from 'react';
import { Icons } from '../Icons';

interface BottomSheetModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({ open, title, onClose, children, actions }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <button
        aria-label="Fechar"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-t-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-white">{title}</div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <Icons.Close size={16} />
          </button>
        </div>
        <div className="mt-4 space-y-2 text-sm text-zinc-300">{children}</div>
        {actions && <div className="mt-4 flex gap-2">{actions}</div>}
      </div>
    </div>
  );
};
