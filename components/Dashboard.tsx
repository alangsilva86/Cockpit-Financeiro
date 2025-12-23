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
    // Total Income (Recurrent + Extras)
    const income = state.monthlyIncome; 
    
    // Total Expenses (Life + Interest) - Planned + Paid
    const expensesLife = monthData
      .filter(t => t.type === OperationType.VIDA)
      .reduce((acc, t) => acc + t.amount, 0);

    const expensesBurn = monthData
      .filter(t => t.type === OperationType.JUROS)
      .reduce((acc, t) => acc + t.amount, 0);

    // Safe Balance: Income - (Life + Burn)
    // This shows "What's left" assuming all plans happen
    const safeBalance = income - (expensesLife + expensesBurn);

    return { income, expensesLife, expensesBurn, safeBalance };
  }, [monthData, state.monthlyIncome]);

  // 3. Card Projections (Mocked Logic for V1)
  // In a real app, this would aggregate by "Card" tags or categories
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* 1. TOP HEADER: Safe Balance */}
      <div className="px-6 pt-4 pb-6 bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-900 sticky top-0 z-20 backdrop-blur-md bg-opacity-90">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Saldo Seguro (Previsto)</span>
            <div className={`text-3xl font-bold mt-1 ${totals.safeBalance >= 0 ? 'text-white' : 'text-rose-500'}`}>
              R$ {totals.safeBalance.toLocaleString()}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              O que sobra se você seguir o roteiro.
            </p>
          </div>
          <div className="text-right">
             <div className="flex items-center justify-end gap-1 text-emerald-400 text-xs font-bold bg-emerald-400/10 px-2 py-1 rounded-full mb-1">
                <Icons.Income size={12} /> +{totals.income.toLocaleString()}
             </div>
             <div className="flex items-center justify-end gap-1 text-rose-400 text-xs font-bold bg-rose-400/10 px-2 py-1 rounded-full">
                <Icons.Burn size={12} /> -{totals.expensesBurn.toLocaleString()}
             </div>
          </div>
        </div>

        {/* 2. CARD PROJECTION WIDGET */}
        <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/50 flex justify-between items-center">
          <div className="flex gap-3 items-center">
            <div className="bg-zinc-900 p-2 rounded-lg text-zinc-400">
              <Icons.Debts size={18} />
            </div>
            <div>
              <span className="text-xs text-zinc-400 block">Faturas (Estimadas)</span>
              <span className="text-sm font-bold text-white">R$ {cardProjection.totalEstimated.toLocaleString()}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-zinc-500 block">Já pago</span>
            <span className="text-xs text-zinc-300">R$ {cardProjection.paidSoFar.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 3. THE TIMELINE (MEU MÊS) */}
      <div className="px-4">
        <h3 className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-4 px-2">Roteiro do Mês</h3>
        
        <div className="relative border-l border-zinc-800 ml-3 space-y-6">
          {monthData.map((item) => {
            const { day, weekday } = formatDate(item.date);
            const isPaid = item.status === 'paid';
            const isPast = new Date(item.date) < new Date() && !isPaid;

            return (
              <div key={item.id} className="relative pl-6 group">
                {/* Timeline Dot */}
                <div 
                  className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 transition-colors 
                    ${isPaid ? 'bg-emerald-500' : isPast ? 'bg-rose-500 animate-pulse' : 'bg-zinc-700'}`}
                />

                {/* Card Content */}
                <div className={`flex justify-between items-start transition-opacity ${isPaid ? 'opacity-50' : 'opacity-100'}`}>
                  
                  {/* Left: Date & Description */}
                  <div className="flex gap-3">
                     <div className="flex flex-col items-center min-w-[30px]">
                        <span className="text-sm font-bold text-zinc-300">{day}</span>
                        <span className="text-[10px] text-zinc-600 uppercase">{weekday}</span>
                     </div>
                     <div>
                        <p className={`text-sm font-medium ${isPaid ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                          {item.description}
                        </p>
                        <div className="flex gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getStatusColor(item.type)}`}>
                            {item.type}
                          </span>
                          <span className="text-[10px] text-zinc-600 truncate max-w-[100px] py-0.5">
                            {item.category}
                          </span>
                        </div>
                     </div>
                  </div>

                  {/* Right: Amount & Action */}
                  <div className="text-right flex flex-col items-end">
                    <span className={`font-mono font-bold text-sm ${item.type === OperationType.ROLAGEM ? 'text-zinc-500' : 'text-white'}`}>
                      R$ {item.amount.toLocaleString()}
                    </span>
                    
                    <button 
                      onClick={() => onToggleStatus(item.id)}
                      className={`mt-2 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full transition-colors
                        ${isPaid 
                          ? 'bg-zinc-800 text-zinc-500' 
                          : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'}`}
                    >
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