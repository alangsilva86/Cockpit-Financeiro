import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from './Icons';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { IconButton } from './ui/IconButton';
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
  const nextMonthLabel = nextMonthDate.toLocaleDateString('pt-BR', { month: 'long' });

  const nextMonthForecast = useMemo(() => {
    const expenses = transactions.filter((t) => (t.competenceMonth || competenceFromDate(new Date(t.date))) === nextCompetence && t.kind === 'expense');
    const creditByCard = cards.map((card) => {
      const cardTx = expenses.filter((t) => t.paymentMethod === 'credit' && t.cardId === card.id);
      return { card, total: cardTx.reduce((acc, t) => acc + Number(t.amount || 0), 0) };
    });
    const variableSpend = expenses.reduce((acc, t) => acc + Number(t.amount || 0), 0);
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
    <div className="space-y-6 p-4  ">
      
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <div className="flex size-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-500">
          <Icons.Plan size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Planejamento</h2>
          <p className="text-xs text-zinc-500">Defina as regras do jogo.</p>
        </div>
      </div>

      {/* Generate Month Action */}
      <div className="rounded-2xl border border-zinc-700 bg-gradient-to-br from-zinc-800 to-zinc-900 p-4">
        <div className="mb-4 flex gap-2">
          <Icons.Copy className="text-blue-400" size={24} />
          <div>
            <h3 className="font-bold text-white">Gerar Próximo Mês</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Copiar custos fixos e estimativas do mês atual para o próximo. Cria um roteiro inicial.
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          className="w-full gap-2 normal-case"
          onClick={onGenerateNextMonth}
        >
          <Icons.Calendar size={18} />
          Gerar Roteiro de {nextMonthLabel}
        </Button>
        {lastGeneration && (
          <p className="mt-2 text-xs text-blue-200">{lastGeneration}</p>
        )}
      </div>

      {/* Next month forecast */}
      <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Previsão {nextCompetence}</h3>
          <span className="text-xs text-zinc-500">Cartão + variáveis</span>
        </div>
        <div className="space-y-2">
          {nextMonthForecast.creditByCard.map(({ card, total }) => (
            <div key={card.id} className="flex justify-between rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-2 text-sm">
              <span className="text-zinc-300">{card.name}</span>
              <span className="font-mono text-zinc-100">R$ {total.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-zinc-500">
          Variáveis previstas: R$ {nextMonthForecast.variableSpend.toLocaleString()}
        </div>
      </div>

      {/* Caps */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-400">Limites e Tetos</h3>
        <div className="space-y-2">
          <div>
            <label className="text-xs font-bold uppercase text-zinc-400">Renda Recorrente (R$)</label>
            <input 
              type="number" 
              inputMode="decimal"
              value={localIncome}
              onChange={(e) => setLocalIncome(parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs font-bold uppercase text-zinc-400">
              <span>Teto Variável</span>
              <span className="font-mono text-emerald-400">R$ {localVariableCap.toLocaleString()}</span>
            </div>
            <input 
              type="range" 
              min={0} 
              max={Math.max(localIncome, variableCap, 5000)} 
              step={500}
              value={localVariableCap}
              onChange={(e) => setLocalVariableCap(parseFloat(e.target.value) || 0)}
              className="mt-2 w-full accent-emerald-500"
            />
            <p className="mt-1 text-xs text-zinc-500">Use como semáforo do mês (mercado, lazer, compras).</p>
          </div>
          <Button
            variant="secondary"
            className="w-full normal-case"
            onClick={() => onBudgetChange({ monthlyIncome: localIncome, variableCap: localVariableCap })}
          >
            Salvar ajustes
          </Button>
        </div>
      </div>

      {/* Category Management */}
      <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
         <div className="mb-4 flex items-center justify-between">
           <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Categorias de Gasto</h3>
           <IconButton
             aria-label="Adicionar categoria"
             icon={<Icons.Add size={20} />}
             onClick={() => setIsAddingCat(!isAddingCat)}
             className="border border-zinc-800 bg-zinc-950 text-emerald-400 hover:text-white"
           />
         </div>
         
         {isAddingCat && (
           <form onSubmit={handleAddCat} className="mb-4 flex gap-2  ">
             <input 
               autoFocus
               className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
               placeholder="Nova Categoria..."
               value={newCat}
               onChange={e => setNewCat(e.target.value)}
             />
             <Button type="submit" variant="secondary" className="text-sm normal-case">
               OK
             </Button>
           </form>
         )}

         <div className="flex flex-wrap gap-2">
           {categories.map((cat) => (
             <Chip key={cat} label={cat} />
           ))}
         </div>
         <p className="mt-2 text-xs text-zinc-600">A IA usará estas categorias para classificar novos gastos automaticamente.</p>
      </div>
      
      <p className="mt-8 text-center text-xs text-zinc-600">
        &ldquo;O plano é nada, o planejamento é tudo.&rdquo;
      </p>
    </div>
  );
};
