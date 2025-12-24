import React, { useMemo } from 'react';
import { AppState, OperationType, Transaction } from '../types';
import { Icons } from './Icons';

interface DashboardProps {
  state: AppState;
  onToggleStatus: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ state, onToggleStatus }) => {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // 1. Filter Current Month Data
  const monthData = useMemo(() => {
    return state.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [state.transactions, currentMonth, currentYear]);

  // 2. Calculate Big Numbers (Forecast based)
  const totals = useMemo(() => {
    // Income Logic: Recurring (Static) + Realized Extra (Receitas)
    const realizedIncome = monthData
        .filter(t => t.type === OperationType.RECEITA)
        .reduce((acc, t) => acc + t.amount, 0);

    const totalIncome = state.monthlyIncome + realizedIncome;
    
    // Total Expenses (Life + Interest) - Planned + Paid
    const expensesLife = monthData
      .filter(t => t.type === OperationType.VIDA)
      .reduce((acc, t) => acc + t.amount, 0);

    const expensesBurn = monthData
      .filter(t => t.type === OperationType.JUROS)
      .reduce((acc, t) => acc + t.amount, 0);

    // Variable Spend Calculation (Mock logic based on Categories for now, ideally strictly typed)
    // Assuming 'Alimentação', 'Lazer', 'Compras', 'Uber', 'Transporte' are variable for the Semaphore
    const variableCategories = ['Alimentação', 'Lazer', 'Compras', 'Transporte', 'Restaurante'];
    const spentVariable = monthData
      .filter(t => t.type === OperationType.VIDA && variableCategories.some(c => t.category.includes(c)))
      .reduce((acc, t) => acc + t.amount, 0);

    // Safe Balance: Income - (Life + Burn)
    const safeBalance = totalIncome - (expensesLife + expensesBurn);

    return { totalIncome, expensesLife, expensesBurn, safeBalance, spentVariable };
  }, [monthData, state.monthlyIncome]);

  // 3. Card Projections
  const cardProjection = useMemo(() => {
    const cardTx = monthData.filter(t => 
      t.description.toLowerCase().includes('fatura') || 
      t.category.toLowerCase().includes('cartão')
    );
    const totalEstimated = cardTx.reduce((acc, t) => acc + t.amount, 0);
    const paidSoFar = cardTx.filter(t => t.status === 'paid').reduce((acc, t) => acc + t.amount, 0);
    
    return { totalEstimated, paidSoFar };
  }, [monthData]);

  const getStatusColor = (type: OperationType) => {
    switch (type) {
      case OperationType.RECEITA: return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
      case OperationType.VIDA: return 'text-blue-400 border-blue-400/30 bg-blue-400/10';
      case OperationType.DIVIDA: return 'text-indigo-400 border-indigo-400/30 bg-indigo-400/10';
      case OperationType.JUROS: return 'text-rose-500 border-rose-500/30 bg-rose-500/10';
      case OperationType.ROLAGEM: return 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10';
      case OperationType.INVESTIMENTO: return 'text-purple-400 border-purple-400/30 bg-purple-400/10';
      default: return 'text-zinc-400';
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return {
      day: date.getDate(),
      weekday: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
    };
  };

  // Semaphore Logic
  const capPercentage = Math.min((totals.spentVariable / state.variableCap) * 100, 100);
  const semaphoreColor = capPercentage < 75 ? 'bg-emerald-500' : capPercentage < 100 ? 'bg-amber-400' : 'bg-rose-600';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* 1. TOP HEADER: Safe Balance & Semaphore */}
      <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-900 sticky top-0 z-20 backdrop-blur-md bg-opacity-95 shadow-2xl shadow-black/50">
        
        {/* The Semaphore (Health Bar) */}
        <div className="w-full h-1 bg-zinc-800">
          <div 
            className={`h-full ${semaphoreColor} transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)]`} 
            style={{ width: `${capPercentage}%` }}
          />
        </div>

        <div className="px-6 pt-4 pb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-2">
                Saldo Seguro 
                {totals.safeBalance < 0 && <span className="text-rose-500 animate-pulse">● CRÍTICO</span>}
              </span>
              <div className={`text-3xl font-bold mt-1 tracking-tight ${totals.safeBalance >= 0 ? 'text-white' : 'text-rose-500'}`}>
                R$ {totals.safeBalance.toLocaleString()}
              </div>
              <div className="flex items-center gap-2 mt-1">
                 <span className="text-[10px] text-zinc-500">Teto Variável: {Math.round(capPercentage)}%</span>
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
               <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold bg-emerald-400/5 px-2 py-1 rounded-md border border-emerald-400/10">
                  <Icons.Income size={10} /> +{totals.totalIncome.toLocaleString()}
               </div>
               <div className="flex items-center gap-1 text-rose-400 text-[10px] font-bold bg-rose-400/5 px-2 py-1 rounded-md border border-rose-400/10">
                  <Icons.Burn size={10} /> -{totals.expensesBurn.toLocaleString()}
               </div>
            </div>
          </div>

          {/* 2. CARD PROJECTION WIDGET - Compact */}
          <div className="bg-zinc-800/40 rounded-lg p-2 border border-zinc-700/30 flex justify-between items-center">
            <div className="flex gap-2 items-center">
              <div className="bg-zinc-900 p-1.5 rounded text-zinc-400">
                <Icons.Debts size={14} />
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block uppercase">Faturas (Est.)</span>
                <span className="text-xs font-bold text-white">R$ {cardProjection.totalEstimated.toLocaleString()}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 block">Pago</span>
              <span className="text-xs text-zinc-300">R$ {cardProjection.paidSoFar.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. THE TIMELINE (MEU MÊS) */}
      <div className="px-4">
        <h3 className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-4 px-2">Linha do Tempo</h3>
        
        <div className="relative border-l border-zinc-800 ml-3 space-y-8">
          {monthData.map((item) => {
            const { day, weekday } = formatDate(item.date);
            const isPaid = item.status === 'paid';
            const isPast = new Date(item.date) < new Date() && !isPaid;
            const isIncome = item.type === OperationType.RECEITA;

            return (
              <div key={item.id} className="relative pl-6 group">
                {/* Timeline Dot */}
                <div 
                  className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 transition-all duration-300 z-10
                    ${isPaid ? 'bg-zinc-700 border-zinc-800' : isIncome ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]' : isPast ? 'bg-rose-500 animate-pulse' : 'bg-zinc-500'}`}
                />

                {/* Card Content */}
                <div className={`flex justify-between items-start transition-all duration-300 ${isPaid ? 'opacity-40 grayscale' : 'opacity-100'}`}>
                  
                  {/* Left: Date & Description */}
                  <div className="flex gap-3">
                     <div className="flex flex-col items-center min-w-[30px] pt-0.5">
                        <span className={`text-sm font-bold ${isPaid ? 'text-zinc-600' : 'text-zinc-300'}`}>{day}</span>
                        <span className="text-[9px] text-zinc-600 uppercase">{weekday}</span>
                     </div>
                     <div>
                        <p className={`text-sm font-medium leading-tight ${isPaid ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                          {item.description}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          <span className={`text-[9px] px-1.5 py-px rounded border ${getStatusColor(item.type)}`}>
                            {item.type}
                          </span>
                          <span className="text-[10px] text-zinc-600 truncate max-w-[100px] py-px">
                            {item.category}
                          </span>
                        </div>
                     </div>
                  </div>

                  {/* Right: Amount & Action */}
                  <div className="text-right flex flex-col items-end">
                    <span className={`font-mono font-bold text-sm tracking-tight ${isIncome ? 'text-emerald-400' : item.type === OperationType.ROLAGEM ? 'text-zinc-500' : 'text-zinc-100'}`}>
                      {isIncome ? '+' : ''} {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    
                    <button 
                      onClick={() => onToggleStatus(item.id)}
                      className={`mt-2 flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full transition-colors border
                        ${isPaid 
                          ? 'bg-transparent border-zinc-800 text-zinc-600' 
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20'}`}
                    >
                      {isPaid ? <Icons.Check size={10}/> : null}
                      {isPaid ? 'PAGO' : 'CONFIRMAR'}
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
          
          {monthData.length === 0 && (
             <div className="pl-6 text-zinc-500 text-sm italic">
               Nenhum lançamento para este mês. Vá em "Plano" para gerar.
             </div>
          )}
        </div>
      </div>
    </div>
  );
};