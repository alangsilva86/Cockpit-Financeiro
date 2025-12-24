import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from './Icons';
import { Card, Transaction } from '../types';

interface PlanningProps {
  onGenerateNextMonth: () => void;
  variableCap: number;
  monthlyIncome: number;
  categories: string[];
  onAddCategory: (cat: string) => void;
  onBudgetChange: (payload: { monthlyIncome?: number; variableCap?: number }) => void;
  lastGeneration?: string | null;
  transactions: Transaction[];
  cards: Card[];
}

export const Planning: React.FC<PlanningProps> = ({ onGenerateNextMonth, variableCap, monthlyIncome, categories, onAddCategory, onBudgetChange, lastGeneration, transactions, cards }) => {
  const [newCat, setNewCat] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [localIncome, setLocalIncome] = useState(monthlyIncome);
  const [localVariableCap, setLocalVariableCap] = useState(variableCap);
  const nextMonthDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  }, []);

  const competenceFromDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const nextCompetence = competenceFromDate(nextMonthDate);

  const nextMonthForecast = useMemo(() => {
    const expenses = transactions.filter((t) => (t.competenceMonth || competenceFromDate(new Date(t.date))) === nextCompetence && t.kind === 'expense');
    const creditByCard = cards.map((card) => {
      const cardTx = expenses.filter((t) => t.paymentMethod === 'credit' && t.cardId === card.id);
      return { card, total: cardTx.reduce((acc, t) => acc + t.amount, 0) };
    });
    const variableSpend = expenses.reduce((acc, t) => acc + t.amount, 0);
    return { creditByCard, variableSpend };
  }, [transactions, cards, nextCompetence]);

  const handleAddCat = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCat.trim()) {
      onAddCategory(newCat.trim());
      setNewCat('');
      setIsAddingCat(false);
    }
  };

  useEffect(() => {
    setLocalIncome(monthlyIncome);
    setLocalVariableCap(variableCap);
  }, [monthlyIncome, variableCap]);

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
        {lastGeneration && (
          <p className="text-[10px] text-blue-200 mt-2">{lastGeneration}</p>
        )}
      </div>

      {/* Next month forecast */}
      <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-zinc-400 text-sm font-bold uppercase tracking-wider">Previsão {nextCompetence}</h3>
          <span className="text-[10px] text-zinc-500">Cartão + variáveis</span>
        </div>
        <div className="space-y-2">
          {nextMonthForecast.creditByCard.map(({ card, total }) => (
            <div key={card.id} className="flex justify-between text-sm bg-zinc-950/50 border border-zinc-800 rounded-lg px-3 py-2">
              <span className="text-zinc-300">{card.name}</span>
              <span className="font-mono text-zinc-100">R$ {total.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-zinc-500">
          Variáveis previstas: R$ {nextMonthForecast.variableSpend.toLocaleString()}
        </div>
      </div>

      {/* Caps */}
      <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800">
        <h3 className="text-zinc-400 text-sm font-bold uppercase tracking-wider mb-4">Limites e Tetos</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 uppercase font-bold">Renda Recorrente (R$)</label>
            <input 
              type="number" 
              value={localIncome}
              onChange={(e) => setLocalIncome(parseFloat(e.target.value) || 0)}
              className="w-full bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-white mt-1 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-zinc-400 uppercase font-bold">
              <span>Teto Variável</span>
              <span className="text-emerald-400 font-mono">R$ {localVariableCap.toLocaleString()}</span>
            </div>
            <input 
              type="range" 
              min={0} 
              max={Math.max(localIncome, variableCap, 5000)} 
              step={500}
              value={localVariableCap}
              onChange={(e) => setLocalVariableCap(parseFloat(e.target.value) || 0)}
              className="w-full mt-2 accent-emerald-500"
            />
            <p className="text-[10px] text-zinc-500 mt-1">Use como semáforo do mês (mercado, lazer, compras).</p>
          </div>
          <button 
            onClick={() => onBudgetChange({ monthlyIncome: localIncome, variableCap: localVariableCap })}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
          >
            Salvar ajustes
          </button>
        </div>
      </div>

      {/* Category Management */}
      <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800">
         <div className="flex justify-between items-center mb-4">
           <h3 className="text-zinc-400 text-sm font-bold uppercase tracking-wider">Categorias de Gasto</h3>
           <button 
             onClick={() => setIsAddingCat(!isAddingCat)} 
             className="text-emerald-500 hover:text-emerald-400"
           >
             <Icons.Add size={20} />
           </button>
         </div>
         
         {isAddingCat && (
           <form onSubmit={handleAddCat} className="flex gap-2 mb-4 animate-in fade-in">
             <input 
               autoFocus
               className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
               placeholder="Nova Categoria..."
               value={newCat}
               onChange={e => setNewCat(e.target.value)}
             />
             <button type="submit" className="bg-emerald-600 text-white px-4 rounded-lg font-bold text-sm">OK</button>
           </form>
         )}

         <div className="flex flex-wrap gap-2">
           {categories.map(cat => (
             <span key={cat} className="px-3 py-1 bg-zinc-800 text-zinc-300 text-xs rounded-full border border-zinc-700">
               {cat}
             </span>
           ))}
         </div>
         <p className="text-[10px] text-zinc-600 mt-3">A IA usará estas categorias para classificar novos gastos automaticamente.</p>
      </div>
      
      <p className="text-center text-xs text-zinc-600 mt-8">
        "O plano é nada, o planejamento é tudo."
      </p>
    </div>
  );
};
