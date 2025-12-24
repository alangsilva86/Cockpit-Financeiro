import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Debt, OperationType, PaymentMethod, Person, Transaction } from '../types';
import { Icons } from './Icons';
import { suggestCategory, parseReceiptImage, INCOME_CATEGORIES } from '../services/geminiService';

interface QuickAddProps {
  onAdd: (transactions: Transaction[]) => void;
  onCancel: () => void;
  availableCategories: string[];
  availableCards: Debt[];
  onAddCard: (card: Debt) => void;
}

export const QuickAdd: React.FC<QuickAddProps> = ({ onAdd, onCancel, availableCategories, availableCards, onAddCard }) => {
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<OperationType>(OperationType.VIDA);
  const [person, setPerson] = useState<Person>(Person.ALAN);
  
  // Default to Today (YYYY-MM-DD)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [category, setCategory] = useState<string>(''); 
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Credit');
  const [selectedCardId, setSelectedCardId] = useState<string>('');

  const [isRollover, setIsRollover] = useState(false);
  const [rolloverFee, setRolloverFee] = useState<string>('');
  
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardDay, setNewCardDay] = useState('');

  // UI State for Template Menu
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  // --- Filter Categories based on Type ---
  const displayedCategories = useMemo(() => {
    if (type === OperationType.RECEITA) {
        return INCOME_CATEGORIES;
    }
    return availableCategories.filter(cat => !INCOME_CATEGORIES.includes(cat));
  }, [type, availableCategories]);

  // --- Visual Context Logic ---
  const getAmbientColor = () => {
    switch (type) {
        case OperationType.RECEITA: return 'from-emerald-900/40 to-zinc-950 border-emerald-900/30';
        case OperationType.VIDA: return 'from-blue-900/20 to-zinc-950 border-blue-900/20';
        case OperationType.JUROS: return 'from-rose-900/30 to-zinc-950 border-rose-900/30';
        case OperationType.DIVIDA: return 'from-indigo-900/30 to-zinc-950 border-indigo-900/30';
        case OperationType.ROLAGEM: return 'from-zinc-800 to-zinc-950 border-zinc-700';
        default: return 'from-zinc-900/20 to-zinc-950 border-zinc-800';
    }
  };

  useEffect(() => {
    if (availableCards.length > 0 && !selectedCardId) {
      setSelectedCardId(availableCards[0].id);
    }
  }, [availableCards, selectedCardId]);

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

  const handleTypeChange = (t: OperationType) => {
    setType(t);
    setIsRollover(t === OperationType.ROLAGEM);
    
    if (t === OperationType.RECEITA) {
        setCategory('Salário');
        setPaymentMethod('Pix'); 
    } else if (t === OperationType.DIVIDA) {
        setCategory('Dívida');
    } else if (t === OperationType.INVESTIMENTO) {
        setCategory('Investimento');
    } else if (t === OperationType.JUROS) {
        setCategory('Taxas');
    } else {
        if (INCOME_CATEGORIES.includes(category)) setCategory('');
        setPaymentMethod('Credit');
    }
  };

  const handleTemplate = (mode: 'fatura' | 'pix') => {
    setType(OperationType.ROLAGEM);
    setIsRollover(true);
    
    if (mode === 'fatura') {
      setDescription('Pagamento Fatura Cruzado');
      setCategory('Dívida'); 
      setPaymentMethod('Pix'); 
    } else {
      setDescription('Saque/PIX no Crédito');
      setCategory('Dívida');
      setPaymentMethod('Credit');
    }
    setShowTemplateMenu(false);
  };

  const handleSaveNewCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardName) return;

    const newId = Date.now().toString();
    const newCard: Debt = {
        id: newId,
        name: newCardName,
        dueDate: newCardDay || '01',
        balance: 0,
        minPayment: 0,
        rolloverCost: 10,
        status: 'ok',
        currentInvoice: 0
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
    if (!amount || !description || !category) return;
    if (paymentMethod === 'Credit' && !selectedCardId && type !== OperationType.RECEITA) {
        alert("Selecione um cartão de crédito");
        return;
    }

    const newTransactions: Transaction[] = [];
    
    // Construct Date object based on input
    const finalDate = new Date(date);
    // Preserve current time to avoid timezone shifts affecting the date display later, 
    // unless user picks a past date, then time is less relevant but we keep it clean.
    const now = new Date();
    finalDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    const isoDate = finalDate.toISOString();
    
    const baseId = Date.now().toString();

    newTransactions.push({
      id: baseId,
      date: isoDate,
      amount: parseFloat(amount),
      person,
      description,
      type: isRollover ? OperationType.ROLAGEM : type,
      category,
      paymentMethod,
      cardId: paymentMethod === 'Credit' ? selectedCardId : undefined,
      status: 'paid'
    });

    if (isRollover && rolloverFee) {
      newTransactions.push({
        id: `${baseId}_fee`,
        date: isoDate,
        amount: parseFloat(rolloverFee),
        person,
        description: `Juros/Taxa: ${description}`,
        type: OperationType.JUROS,
        category: 'Taxas',
        paymentMethod: paymentMethod,
        cardId: paymentMethod === 'Credit' ? selectedCardId : undefined,
        status: 'paid'
      });
    }

    onAdd(newTransactions);
  };

  return (
    <div className={`p-4 h-full flex flex-col animate-in slide-in-from-bottom duration-300 relative bg-gradient-to-b ${getAmbientColor()}`}>
      
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
                    className="w-full bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-white mt-1 focus:border-indigo-500 focus:outline-none"
                  />
              </div>
              <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold">Dia Vencimento</label>
                  <input 
                    type="number"
                    value={newCardDay}
                    onChange={e => setNewCardDay(e.target.value)}
                    placeholder="Ex: 05"
                    className="w-full bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-white mt-1 focus:border-indigo-500 focus:outline-none"
                  />
              </div>
              <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsCreatingCard(false)} className="flex-1 py-3 bg-zinc-800 rounded-xl font-bold text-zinc-400">Cancelar</button>
                  <button type="submit" disabled={!newCardName} className="flex-1 py-3 bg-indigo-600 rounded-xl font-bold text-white hover:bg-indigo-500">Salvar</button>
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
                <button
                    onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                    className="w-10 h-10 rounded-full bg-zinc-900/50 border border-zinc-700 text-zinc-300 flex items-center justify-center hover:bg-zinc-800"
                >
                    <Icons.More size={20} />
                </button>
                {showTemplateMenu && (
                    <div className="absolute right-0 top-12 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 origin-top-right">
                        <button
                            type="button"
                            onClick={() => handleTemplate('fatura')}
                            className="w-full p-3 rounded-lg flex items-center gap-3 hover:bg-zinc-800 transition-all text-left"
                        >
                            <Icons.Debts size={16} className="text-indigo-400" />
                            <div className="text-sm font-bold text-zinc-200">Pagar Fatura</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTemplate('pix')}
                            className="w-full p-3 rounded-lg flex items-center gap-3 hover:bg-zinc-800 transition-all text-left"
                        >
                            <Icons.Burn size={16} className="text-rose-400" />
                            <div className="text-sm font-bold text-zinc-200">Pix Crédito</div>
                        </button>
                    </div>
                )}
             </div>

            {/* Camera Button */}
            <button 
                onClick={handleCameraClick}
                disabled={isScanning}
                className={`flex items-center gap-2 px-4 h-10 rounded-full border transition-all ${
                    isScanning 
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                    : 'bg-zinc-900/50 border-zinc-700 text-white hover:bg-zinc-800'
                }`}
            >
            {isScanning ? (
                <Icons.Loader className="animate-spin" size={18} />
            ) : (
                <Icons.Camera size={20} />
            )}
            </button>
        </div>
      </div>
      
      {/* === STEP 1: OPERATION TYPE (NAVIGATION) === */}
      <div className="mb-8 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
          <div className="flex gap-2">
            {[OperationType.VIDA, OperationType.RECEITA, OperationType.DIVIDA, OperationType.JUROS, OperationType.INVESTIMENTO, OperationType.ROLAGEM].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                className={`px-4 py-2 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
                  type === t
                    ? t === OperationType.RECEITA ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/50 scale-105'
                    : t === OperationType.VIDA ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/50 scale-105'
                    : t === OperationType.ROLAGEM ? 'bg-zinc-600 border-zinc-500 text-white'
                    : t === OperationType.DIVIDA ? 'bg-indigo-600 border-indigo-500 text-white'
                    : t === OperationType.JUROS ? 'bg-rose-600 border-rose-500 text-white'
                    : 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                {t}
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
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`bg-transparent text-7xl font-bold focus:outline-none tracking-tighter w-full text-center placeholder-zinc-800 ${
                    type === OperationType.RECEITA ? 'text-emerald-400' : 'text-white'
                }`}
                placeholder="0"
            />
          </div>
        </div>

        {/* === STEP 3: DETAILS (CONTEXT AWARE) === */}
        <div className="bg-zinc-950/40 rounded-3xl p-4 space-y-4 border border-white/5 shadow-inner">
            
            {/* Row 1: Who & Date */}
            <div className="flex gap-3">
                <div className="flex-1 bg-zinc-900/80 p-1 rounded-xl flex border border-zinc-800">
                    {Object.values(Person).map((p) => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => setPerson(p)}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        person === p 
                            ? 'bg-zinc-200 text-zinc-900 shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        {p}
                    </button>
                    ))}
                </div>

                <div className="bg-zinc-900/80 rounded-xl border border-zinc-800 flex items-center px-3 gap-2">
                    <Icons.Calendar size={16} className="text-zinc-500" />
                    <input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent text-white text-xs font-bold focus:outline-none appearance-none [&::-webkit-calendar-picker-indicator]:invert"
                    />
                </div>
            </div>

            {/* Row 2: Payment Method (Hidden for Revenue) */}
            {type !== OperationType.RECEITA && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Como pagou?</label>
                <div className="bg-zinc-900/80 p-1 rounded-xl flex border border-zinc-800">
                    <button
                        type="button"
                        onClick={() => setPaymentMethod('Credit')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                            paymentMethod === 'Credit' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500'
                        }`}
                    >
                        Crédito
                    </button>
                    <button
                        type="button"
                        onClick={() => setPaymentMethod('Pix')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                            paymentMethod === 'Pix' || paymentMethod === 'Debit' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500'
                        }`}
                    >
                        À Vista / Pix
                    </button>
                </div>
                
                {/* Card Selector */}
                {paymentMethod === 'Credit' && (
                    <div className="mt-2 overflow-x-auto pb-2 scrollbar-hide">
                        <div className="flex gap-2">
                            {availableCards.map(card => (
                                <button
                                key={card.id}
                                type="button"
                                onClick={() => setSelectedCardId(card.id)}
                                className={`min-w-[120px] p-3 rounded-xl border text-left transition-all ${
                                    selectedCardId === card.id 
                                    ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-900/50' 
                                    : 'bg-zinc-900/80 border-zinc-800 opacity-60'
                                }`}
                                >
                                    <span className={`block text-xs font-bold ${selectedCardId === card.id ? 'text-white' : 'text-zinc-400'}`}>
                                        {card.name}
                                    </span>
                                    <span className={`text-[10px] ${selectedCardId === card.id ? 'text-indigo-200' : 'text-zinc-500'}`}>
                                        Venc. {card.dueDate}
                                    </span>
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setIsCreatingCard(true)}
                                className="min-w-[40px] px-3 bg-zinc-900/50 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                            >
                                <Icons.Add size={18} />
                                <span className="text-[10px] font-bold ml-1">Cartão</span>
                            </button>
                        </div>
                    </div>
                )}
                </div>
            )}

            {/* Row 3: Description & Category */}
            <div>
                 <input 
                    type="text" 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 text-white focus:border-emerald-500 focus:outline-none mb-2"
                    placeholder={type === OperationType.RECEITA ? "Descrição (ex: Salário)" : "Descrição (ex: Uber, Jantar...)"}
                />
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
            </div>

            {/* Rollover Logic Panel */}
            {isRollover && (
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-700 animate-in fade-in zoom-in-95">
                    <div className="flex items-center gap-2 mb-3 text-amber-400">
                    <Icons.Alert size={16} />
                    <span className="text-sm font-bold">Custo da Rolagem</span>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-400">Quanto foi a taxa/juros? (R$)</label>
                        <input 
                        type="number"
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
        <div className="flex gap-4 pt-2 mt-auto">
          <button 
            type="button" 
            onClick={onCancel}
            className="w-24 py-4 rounded-2xl bg-zinc-900/50 text-zinc-500 font-bold hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
          >
            Voltar
          </button>
          <button 
            type="submit" 
            disabled={!amount || !category}
            className={`flex-1 py-4 rounded-2xl font-bold text-lg text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-xl transition-all active:scale-95 ${
                 type === OperationType.RECEITA 
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30' 
                    : 'bg-white text-black hover:bg-zinc-200 shadow-white/10'
            }`}
          >
            {type === OperationType.RECEITA ? 'Receber' : 'Gastar'}
          </button>
        </div>

      </form>
    </div>
  );
};