import React from 'react';
import { Icons } from '../Icons';

interface SetupStep {
  id: string;
  label: string;
  done: boolean;
  ctaLabel: string;
  onClick: () => void;
}

interface SetupProgressCardProps {
  steps: SetupStep[];
  onSeedDemo: () => void;
  onDismiss?: () => void;
  isComplete: boolean;
}

export const SetupProgressCard: React.FC<SetupProgressCardProps> = ({ steps, onSeedDemo, onDismiss, isComplete }) => {
  const doneCount = steps.filter((step) => step.done).length;
  const total = steps.length;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Setup inicial</p>
          <h3 className="text-lg font-bold text-white">Conclua 3 passos para começar</h3>
          <p className="text-xs text-zinc-400 mt-1">{doneCount}/{total} concluído{doneCount === 1 ? '' : 's'}</p>
        </div>
        {isComplete && onDismiss && (
          <button onClick={onDismiss} className="text-zinc-500 hover:text-white">
            <Icons.Close size={16} />
          </button>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center justify-between rounded-xl border border-zinc-800/70 bg-zinc-950/50 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${step.done ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-zinc-700 text-zinc-500'}`}>
                {step.done ? <Icons.Check size={12} /> : <Icons.Clock size={12} />}
              </span>
              <span className="text-xs font-semibold text-zinc-200">{step.label}</span>
            </div>
            {!step.done && (
              <button
                onClick={step.onClick}
                className="text-[10px] font-bold text-emerald-400 hover:text-white"
              >
                {step.ctaLabel}
              </button>
            )}
            {step.done && <span className="text-[10px] text-emerald-400">OK</span>}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={onSeedDemo}
          className="flex-1 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-[10px] font-bold text-blue-200 hover:text-white"
        >
          Iniciar com dados demo
        </button>
      </div>
    </div>
  );
};
