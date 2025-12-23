import React from 'react';
import { Icons } from './Icons';

interface PlanningProps {
  onGenerateNextMonth: () => void;
  variableCap: number;
}

export const Planning: React.FC<PlanningProps> = ({ onGenerateNextMonth, variableCap }) => {
  return (
    <div className="p-4 space-y-6 animate-in fade-in">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-500">
          <Icons.Plan size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Planejamento</h2>
          <p className="text-xs text-zinc-500">Defina as regras do jogo.</p>
        </div>
      </div>

      {/* Generate Month Action */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 p-5 rounded-2xl border border-zinc-700">
        <div className="flex gap-3 mb-4">
          <Icons.Copy className="text-blue-400" size={24} />
          <div>
            <h3 className="text-white font-bold">Gerar Próximo Mês</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Copiar custos fixos e estimativas do mês atual para o próximo. Cria um roteiro inicial.
            </p>
          </div>
        </div>
        <button 
          onClick={onGenerateNextMonth}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Icons.Calendar size={18} />
          Gerar Roteiro de Fevereiro
        </button>
      </div>

      {/* Caps */}
      <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800">
        <h3 className="text-zinc-400 text-sm font-bold uppercase tracking-wider mb-4">Limites e Tetos</h3>
        
        <div className="flex justify-between items-center py-2 border-b border-zinc-800">
           <span className="text-zinc-200">Teto Variável (Lazer/Mercado)</span>
           <span className="font-mono text-emerald-400 font-bold">R$ {variableCap.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center py-2 pt-4">
           <span className="text-zinc-200">Renda Recorrente</span>
           <span className="font-mono text-white font-bold">R$ 25.000</span>
        </div>
      </div>
      
      <p className="text-center text-xs text-zinc-600 mt-8">
        "O plano é nada, o planejamento é tudo."
      </p>
    </div>
  );
};