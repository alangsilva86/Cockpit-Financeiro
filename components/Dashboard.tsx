import React, { useMemo, useState } from 'react';
import { AppState, PersonId, Transaction, TransactionDraft } from '../types';
import { Icons } from './Icons';

interface DashboardProps {
  state: AppState;
  onToggleStatus: (id: string) => void;
  onQuickAddDraft: (draft: TransactionDraft) => void;
  isOnline: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ state, onToggleStatus, onQuickAddDraft, isOnline }) => {
  const [monthOffset, setMonthOffset] = useState(0);
  const [personFilter, setPersonFilter] = useState<PersonId | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [paymentFilter, setPaymentFilter] = useState<string>('All');

  const targetDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const currentMonth = targetDate.getMonth();
  const currentYear = targetDate.getFullYear();
  const competence = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const monthLabel = targetDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const categoryOptions = useMemo(
    () => ['All', ...Array.from(new Set(state.transactions.map((t) => t.categoryId || ''))).filter(Boolean).sort()],
    [state.transactions]
  );

  // 1. Filter Current Month Data
  const monthData = useMemo(() => {
    return state.transactions.filter(t => {
      if (t.deleted) return false;
      const matchesMonth = (t.competenceMonth || '').startsWith(competence) || (new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear);
      const matchesPerson = personFilter === 'All' || t.personId === personFilter;
      const matchesCategory = categoryFilter === 'All' || t.categoryId === categoryFilter;
      const matchesPayment = paymentFilter === 'All' || t.paymentMethod === paymentFilter;
      return matchesMonth && matchesPerson && matchesCategory && matchesPayment;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [state.transactions, currentMonth, currentYear, personFilter, categoryFilter, paymentFilter, competence]);

  // 2. Calculate Big Numbers (Forecast based)
  const totals = useMemo(() => {
    const incomeExtra = monthData
      .filter(t => t.kind === 'income')
      .reduce((acc, t) => acc + t.amount, 0);

    const totalIncome = state.monthlyIncome + incomeExtra;
    
    const expensesLife = monthData
      .filter(t => t.kind === 'expense')
      .reduce((acc, t) => acc + t.amount, 0);

    const expensesBurn = monthData
      .filter(t => t.kind === 'fee_interest')
      .reduce((acc, t) => acc + t.amount, 0);

    const variableCategories = ['Alimentação', 'Lazer', 'Compras', 'Transporte', 'Restaurante', 'Mercado'];
    const spentVariable = monthData
      .filter(t => t.kind === 'expense' && variableCategories.some(c => (t.categoryId || '').includes(c)))
      .reduce((acc, t) => acc + t.amount, 0);

    const safeBalance = totalIncome - (expensesLife + expensesBurn);

    return { totalIncome, expensesLife, expensesBurn, safeBalance, spentVariable };
  }, [monthData, state.monthlyIncome]);

  // 3. Card Projections (credit charges only)
  const cardProjection = useMemo(() => {
    const cardTx = monthData.filter(t => t.paymentMethod === 'credit' && t.kind === 'expense');
    const totalEstimated = cardTx.reduce((acc, t) => acc + t.amount, 0);
    const paidSoFar = cardTx.filter(t => t.status === 'paid').reduce((acc, t) => acc + t.amount, 0);
    
    return { totalEstimated, paidSoFar };
  }, [monthData]);

  const getStatusColor = (kind: Transaction['kind']) => {
    switch (kind) {
      case 'income': return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
      case 'expense': return 'text-blue-400 border-blue-400/30 bg-blue-400/10';
      case 'debt_payment': return 'text-indigo-400 border-indigo-400/30 bg-indigo-400/10';
      case 'fee_interest': return 'text-rose-500 border-rose-500/30 bg-rose-500/10';
      case 'transfer': return 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10';
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
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setMonthOffset(o => o - 1)} className="p-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white">
                <Icons.ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{monthLabel}</span>
              <button onClick={() => setMonthOffset(o => o + 1)} className="p-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white">
                <Icons.ChevronRight size={16} />
              </button>
              <span className={`text-[9px] px-2 py-1 rounded-full border ${isOnline ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/5' : 'text-amber-300 border-amber-400/30 bg-amber-500/5'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex gap-1">
              {(['All', 'alan', 'kellen', 'casa'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPersonFilter(p)}
                  className={`px-2 py-1 rounded-full text-[10px] font-bold border ${personFilter === p ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}`}
                >
                  {p === 'All' ? 'Todos' : p === 'alan' ? 'Alan' : p === 'kellen' ? 'Kellen' : 'Casa'}
                </button>
              ))}
            </div>
          </div>
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
        
        <div className="flex flex-wrap gap-2 mb-4 px-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-lg px-2 py-2"
          >
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>{cat === 'All' ? 'Todas categorias' : cat}</option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-lg px-2 py-2"
          >
            {['All', 'credit', 'pix', 'debit', 'cash'].map((p) => (
              <option key={p} value={p}>{p === 'All' ? 'Todos pagamentos' : p}</option>
            ))}
          </select>
          <button
            onClick={() => { setCategoryFilter('All'); setPaymentFilter('All'); }}
            className="text-[10px] text-emerald-400 hover:text-white px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5"
          >
            Limpar filtros
          </button>
        </div>
        
        <div className="relative border-l border-zinc-800 ml-3 space-y-8">
          {monthData.map((item) => {
            const { day, weekday } = formatDate(item.date);
            const isPaid = item.status === 'paid';
            const isPast = new Date(item.date) < new Date() && !isPaid;
            const isIncome = item.kind === 'income';
            const isOffline = item.needsSync;

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
                          <span className={`text-[9px] px-1.5 py-px rounded border ${getStatusColor(item.kind)}`}>
                            {item.kind}
                          </span>
                          {item.categoryId && (
                            <span className="text-[10px] text-zinc-600 truncate max-w-[100px] py-px">
                              {item.categoryId}
                            </span>
                          )}
                          {item.installment && (
                            <span className="text-[10px] text-zinc-500">
                              {item.installment.number}/{item.installment.total}
                            </span>
                          )}
                        </div>
                     </div>
                  </div>

                  {/* Right: Amount & Action */}
                  <div className="text-right flex flex-col items-end">
                    <span className={`font-mono font-bold text-sm tracking-tight ${isIncome ? 'text-emerald-400' : item.kind === 'transfer' ? 'text-zinc-500' : 'text-zinc-100'}`}>
                      {isIncome ? '+' : ''} {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    {isOffline && <span className="text-[9px] text-amber-300">Pendente de sincronizar</span>}
                    {item.status === 'pending' && !isPaid && !isIncome && (
                      <span className="text-[9px] text-zinc-500">Vence em {Math.max(0, Math.ceil((new Date(item.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}d</span>
                    )}
                    
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
                    {isPast && !isPaid && (
                      <button
                        onClick={() => onQuickAddDraft({
                          amount: item.amount,
                          description: `Pagamento ${item.description}`,
                          kind: 'debt_payment',
                          paymentMethod: 'pix',
                          cardId: item.cardId,
                          personId: item.personId,
                          status: 'paid',
                          date: new Date().toISOString(),
                          competenceMonth: competence,
                        })}
                        className="text-[10px] text-emerald-400 underline mt-2 hover:text-white"
                      >
                        Registrar pagamento
                      </button>
                    )}
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
