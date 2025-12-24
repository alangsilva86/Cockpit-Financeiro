import React, { useMemo, useState } from 'react';
import { AppState, PersonId, Transaction, TransactionDraft } from '../types';
import { Icons } from './Icons';
import { Button } from './ui/Button';
import { KpiCard } from './ui/KpiCard';
import { FilterChips } from './ui/FilterChips';
import { EmptyState } from './ui/EmptyState';
import { addMonths, formatCurrency, formatKindLabel, formatShortDate } from '../utils/format';

const competenceString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

type NextSevenDayItem =
  | { id: string; type: 'card'; title: string; date: string; amount: number; cardId: string }
  | { id: string; type: 'tx'; title: string; date: string; amount: number; kind: Transaction['kind']; txId: string };

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
  const [viewMode, setViewMode] = useState<'real' | 'previsto'>('previsto');

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

  const monthTransactions = useMemo(() => {
    return state.transactions
      .filter((t) => {
        if (t.deleted) return false;
        const matchesMonth =
          (t.competenceMonth || '').startsWith(competence) ||
          (new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear);
        return matchesMonth;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [state.transactions, currentMonth, currentYear, competence]);

  const filteredMonthData = useMemo(() => {
    return monthTransactions.filter((t) => {
      const matchesPerson = personFilter === 'All' || t.personId === personFilter;
      const matchesCategory = categoryFilter === 'All' || t.categoryId === categoryFilter;
      const matchesPayment = paymentFilter === 'All' || t.paymentMethod === paymentFilter;
      const matchesStatus =
        viewMode === 'real' ? t.status === 'paid' : viewMode === 'previsto' ? t.status === 'pending' : true;
      return matchesPerson && matchesCategory && matchesPayment && matchesStatus;
    });
  }, [monthTransactions, personFilter, categoryFilter, paymentFilter, viewMode]);

  // 2. Calculate Big Numbers (Real/Previsto)
  const totals = useMemo(() => {
    const incomeExtra = filteredMonthData.filter((t) => t.kind === 'income').reduce((acc, t) => acc + t.amount, 0);

    const totalIncome = state.monthlyIncome + incomeExtra;

    const expensesLife = filteredMonthData.filter((t) => t.kind === 'expense').reduce((acc, t) => acc + t.amount, 0);

    const expensesBurn = filteredMonthData.filter((t) => t.kind === 'fee_interest').reduce((acc, t) => acc + t.amount, 0);

    const debtPayments = filteredMonthData.filter((t) => t.kind === 'debt_payment').reduce((acc, t) => acc + t.amount, 0);

    const variableCategories = ['Alimentação', 'Lazer', 'Compras', 'Transporte', 'Restaurante', 'Mercado'];
    const spentVariable = filteredMonthData
      .filter((t) => t.kind === 'expense' && variableCategories.some((c) => (t.categoryId || '').includes(c)))
      .reduce((acc, t) => acc + t.amount, 0);

    const available = totalIncome - (expensesLife + expensesBurn + debtPayments);

    return { totalIncome, expensesLife, expensesBurn, debtPayments, available, spentVariable };
  }, [filteredMonthData, state.monthlyIncome]);

  const cardRisk = useMemo(() => {
    const range = [0, 1, 2, 3].map((offset) => competenceString(addMonths(targetDate, offset)));
    return state.transactions
      .filter(
        (t) =>
          !t.deleted &&
          t.paymentMethod === 'credit' &&
          t.kind === 'expense' &&
          range.includes(t.competenceMonth) &&
          (personFilter === 'All' || t.personId === personFilter)
      )
      .reduce((acc, t) => acc + t.amount, 0);
  }, [state.transactions, targetDate, personFilter]);

  const nextSevenDays = useMemo<NextSevenDayItem[]>(() => {
    const now = new Date();
    const inSeven = new Date();
    inSeven.setDate(now.getDate() + 7);

    const pendingTx = state.transactions.filter((t) => {
      if (t.deleted || t.status !== 'pending') return false;
      const date = new Date(t.date);
      const inRange = date >= now && date <= inSeven;
      const matchesPerson = personFilter === 'All' || t.personId === personFilter;
      return inRange && matchesPerson;
    });

    const cardItems: NextSevenDayItem[] = state.cards
      .filter((card) => !card.deleted && card.dueDay)
      .map((card) => {
        const due = new Date(now.getFullYear(), now.getMonth(), card.dueDay || 1);
        const dueDate = due < now ? addMonths(due, 1) : due;
        if (dueDate > inSeven) return null;
        const dueCompetence = competenceString(dueDate);
        const charges = state.transactions.filter(
          (t) =>
            !t.deleted &&
            t.cardId === card.id &&
            t.paymentMethod === 'credit' &&
            (t.kind === 'expense' || t.kind === 'fee_interest') &&
            t.competenceMonth === dueCompetence
        );
        const payments = state.transactions.filter(
          (t) =>
            !t.deleted &&
            t.cardId === card.id &&
            t.kind === 'debt_payment' &&
            t.competenceMonth === dueCompetence
        );
        const totalCharges = charges.reduce((acc, t) => acc + t.amount, 0);
        const totalPayments = payments.reduce((acc, t) => acc + t.amount, 0);
        const remaining = Math.max(totalCharges - totalPayments, 0);
        if (remaining === 0) return null;
        return {
          id: `card-${card.id}`,
          type: 'card' as const,
          title: `Fatura ${card.name}`,
          date: dueDate.toISOString(),
          amount: remaining,
          cardId: card.id,
        };
      })
      .filter(Boolean) as NextSevenDayItem[];

    const txItems: NextSevenDayItem[] = pendingTx.map((t) => ({
      id: t.id,
      type: 'tx' as const,
      title: t.description,
      date: t.date,
      amount: t.amount,
      kind: t.kind,
      txId: t.id,
    }));

    return [...cardItems, ...txItems].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [state.cards, state.transactions, personFilter]);

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
  const capPercentage = state.variableCap > 0 ? Math.min((totals.spentVariable / state.variableCap) * 100, 100) : 0;
  const capTone = capPercentage < 75 ? 'emerald' : capPercentage < 100 ? 'amber' : 'rose';
  const semaphoreColor = capTone === 'emerald' ? 'bg-emerald-500' : capTone === 'amber' ? 'bg-amber-400' : 'bg-rose-600';

  const filterChips = [
    personFilter !== 'All'
      ? {
          id: 'person',
          label: `Pessoa: ${personFilter === 'alan' ? 'Alan' : personFilter === 'kellen' ? 'Kellen' : 'Casa'}`,
          onRemove: () => setPersonFilter('All'),
        }
      : null,
    categoryFilter !== 'All'
      ? {
          id: 'category',
          label: `Categoria: ${categoryFilter}`,
          onRemove: () => setCategoryFilter('All'),
        }
      : null,
    paymentFilter !== 'All'
      ? {
          id: 'payment',
          label: `Pagamento: ${paymentFilter}`,
          onRemove: () => setPaymentFilter('All'),
        }
      : null,
  ].filter(Boolean) as Array<{ id: string; label: string; onRemove: () => void }>;

  const clearFilters = () => {
    setPersonFilter('All');
    setCategoryFilter('All');
    setPaymentFilter('All');
  };

  const viewModeLabel = viewMode === 'real' ? 'reais' : 'previstas';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-900 sticky top-0 z-20 backdrop-blur-md bg-opacity-95 shadow-2xl shadow-black/50">
        <div className="w-full h-1 bg-zinc-800">
          <div
            className={`h-full ${semaphoreColor} transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
            style={{ width: `${capPercentage}%` }}
          />
        </div>

        <div className="px-6 pt-4 pb-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMonthOffset((o) => o - 1)}
                className="p-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
              >
                <Icons.ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{monthLabel}</span>
              <button
                onClick={() => setMonthOffset((o) => o + 1)}
                className="p-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
              >
                <Icons.ChevronRight size={16} />
              </button>
              <span
                className={`text-[9px] px-2 py-1 rounded-full border ${
                  isOnline ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/5' : 'text-amber-300 border-amber-400/30 bg-amber-500/5'
                }`}
              >
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 p-1">
              <button
                onClick={() => setViewMode('real')}
                className={`px-4 py-1 text-[10px] font-bold rounded-full ${
                  viewMode === 'real' ? 'bg-white text-black' : 'text-zinc-500'
                }`}
              >
                Real
              </button>
              <button
                onClick={() => setViewMode('previsto')}
                className={`px-4 py-1 text-[10px] font-bold rounded-full ${
                  viewMode === 'previsto' ? 'bg-white text-black' : 'text-zinc-500'
                }`}
              >
                Previsto
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['All', 'alan', 'kellen', 'casa'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPersonFilter(p)}
                className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                  personFilter === p ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
              >
                {p === 'All' ? 'Todos' : p === 'alan' ? 'Alan' : p === 'kellen' ? 'Kellen' : 'Casa'}
                </button>
              ))}
            </div>
          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              className="w-full md:w-auto items-center justify-center gap-2"
              onClick={() =>
                onQuickAddDraft?.({
                  amount: 0,
                  description: '',
                  kind: 'expense',
                  paymentMethod: 'pix',
                  status: 'paid',
                  date: new Date().toISOString(),
                })
              }
            >
              <Icons.Add size={16} />
              Novo lançamento
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            title="Disponível do mês"
            value={`R$ ${formatCurrency(totals.available)}`}
            subtitle={`Receitas - despesas ${viewModeLabel}`}
          />
          <KpiCard
            title="Variável vs teto"
            value={`R$ ${formatCurrency(totals.spentVariable)}`}
            subtitle={`Teto: R$ ${formatCurrency(state.variableCap)}`}
            progress={capPercentage}
            tone={capTone}
            footer={`${Math.round(capPercentage)}% usado`}
          />
          <KpiCard
            title="Risco do cartão"
            value={`R$ ${formatCurrency(cardRisk)}`}
            subtitle="Fatura do mês + próximos 3 meses"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Próximos 7 dias</h3>
            <span className="text-[10px] text-zinc-500">{nextSevenDays.length} itens</span>
          </div>
          {nextSevenDays.length === 0 ? (
            <EmptyState title="Sem pendências próximas" description="Tudo em dia por aqui." />
          ) : (
            <div className="space-y-2">
              {nextSevenDays.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{item.title}</p>
                    <p className="text-[10px] text-zinc-500">
                      {formatShortDate(item.date)} • {item.type === 'card' ? 'Vencimento' : formatKindLabel(item.kind)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-zinc-200">R$ {formatCurrency(item.amount)}</div>
                    {item.type === 'card' ? (
                      <Button
                        variant="secondary"
                        className="mt-2 px-4 text-[10px]"
                        onClick={() =>
                          onQuickAddDraft({
                            amount: item.amount,
                            description: item.title,
                            kind: 'debt_payment',
                            paymentMethod: 'pix',
                            cardId: item.cardId,
                            status: 'paid',
                            date: new Date().toISOString(),
                            competenceMonth: competenceString(new Date(item.date)),
                          })
                        }
                      >
                        Pagar agora
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        className="mt-2 px-4 text-[10px]"
                        onClick={() => onToggleStatus(item.txId)}
                      >
                        Confirmar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-lg px-2 py-2"
            >
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'Todas categorias' : cat}
                </option>
              ))}
            </select>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-lg px-2 py-2"
            >
              {['All', 'credit', 'pix', 'debit', 'cash'].map((p) => (
                <option key={p} value={p}>
                  {p === 'All' ? 'Todos pagamentos' : p}
                </option>
              ))}
            </select>
          </div>
          <FilterChips chips={filterChips} onClear={clearFilters} />
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest px-2">Linha do Tempo</h3>
          <div className="relative border-l border-zinc-800 ml-2 space-y-8">
            {filteredMonthData.map((item) => {
              const { day, weekday } = formatDate(item.date);
              const isPaid = item.status === 'paid';
              const isPast = new Date(item.date) < new Date() && !isPaid;
              const isIncome = item.kind === 'income';
              const isOffline = item.needsSync;

              return (
                <div key={item.id} className="relative pl-6 group">
                  <div
                    className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 transition-all duration-300 z-10
                    ${
                      isPaid
                        ? 'bg-zinc-700 border-zinc-800'
                        : isIncome
                        ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]'
                        : isPast
                        ? 'bg-rose-500 animate-pulse'
                        : 'bg-zinc-500'
                    }`}
                  />

                  <div className={`flex justify-between items-start transition-all duration-300 ${isPaid ? 'opacity-40 grayscale' : 'opacity-100'}`}>
                    <div className="flex gap-2">
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
                            {formatKindLabel(item.kind)}
                          </span>
                          {item.categoryId && (
                            <span className="text-[10px] text-zinc-600 truncate max-w-[100px] py-px">{item.categoryId}</span>
                          )}
                          {item.installment && (
                            <span className="text-[10px] text-zinc-500">
                              {item.installment.number}/{item.installment.total}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <span className={`font-mono font-bold text-sm tracking-tight ${isIncome ? 'text-emerald-400' : item.kind === 'transfer' ? 'text-zinc-500' : 'text-zinc-100'}`}>
                        {isIncome ? '+' : ''} {formatCurrency(item.amount)}
                      </span>
                      {isOffline && <span className="text-[9px] text-amber-300">Pendente de sincronizar</span>}
                      {item.status === 'pending' && !isPaid && !isIncome && (
                        <span className="text-[9px] text-zinc-500">
                          Vence em {Math.max(0, Math.ceil((new Date(item.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}d
                        </span>
                      )}

                      <button
                        onClick={() => onToggleStatus(item.id)}
                        className={`mt-2 flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full transition-colors border
                        ${isPaid ? 'bg-transparent border-zinc-800 text-zinc-600' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20'}`}
                      >
                        {isPaid ? <Icons.Check size={10} /> : null}
                        {isPaid ? 'PAGO' : 'CONFIRMAR'}
                      </button>
                      {isPast && !isPaid && (
                        <Button
                          variant="ghost"
                          className="mt-2 px-4 text-[10px] font-bold uppercase underline text-emerald-400"
                          onClick={() =>
                            onQuickAddDraft({
                              amount: item.amount,
                              description: `Pagamento ${item.description}`,
                              kind: 'debt_payment',
                              paymentMethod: 'pix',
                              cardId: item.cardId,
                              personId: item.personId,
                              status: 'paid',
                              date: new Date().toISOString(),
                              competenceMonth: competence,
                            })
                          }
                        >
                          Registrar pagamento
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredMonthData.length === 0 && (
              <div className="pl-6">
                <EmptyState title="Nenhum lançamento encontrado" description="Ajuste filtros ou gere um roteiro no Planejamento." />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
