import React, { useMemo, useState } from 'react';
import { Card, InstallmentPlan, Transaction, TransactionDraft } from '../types';
import { Icons } from './Icons';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { EmptyState } from './ui/EmptyState';
import { formatCurrency, formatKindLabel, formatShortDate } from '../utils/format';

interface PassivosProps {
  cards: Card[];
  transactions: Transaction[];
  installmentPlans: InstallmentPlan[];
  onAddCard?: (card: Card) => void;
  onUpdateCard?: (card: Card) => void;
  onUpdateInstallments: (plans: InstallmentPlan[], txs: Transaction[]) => void;
  onQuickAddDraft?: (draft: TransactionDraft) => void;
}

const competenceString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const Passivos: React.FC<PassivosProps> = ({
  cards,
  transactions,
  installmentPlans,
  onAddCard,
  onUpdateCard,
  onUpdateInstallments,
  onQuickAddDraft,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formClosing, setFormClosing] = useState('');
  const [formDue, setFormDue] = useState('');
  const [formApr, setFormApr] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(competenceString(new Date()));

  const startEdit = (card?: Card) => {
    setIsEditing(true);
    if (card) {
      setEditingId(card.id);
      setFormName(card.name);
      setFormClosing(card.closingDay?.toString() || '');
      setFormDue(card.dueDay?.toString() || '');
      setFormApr(card.aprMonthly?.toString() || '');
    } else {
      setEditingId(null);
      setFormName('');
      setFormClosing('');
      setFormDue('');
      setFormApr('');
    }
  };

  const saveCard = () => {
    if (!formName) return;
    const card: Card = {
      id: editingId || Date.now().toString(),
      name: formName,
      closingDay: formClosing ? parseInt(formClosing, 10) : undefined,
      dueDay: formDue ? parseInt(formDue, 10) : undefined,
      aprMonthly: formApr ? parseFloat(formApr) : undefined,
    };
    if (editingId && onUpdateCard) onUpdateCard(card);
    if (!editingId && onAddCard) onAddCard(card);
    setIsEditing(false);
  };

  const monthCards = useMemo(() => {
    return cards.map((card) => {
      const charges = transactions.filter(
        (t) => t.paymentMethod === 'credit' && t.cardId === card.id && (t.competenceMonth || competenceString(new Date(t.date))) === selectedMonth
      );
      const payments = transactions.filter(
        (t) => t.kind === 'debt_payment' && t.cardId === card.id && (t.competenceMonth || competenceString(new Date(t.date))) === selectedMonth
      );
      const getAmt = (t: Transaction) => Number(t.amount || 0);
      const totalCharges = charges.reduce((acc, t) => acc + getAmt(t), 0);
      const totalPayments = payments.reduce((acc, t) => acc + getAmt(t), 0);
      const remaining = totalCharges - totalPayments;
      const relatedPlans = installmentPlans.filter((p) => p.cardId === card.id && p.status === 'active' && !p.deleted);
      return { card, totalCharges, totalPayments, remaining, charges, payments, relatedPlans };
    });
  }, [cards, transactions, installmentPlans, selectedMonth]);

  const handleCancelPlan = (planId: string) => {
    const now = new Date().toISOString();
    const updatedPlans = installmentPlans.map((p) => (p.id === planId ? { ...p, status: 'cancelled', updatedAt: now } : p));
    const updatedTx = transactions.map((t) =>
      t.installment?.groupId === planId && t.status === 'pending'
        ? { ...t, deleted: true, updatedAt: now, needsSync: true }
        : t
    );
    onUpdateInstallments(updatedPlans, updatedTx);
  };

  const handleFinishPlan = (planId: string) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const updatedPlans = installmentPlans.map((p) => (p.id === planId ? { ...p, status: 'finished', remainingInstallments: 0, updatedAt: nowIso } : p));
    const updatedTx = transactions.map((t) =>
      t.installment?.groupId === planId && t.status === 'pending'
        ? { ...t, status: 'paid', date: nowIso, competenceMonth: competenceString(now), needsSync: true, updatedAt: nowIso }
        : t
    );
    onUpdateInstallments(updatedPlans, updatedTx);
  };

  return (
    <div className="p-4 space-y-6   duration-300 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Icons.Debts size={18}/> Passivos</h3>
          <p className="text-xs text-zinc-500">Cartão é meio de pagamento; fatura calculada pelo uso.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="passivos-month">
            Selecionar competência
          </label>
          <input
            id="passivos-month"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white px-4 py-2"
          />
          <Button variant="ghost" className="gap-1 text-xs normal-case tracking-wider" onClick={() => startEdit()}>
            <Icons.Add size={16} />
            Novo cartão
          </Button>
        </div>
      </div>

      {monthCards.map(({ card, totalCharges, totalPayments, remaining, charges, payments, relatedPlans }) => (
          <div key={card.id} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 space-y-2">
          <div className="flex justify-between items-start gap-2">
            <div>
              <p className="text-white font-bold text-lg">{card.name}</p>
              <p className="text-xs text-zinc-500">
                Competência {selectedMonth} · Fechamento {card.closingDay ?? '--'} · Vencimento {card.dueDay ?? '--'}
              </p>
            </div>
            <IconButton
              aria-label={`Editar cartão ${card.name}`}
              icon={<Icons.Edit size={16} />}
              className="border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-emerald-300"
              onClick={() => startEdit(card)}
            />
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-zinc-950/50 rounded-xl p-4 border border-zinc-800">
              <p className="text-xs text-zinc-500 uppercase">Compras</p>
              <p className="text-white font-mono font-bold">R$ {formatCurrency(totalCharges)}</p>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-4 border border-zinc-800">
              <p className="text-xs text-zinc-500 uppercase">Pagamentos</p>
              <p className="text-emerald-400 font-mono font-bold">R$ {formatCurrency(totalPayments)}</p>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-4 border border-zinc-800">
              <p className="text-xs text-zinc-500 uppercase">Saldo</p>
              <p className={`${remaining > 0 ? 'text-rose-400' : 'text-emerald-400'} font-mono font-bold`}>R$ {formatCurrency(remaining)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              className="flex-1 normal-case text-sm"
              onClick={() =>
                onQuickAddDraft?.({
                  description: `Pagamento fatura ${card.name}`,
                  amount: remaining > 0 ? remaining : 0,
                  kind: 'debt_payment',
                  paymentMethod: 'pix',
                  cardId: card.id,
                  status: 'paid',
                  date: new Date().toISOString(),
                  competenceMonth: selectedMonth,
                })
              }
            >
              Pagar total
            </Button>
            <Button
              variant="secondary"
              className="flex-1 normal-case text-sm"
              onClick={() =>
                onQuickAddDraft?.({
                  description: `Pagamento mínimo ${card.name}`,
                  amount: remaining > 0 ? Math.min(remaining, Math.max(remaining * 0.15, 50)) : 0,
                  kind: 'debt_payment',
                  paymentMethod: 'pix',
                  cardId: card.id,
                  status: 'paid',
                  date: new Date().toISOString(),
                  competenceMonth: selectedMonth,
                })
              }
            >
              Pagar mínimo
            </Button>
            <Button
              variant="ghost"
              className="flex-1 normal-case text-sm"
              onClick={() =>
                onQuickAddDraft?.({
                  description: `Pagamento ${card.name}`,
                  amount: 0,
                  kind: 'debt_payment',
                  paymentMethod: 'pix',
                  cardId: card.id,
                  status: 'paid',
                  date: new Date().toISOString(),
                  competenceMonth: selectedMonth,
                })
              }
            >
              Outro valor
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase font-bold">Compras (competência)</p>
            {charges.length === 0 ? (
              <EmptyState title="Sem compras no ciclo" description="Sem lançamentos de crédito nesta competência." />
            ) : (
              charges
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((t) => (
                  <div key={t.id} className="flex justify-between text-sm bg-zinc-950/40 border border-zinc-800 rounded-lg px-4 py-2">
                    <div>
                      <p className="text-white">{t.description}</p>
                      <p className="text-xs text-zinc-500">
                        {formatShortDate(t.date)} · {formatKindLabel(t.kind)}
                      </p>
                    </div>
                    <span className="font-mono text-zinc-200">R$ {formatCurrency(Number(t.amount || 0))}</span>
                  </div>
                ))
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase font-bold">Pagamentos (caixa)</p>
            {payments.length === 0 ? (
              <EmptyState title="Sem pagamentos neste mês" description="Registre pagamentos para baixar o saldo." />
            ) : (
              payments
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((t) => (
                  <div key={t.id} className="flex justify-between text-sm bg-zinc-950/40 border border-zinc-800 rounded-lg px-4 py-2">
                    <div>
                      <p className="text-white">{t.description}</p>
                      <p className="text-xs text-zinc-500">
                        {formatShortDate(t.date)} · {formatKindLabel(t.kind)}
                      </p>
                    </div>
                    <span className="font-mono text-emerald-400">R$ {formatCurrency(Number(t.amount || 0))}</span>
                  </div>
                ))
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase font-bold">Parcelamentos vinculados</p>
            {relatedPlans.length === 0 && <p className="text-xs text-zinc-500">Sem parcelamentos ativos.</p>}
            {relatedPlans.map((plan) => {
              const pendingTx = transactions.filter((t) => t.installment?.groupId === plan.id && t.status === 'pending');
              return (
            <div key={plan.id} className="flex items-center justify-between bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2">
              <div>
                <p className="text-sm text-white font-bold">{plan.description}</p>
                <p className="text-xs text-zinc-500">{plan.totalInstallments}x · faltam {pendingTx.length}</p>
              </div>
              <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      className="text-xs normal-case tracking-wide"
                      onClick={() => handleCancelPlan(plan.id)}
                    >
                      Cancelar futuras
                    </Button>
                    <Button
                      variant="secondary"
                      className="text-xs normal-case tracking-wide"
                      onClick={() => handleFinishPlan(plan.id)}
                    >
                      Quitar restantes
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Edit Form Modal/Overlay */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 w-full max-w-sm p-6 rounded-2xl border border-zinc-700 space-y-4  ">
                <h4 className="text-white font-bold text-lg">{editingId ? 'Editar Cartão' : 'Novo Cartão'}</h4>
                <input
                  className="w-full bg-zinc-950 px-4 py-2 rounded-xl text-white border border-zinc-800 focus:border-indigo-500 focus:outline-none"
                  placeholder="Nome (ex: Nubank)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="w-full bg-zinc-950 px-4 py-2 rounded-xl text-white border border-zinc-800 focus:border-indigo-500 focus:outline-none"
                    placeholder="Fechamento"
                    type="number"
                    inputMode="numeric"
                    value={formClosing}
                    onChange={(e) => setFormClosing(e.target.value)}
                  />
                  <input
                    className="w-full bg-zinc-950 px-4 py-2 rounded-xl text-white border border-zinc-800 focus:border-indigo-500 focus:outline-none"
                    placeholder="Vencimento"
                    type="number"
                    inputMode="numeric"
                    value={formDue}
                    onChange={(e) => setFormDue(e.target.value)}
                  />
                </div>
                <input
                  className="w-full bg-zinc-950 px-4 py-2 rounded-xl text-white border border-zinc-800 focus:border-indigo-500 focus:outline-none"
                  placeholder="Juros mês (%)"
                  type="number"
                  inputMode="decimal"
                  value={formApr}
                  onChange={(e) => setFormApr(e.target.value)}
                />
                <div className="flex gap-2 mt-2">
                  <Button variant="ghost" className="flex-1 normal-case" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button variant="primary" className="flex-1 normal-case" onClick={saveCard}>
                    Salvar
                  </Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
