import React, { useMemo, useState } from 'react';
import { Card, InstallmentPlan, Transaction, TransactionDraft } from '../types';
import { Icons } from './Icons';

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
      const relatedPlans = installmentPlans.filter((p) => p.cardId === card.id && p.status === 'active');
      return { card, totalCharges, totalPayments, remaining, charges, payments, relatedPlans };
    });
  }, [cards, transactions, installmentPlans, selectedMonth]);

  const handleCancelPlan = (planId: string) => {
    const updatedPlans = installmentPlans.map((p) => (p.id === planId ? { ...p, status: 'cancelled' } : p));
    const updatedTx = transactions.filter((t) => !(t.installment?.groupId === planId && t.status === 'pending'));
    onUpdateInstallments(updatedPlans, updatedTx);
  };

  const handleFinishPlan = (planId: string) => {
    const now = new Date();
    const updatedPlans = installmentPlans.map((p) => (p.id === planId ? { ...p, status: 'finished', remainingInstallments: 0 } : p));
    const updatedTx = transactions.map((t) =>
      t.installment?.groupId === planId && t.status === 'pending'
        ? { ...t, status: 'paid', date: now.toISOString(), competenceMonth: competenceString(now), needsSync: true }
        : t
    );
    onUpdateInstallments(updatedPlans, updatedTx);
  };

  return (
    <div className="p-4 space-y-6 animate-in slide-in-from-right duration-300 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Icons.Debts size={18}/> Passivos</h3>
          <p className="text-[10px] text-zinc-500">Cartão é meio de pagamento; fatura calculada pelo uso.</p>
        </div>
        <div className="flex gap-2 items-center">
          <input 
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white px-3 py-2"
          />
          <button 
            onClick={() => startEdit()}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded-xl flex items-center gap-1 transition-colors border border-zinc-700"
          >
            <Icons.Add size={14} /> Novo cartão
          </button>
        </div>
      </div>

      {monthCards.map(({ card, totalCharges, totalPayments, remaining, charges, payments, relatedPlans }) => (
        <div key={card.id} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-white font-bold text-lg">{card.name}</p>
              <p className="text-[10px] text-zinc-500">Competência {selectedMonth} · Fechamento {card.closingDay ?? '--'} · Vencimento {card.dueDay ?? '--'}</p>
            </div>
            <button onClick={() => startEdit(card)} className="text-zinc-500 hover:text-white"><Icons.Edit size={16}/></button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase">Fatura</p>
              <p className="text-white font-mono font-bold">R$ {totalCharges.toLocaleString()}</p>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase">Pago</p>
              <p className="text-emerald-400 font-mono font-bold">R$ {totalPayments.toLocaleString()}</p>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase">Restante</p>
              <p className={`${remaining > 0 ? 'text-rose-400' : 'text-emerald-400'} font-mono font-bold`}>R$ {remaining.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onQuickAddDraft?.({
                description: `Pagamento fatura ${card.name}`,
                amount: remaining > 0 ? remaining : 0,
                kind: 'debt_payment',
                paymentMethod: 'pix',
                cardId: card.id,
                status: 'paid',
                date: new Date().toISOString(),
                competenceMonth: selectedMonth,
              })}
              className="flex-1 bg-emerald-600 text-white rounded-xl py-2 text-sm font-bold hover:bg-emerald-500"
            >
              Registrar pagamento
            </button>
            <button
              onClick={() => onQuickAddDraft?.({
                description: `Pagamento parcial ${card.name}`,
                amount: remaining > 0 ? remaining / 2 : 0,
                kind: 'debt_payment',
                paymentMethod: 'pix',
                cardId: card.id,
                status: 'paid',
                date: new Date().toISOString(),
                competenceMonth: selectedMonth,
              })}
              className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 text-sm"
            >
              Parcial
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Transações do mês</p>
            {[...charges, ...payments].length === 0 && <p className="text-xs text-zinc-500">Sem lançamentos para este mês.</p>}
            {[...charges, ...payments]
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((t) => (
              <div key={t.id} className="flex justify-between text-sm bg-zinc-950/40 border border-zinc-800 rounded-lg px-3 py-2">
                <div>
                  <p className="text-white">{t.description}</p>
                  <p className="text-[10px] text-zinc-500">{new Date(t.date).toLocaleDateString('pt-BR')} · {t.kind}</p>
                </div>
                <span className={`font-mono ${t.kind === 'debt_payment' ? 'text-emerald-400' : 'text-zinc-200'}`}>R$ {Number(t.amount || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Parcelamentos vinculados</p>
            {relatedPlans.length === 0 && <p className="text-xs text-zinc-500">Sem parcelamentos ativos.</p>}
            {relatedPlans.map((plan) => {
              const pendingTx = transactions.filter((t) => t.installment?.groupId === plan.id && t.status === 'pending');
              return (
                <div key={plan.id} className="flex items-center justify-between bg-zinc-950/50 border border-zinc-800 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm text-white font-bold">{plan.description}</p>
                    <p className="text-[10px] text-zinc-500">{plan.totalInstallments}x · faltam {pendingTx.length}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCancelPlan(plan.id)}
                      className="text-[10px] px-3 py-1 rounded-lg border border-rose-500/40 text-rose-200 hover:bg-rose-500/10"
                    >
                      Cancelar futuras
                    </button>
                    <button
                      onClick={() => handleFinishPlan(plan.id)}
                      className="text-[10px] px-3 py-1 rounded-lg border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                    >
                      Quitar restantes
                    </button>
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
            <div className="bg-zinc-900 w-full max-w-sm p-6 rounded-2xl border border-zinc-700 space-y-4 animate-in zoom-in-95">
                <h4 className="text-white font-bold text-lg">{editingId ? 'Editar Cartão' : 'Novo Cartão'}</h4>
                <input 
                    className="w-full bg-zinc-950 p-3 rounded-xl text-white border border-zinc-800 focus:border-indigo-500 focus:outline-none" 
                    placeholder="Nome (ex: Nubank)"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input 
                      className="w-full bg-zinc-950 p-3 rounded-xl text-white border border-zinc-800 focus:border-indigo-500 focus:outline-none" 
                      placeholder="Fechamento"
                      value={formClosing}
                      onChange={e => setFormClosing(e.target.value)}
                  />
                  <input 
                      className="w-full bg-zinc-950 p-3 rounded-xl text-white border border-zinc-800 focus:border-indigo-500 focus:outline-none" 
                      placeholder="Vencimento"
                      value={formDue}
                      onChange={e => setFormDue(e.target.value)}
                  />
                </div>
                <input 
                    className="w-full bg-zinc-950 p-3 rounded-xl text-white border border-zinc-800 focus:border-indigo-500 focus:outline-none" 
                    placeholder="Juros mês (%)"
                    type="number"
                    value={formApr}
                    onChange={e => setFormApr(e.target.value)}
                />
                <div className="flex gap-2 mt-2">
                    <button onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-zinc-800 rounded-xl text-zinc-400 font-bold">Cancelar</button>
                    <button onClick={saveCard} className="flex-1 py-3 bg-emerald-600 rounded-xl text-white font-bold">Salvar</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
