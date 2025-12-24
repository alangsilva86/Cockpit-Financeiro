import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, InstallmentPlan, PaymentMethod, PersonId, Transaction, TransactionDraft } from '../types';
import { Icons } from './Icons';
import { INCOME_CATEGORIES } from '../services/categories';
import { parseReceiptImage, suggestCategory } from '../services/aiClient';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';

interface QuickAddProps {
  onAdd: (transactions: Transaction[], options?: { stayOnAdd?: boolean; newPlan?: InstallmentPlan | null }) => void;
  onCancel: () => void;
  availableCategories: string[];
  availableCards: Card[];
  onAddCard: (card: Card) => void;
  lastUsed?: Transaction | null;
  draft?: TransactionDraft | null;
  onClearDraft: () => void;
  isOnline: boolean;
  onToast: (message: string, type?: 'success' | 'error') => void;
}

const PERSONS: PersonId[] = ['alan', 'kellen', 'casa'];
const PAYMENT_METHODS: PaymentMethod[] = ['credit', 'pix', 'debit', 'cash'];

const competenceFromDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const calcCompetenceWithCard = (iso: string, card?: Card) => {
  const d = new Date(iso);
  if (!card?.closingDay) return competenceFromDate(iso);
  const day = d.getDate();
  if (day > card.closingDay) {
    d.setMonth(d.getMonth() + 1);
  }
  return competenceFromDate(d.toISOString());
};

const buildInstallments = (
  totalAmount: number,
  totalInstallments: number,
  firstDate: string,
  base: Omit<Transaction, 'id' | 'competenceMonth' | 'status' | 'installment'>,
  card?: Card
): { transactions: Transaction[]; plan: InstallmentPlan } => {
  const planId = `plan-${Date.now().toString(36)}`;
  const per = Math.round((totalAmount / totalInstallments) * 100) / 100;
  const transactions: Transaction[] = [];
  const start = new Date(firstDate);

  for (let i = 0; i < totalInstallments; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    const isLast = i === totalInstallments - 1;
    const provisionalAmount = per;
    const accumulated = per * (totalInstallments - 1);
    const lastAmount = Math.round((totalAmount - accumulated) * 100) / 100;
    const amount = isLast ? lastAmount : provisionalAmount;
    const iso = d.toISOString();
    const status: Transaction['status'] = d <= new Date() ? 'paid' : 'pending';

    transactions.push({
      ...base,
      id: `${planId}-${i + 1}`,
      date: iso,
      competenceMonth: calcCompetenceWithCard(iso, card),
      status,
      amount,
      installment: {
        groupId: planId,
        number: i + 1,
        total: totalInstallments,
        originalTotalAmount: totalAmount,
        perInstallmentAmount: amount,
        startDate: firstDate,
      },
    });
  }

  const plan: InstallmentPlan = {
    id: planId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    description: base.description,
    personId: base.personId,
    categoryId: base.categoryId || '',
    cardId: base.cardId || '',
    purchaseDate: base.date,
    firstInstallmentDate: firstDate,
    totalInstallments,
    totalAmount,
    perInstallmentAmount: per,
    status: 'active',
    remainingInstallments: totalInstallments,
  };

  return { transactions, plan };
};

export const QuickAdd: React.FC<QuickAddProps> = ({
  onAdd,
  onCancel,
  availableCategories,
  availableCards,
  onAddCard,
  lastUsed,
  draft,
  onClearDraft,
  isOnline,
  onToast,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<Transaction['kind']>('expense');
  const [personId, setPersonId] = useState<PersonId>('alan');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<string>(''); 
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [isRollover, setIsRollover] = useState(false);
  const [rolloverFee, setRolloverFee] = useState<string>('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const defaultsAppliedRef = useRef(false);
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardDay, setNewCardDay] = useState('');
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stayOnAdd, setStayOnAdd] = useState(false);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(date);

  useEffect(() => {
    if (availableCards.length > 0 && !selectedCardId) {
      setSelectedCardId(availableCards[0].id);
    }
  }, [availableCards, selectedCardId]);

  useEffect(() => {
    if (paymentMethod === 'credit' && selectedCardId) {
      const exists = availableCards.some((card) => card.id === selectedCardId);
      if (!exists) {
        setSelectedCardId(availableCards[0]?.id || '');
      }
    }
  }, [availableCards, paymentMethod, selectedCardId]);

  useEffect(() => {
    if (defaultsAppliedRef.current || draft || !lastUsed) return;
    defaultsAppliedRef.current = true;
    if (lastUsed.personId) setPersonId(lastUsed.personId);
    if (lastUsed.kind) setKind(lastUsed.kind);
    if (lastUsed.paymentMethod) setPaymentMethod(lastUsed.paymentMethod);
    if (lastUsed.cardId) setSelectedCardId(lastUsed.cardId);
    if (lastUsed.categoryId && (lastUsed.kind === 'expense' || lastUsed.kind === 'fee_interest')) {
      setCategory(lastUsed.categoryId);
    }
    setIsRollover(lastUsed.kind === 'fee_interest');
  }, [draft, lastUsed]);

  const displayedCategories = useMemo(() => {
    if (kind === 'income') return INCOME_CATEGORIES;
    return availableCategories.filter(cat => !INCOME_CATEGORIES.includes(cat));
  }, [kind, availableCategories]);

  useEffect(() => {
    let active = true; 
    const timer = setTimeout(async () => {
      if (description.length > 3 && !category) {
        if (active) setIsSuggesting(true);
        try {
          const suggestion = await suggestCategory(description, displayedCategories);
          if (active && suggestion) {
            setCategory(suggestion);
          }
        } catch (err) {
          console.error("Error suggesting category:", err);
        } finally {
          if (active) setIsSuggesting(false);
        }
      }
    }, 1000); 

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [description, category, displayedCategories]);

  useEffect(() => {
    if (!draft) return;
    if (draft.amount !== undefined) setAmount(draft.amount.toString());
    if (draft.description) setDescription(draft.description);
    if (draft.kind) setKind(draft.kind);
    if (draft.categoryId) setCategory(draft.categoryId);
    if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
    if (draft.cardId) setSelectedCardId(draft.cardId);
    if (draft.personId) setPersonId(draft.personId);
    if (draft.date) setDate(draft.date.split('T')[0]);
  }, [draft]);

  const progress = useMemo(() => {
    const required = [
      Boolean(kind),
      Boolean(amount),
      Boolean(description),
      Boolean(date),
      Boolean(paymentMethod),
      paymentMethod !== 'credit' || Boolean(selectedCardId),
      !(kind === 'expense' || kind === 'fee_interest') || Boolean(category),
      !isInstallment || (installmentsCount > 1 && Boolean(firstInstallmentDate)),
    ];
    const done = required.filter(Boolean).length;
    return Math.round((done / required.length) * 100);
  }, [kind, amount, description, date, paymentMethod, selectedCardId, category, isInstallment, installmentsCount, firstInstallmentDate]);

  const isFutureDate = useMemo(() => new Date(date) > new Date(), [date]);

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setCategory('');
    setPaymentMethod('credit');
    setSelectedCardId(availableCards[0]?.id || '');
    setIsRollover(false);
    setRolloverFee('');
    setStayOnAdd(false);
    setError(null);
    setIsInstallment(false);
    setInstallmentsCount(1);
    setFirstInstallmentDate(new Date().toISOString().split('T')[0]);
    onClearDraft();
  };

  const handleTypeChange = (next: Transaction['kind']) => {
    setKind(next);
    if (next === 'income') {
      setCategory('Salário');
      setPaymentMethod('pix');
      setIsInstallment(false);
    } else {
      if (INCOME_CATEGORIES.includes(category)) setCategory('');
      if (paymentMethod !== 'credit') setIsInstallment(false);
    }
    setIsRollover(next === 'fee_interest');
  };

  const handleTemplate = (mode: 'fatura' | 'pix') => {
    handleTypeChange('debt_payment');
    if (mode === 'fatura') {
      setDescription('Pagamento Fatura Cartão');
      setCategory('Taxas'); 
      setPaymentMethod('pix'); 
    } else {
      setDescription('Transferência/PIX');
      setCategory('Outros');
      setPaymentMethod('pix');
    }
    setShowTemplateMenu(false);
  };

  const handleSaveNewCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardName) return;

    const newId = Date.now().toString();
    const newCard: Card = {
      id: newId,
      name: newCardName,
      dueDay: newCardDay ? parseInt(newCardDay, 10) : undefined,
    };

    onAddCard(newCard);
    setSelectedCardId(newId);
    setIsCreatingCard(false);
    setNewCardName('');
    setNewCardDay('');
  };

  const handleCameraClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64String = reader.result as string;
        const rawBase64 = base64String.split(',')[1];
        const data = await parseReceiptImage(rawBase64, displayedCategories);
        if (data) {
          if (data.amount) setAmount(data.amount.toString());
          if (data.description) setDescription(data.description);
          if (data.category) setCategory(data.category);
        }
        setIsScanning(false);
      };
      reader.onerror = () => setIsScanning(false);
    } catch (error) {
      console.error("Scanning failed", error);
      setIsScanning(false);
    }
    event.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!amount || !description || (!category && kind !== 'debt_payment' && kind !== 'transfer')) {
      setError('Preencha valor, descrição e categoria.');
      onToast('Preencha os campos obrigatórios.', 'error');
      return;
    }
    if (paymentMethod === 'credit' && !selectedCardId) {
      setError('Selecione um cartão de crédito.');
      onToast('Selecione um cartão de crédito.', 'error');
      return;
    }

    const totalAmount = parseFloat(amount);
    const finalDate = new Date(date);
    const now = new Date();
    finalDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    const isoDate = finalDate.toISOString();
    const computedStatus: Transaction['status'] = isFutureDate ? 'pending' : 'paid';

    const base: Omit<Transaction, 'id' | 'installment' | 'status'> = {
      date: isoDate,
      competenceMonth: competenceFromDate(isoDate),
      direction: kind === 'income' ? 'in' : 'out',
      kind,
      amount: totalAmount,
      description,
      personId,
      categoryId: category,
      paymentMethod,
      cardId: paymentMethod === 'credit' ? selectedCardId : undefined,
      tags: [],
      needsSync: !isOnline,
      isRecurring: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const transactions: Transaction[] = [];
    let newPlan: InstallmentPlan | null = null;

    if (paymentMethod === 'credit' && isInstallment && installmentsCount > 1 && kind === 'expense') {
      const { transactions: txs, plan } = buildInstallments(totalAmount, installmentsCount, firstInstallmentDate, {
        ...base,
        kind: 'expense',
      }, availableCards.find(c => c.id === selectedCardId));
      newPlan = plan;
      transactions.push(...txs.map((t) => ({ ...t, status: t.status || computedStatus })));
    } else {
      transactions.push({
        ...base,
        id: Date.now().toString(),
        competenceMonth: paymentMethod === 'credit' ? calcCompetenceWithCard(isoDate, availableCards.find(c => c.id === selectedCardId)) : base.competenceMonth,
        status: computedStatus,
      });
    }

    if (isRollover && rolloverFee) {
      transactions.push({
        ...base,
        id: `${Date.now()}-fee`,
        description: `Juros/Taxa: ${description}`,
        kind: 'fee_interest',
        amount: parseFloat(rolloverFee),
        status: computedStatus,
      });
    }

    onAdd(transactions, { stayOnAdd, newPlan });
    onToast(isOnline ? 'Lançamento salvo' : 'Guardado offline para sincronizar');
    if (stayOnAdd) {
      resetForm();
    }
  };

  return (
    <div className={`p-4 h-full flex flex-col animate-in slide-in-from-bottom duration-300 relative bg-gradient-to-b from-zinc-900/20 to-zinc-950`}>
      
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {/* New Card Modal */}
      {isCreatingCard && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 rounded-xl">
           <form onSubmit={handleSaveNewCard} className="bg-zinc-900 w-full max-w-sm p-6 rounded-2xl border border-zinc-700 shadow-2xl space-y-4 animate-in zoom-in-95">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Icons.Debts className="text-indigo-400"/> Novo Cartão
              </h3>
              <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold">Nome do Cartão</label>
                  <input 
                    autoFocus
                    value={newCardName}
                    onChange={e => setNewCardName(e.target.value)}
                    placeholder="Ex: Nubank, XP..."
                    className="w-full bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-white mt-1 focus:border-indigo-500 focus:outline-none"
                  />
              </div>
              <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold">Dia Vencimento</label>
                  <input 
                    type="number"
                    inputMode="numeric"
                    value={newCardDay}
                    onChange={e => setNewCardDay(e.target.value)}
                    placeholder="Ex: 05"
                    className="w-full bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-white mt-1 focus:border-indigo-500 focus:outline-none"
                  />
              </div>
              <div className="flex gap-2 pt-2">
                  <Button variant="ghost" className="flex-1" type="button" onClick={() => setIsCreatingCard(false)}>
                    Cancelar
                  </Button>
                  <Button variant="primary" className="flex-1" type="submit" disabled={!newCardName}>
                    Salvar
                  </Button>
              </div>
           </form>
        </div>
      )}

      {/* === HEADER ACTIONS === */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-zinc-400 uppercase tracking-widest">
              Novo Lançamento
          </h2>
          <div className="flex gap-2">
               {/* Templates Menu Button */}
               <div className="relative">
                  <IconButton
                    aria-label="Abrir templates"
                    icon={<Icons.More size={20} />}
                    onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                    className="border border-zinc-700 bg-zinc-900/70 text-zinc-300"
                  />
                  {showTemplateMenu && (
                      <div className="absolute right-0 top-12 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 origin-top-right">
                          <Button
                            variant="ghost"
                          className="w-full justify-start px-4 py-4 gap-2 text-sm font-bold"
                            onClick={() => handleTemplate('fatura')}
                          >
                            <Icons.Debts size={16} className="text-indigo-400" />
                            <span className="text-zinc-200">Pagar Fatura</span>
                          </Button>
                          <Button
                            variant="ghost"
                          className="w-full justify-start px-4 py-4 gap-2 text-sm font-bold"
                            onClick={() => handleTemplate('pix')}
                          >
                            <Icons.Burn size={16} className="text-rose-400" />
                            <span className="text-zinc-200">Pix / Transferência</span>
                          </Button>
                      </div>
                  )}
               </div>

               {/* Camera Button */}
               <IconButton
                 aria-label="Escanear recibo"
                 icon={isScanning ? <Icons.Loader className="animate-spin" size={18} /> : <Icons.Camera size={20} />}
                 onClick={handleCameraClick}
                 disabled={isScanning}
                 className={`border border-zinc-700 bg-zinc-900/50 text-white ${isScanning ? 'text-emerald-400 bg-emerald-500/20 border-emerald-500' : 'hover:bg-zinc-800'}`}
               />
          </div>
        </div>

      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-bold mb-1">
          <span>Fluxo</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="text-[10px] text-zinc-500 mt-1 flex justify-between">
          <span>{isFutureDate ? 'Data futura: cria pendente' : 'Data de hoje: marca como pago'}</span>
          <span className={isOnline ? 'text-emerald-400' : 'text-amber-300'}>
            {isOnline ? 'Online' : 'Offline: irá sincronizar'}
          </span>
        </div>
      </div>

      {error && (
      <div className="text-xs text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 mb-4">
          {error}
        </div>
      )}

      {/* === STEP 1: OPERATION TYPE (NAVIGATION) === */}
      <div className="mb-2 text-[10px] text-zinc-500 uppercase font-bold tracking-wider">O que aconteceu?</div>
      <div className="mb-8 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
          <div className="flex gap-2">
            {([
              { key: 'expense', label: 'Compra' },
              { key: 'income', label: 'Receita' },
              { key: 'debt_payment', label: 'Pagamento do cartão' },
              { key: 'fee_interest', label: 'Taxas/Juros' },
              { key: 'transfer', label: 'Transferência' },
            ] as const).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTypeChange(t.key)}
                className={`px-4 py-2 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
                  kind === t.key
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/50 scale-105'
                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 space-y-6">
        
        {/* === STEP 2: THE VALUE (CENTRAL) === */}
        <div className="text-center py-2">
          <div className="inline-block relative">
             <span className="text-2xl font-bold text-zinc-500 absolute -left-8 top-2">R$</span>
             <input 
                type="number" 
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`bg-transparent text-7xl font-bold focus:outline-none tracking-tighter w-full text-center placeholder-zinc-800 ${
                    kind === 'income' ? 'text-emerald-400' : 'text-white'
                }`}
                placeholder="0"
            />
          </div>
        </div>

        {/* === STEP 3: DETAILS (CONTEXT AWARE) === */}
        <div className="bg-zinc-950/40 rounded-3xl p-4 space-y-4 border border-white/5 shadow-inner">
            
            {/* Row 1: Who & Date */}
            <div className="flex gap-2">
                <div className="flex-1 bg-zinc-900/80 p-1 rounded-xl flex border border-zinc-800">
                    {PERSONS.map((p) => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => setPersonId(p)}
                        className={`flex-1 h-12 py-2 text-xs font-bold rounded-lg transition-all ${
                        personId === p 
                            ? 'bg-zinc-200 text-zinc-900 shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        {p === 'alan' ? 'Alan' : p === 'kellen' ? 'Kellen' : 'Casa'}
                    </button>
                    ))}
                </div>

                <div className="bg-zinc-900/80 rounded-xl border border-zinc-800 flex items-center px-3 gap-2">
                    <Icons.Calendar size={16} className="text-zinc-500" />
                    <input 
                    type="date"
                    value={date}
                    onChange={(e) => { setDate(e.target.value); setFirstInstallmentDate(e.target.value); }}
                    className="bg-transparent text-white text-xs font-bold focus:outline-none appearance-none [&::-webkit-calendar-picker-indicator]:invert"
                    />
                </div>
            </div>

            {/* Row 2: Payment Method */}
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Como pagou?</label>
              <div className="bg-zinc-900/80 p-1 rounded-xl flex border border-zinc-800">
                  {PAYMENT_METHODS.map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => { setPaymentMethod(pm); if (pm !== 'credit') setIsInstallment(false); }}
                      className={`flex-1 py-4 text-xs font-bold rounded-lg transition-all ${
                          paymentMethod === pm ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500'
                      }`}
                    >
                      {pm === 'credit' ? 'Crédito' : pm === 'pix' ? 'Pix' : pm === 'debit' ? 'Débito' : 'Dinheiro'}
                    </button>
                  ))}
              </div>
              
              {/* Card Selector */}
              {paymentMethod === 'credit' && (
                  <div className="mt-2 overflow-x-auto pb-2 scrollbar-hide">
                      <div className="flex gap-2">
                          {availableCards.map(card => (
                              <button
                              key={card.id}
                              type="button"
                              onClick={() => setSelectedCardId(card.id)}
                              style={{ minWidth: 120 }}
                              className={`p-4 rounded-xl border text-left transition-all ${
                                  selectedCardId === card.id 
                                  ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-900/50' 
                                  : 'bg-zinc-900/80 border-zinc-800 opacity-60'
                              }`}
                              >
                                  <span className={`block text-xs font-bold ${selectedCardId === card.id ? 'text-white' : 'text-zinc-400'}`}>
                                      {card.name}
                                  </span>
                                  <span className={`text-[10px] ${selectedCardId === card.id ? 'text-indigo-200' : 'text-zinc-500'}`}>
                                      Venc. {card.dueDay ?? '--'}
                                  </span>
                              </button>
                          ))}
                          <button
                              type="button"
                              onClick={() => setIsCreatingCard(true)}
                              style={{ minWidth: 56 }}
                              className="px-4 bg-zinc-900/50 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors h-12"
                          >
                              <Icons.Add size={18} />
                              <span className="text-[10px] font-bold ml-1">Cartão</span>
                          </button>
                      </div>
                  </div>
              )}
            </div>

            {/* Row 3: Description & Category */}
            <div>
                 <input 
                    type="text" 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 text-white focus:border-emerald-500 focus:outline-none mb-2"
                    placeholder={kind === 'income' ? "Descrição (ex: Salário)" : "Descrição (ex: Uber, Jantar...)"}
                />
                {kind !== 'debt_payment' && kind !== 'transfer' && (
                  <div className="relative">
                      <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 text-zinc-300 appearance-none focus:border-emerald-500 focus:outline-none"
                      >
                      <option value="" disabled>Selecione Categoria...</option>
                      {displayedCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                      ))}
                      </select>
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-zinc-500">
                        {isSuggesting ? <span className="text-[10px] text-emerald-400 animate-pulse font-bold mr-4">IA...</span> : <Icons.ChevronRight className="rotate-90" size={16} />}
                      </div>
                  </div>
                )}
            </div>

            {/* Parcelamento */}
            {paymentMethod === 'credit' && kind === 'expense' && (
              <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={isInstallment} onChange={(e) => setIsInstallment(e.target.checked)} className="accent-emerald-500" />
                    <span className="text-sm text-white font-bold">Compra parcelada?</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">Gera parcelas futuras automaticamente</span>
                </div>
                {isInstallment && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase font-bold">Parcelas (1-36)</label>
                      <input 
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={36}
                        value={installmentsCount}
                        onChange={(e) => setInstallmentsCount(Math.min(36, Math.max(1, parseInt(e.target.value || '1', 10))))}
                        className="w-full bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-white mt-1 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase font-bold">1ª Parcela</label>
                      <input 
                        type="date"
                        value={firstInstallmentDate}
                        onChange={(e) => setFirstInstallmentDate(e.target.value)}
                        className="w-full bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-white mt-1 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2 text-[10px] text-zinc-400">
                      {installmentsCount > 1
                        ? `Serão geradas ${installmentsCount} parcelas entre ${firstInstallmentDate} e mês ${installmentsCount} a frente.`
                        : 'Entrada única (sem parcelamento).'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Rollover Logic Panel */}
            {isRollover && (
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-700 animate-in fade-in zoom-in-95">
                    <div className="flex items-center gap-2 mb-3 text-amber-400">
                    <Icons.Alert size={16} />
                    <span className="text-sm font-bold">Custo de Rolagem</span>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-400">Quanto foi a taxa/juros? (R$)</label>
                        <input 
                        type="number"
                        inputMode="decimal"
                        value={rolloverFee}
                        onChange={(e) => setRolloverFee(e.target.value)}
                        className="w-full bg-zinc-950 p-2 rounded-lg border border-zinc-700 text-rose-500 focus:border-rose-500 focus:outline-none mt-1"
                        placeholder="0,00"
                        />
                    </div>
                </div>
            )}
        </div>

        {/* === ACTION BUTTONS === */}
        <label className="flex items-center gap-2 text-[11px] text-zinc-400">
          <input 
            type="checkbox" 
            checked={stayOnAdd} 
            onChange={(e) => setStayOnAdd(e.target.checked)} 
            className="accent-emerald-500"
          />
          Manter aberto e adicionar outro
        </label>
        <div className="flex gap-4 pt-2 mt-auto">
          <Button
            variant="ghost"
            className="text-xs"
            type="button"
            onClick={() => { resetForm(); onCancel(); }}
          >
            Voltar
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            type="submit"
            disabled={!amount}
          >
            {kind === 'income' ? 'Receber' : 'Lançar'}
          </Button>
        </div>

      </form>
    </div>
  );
};
