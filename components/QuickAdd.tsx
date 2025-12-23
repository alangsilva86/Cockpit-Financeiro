import React, { useState, useEffect, useRef } from 'react';
import { OperationType, Person, Transaction } from '../types';
import { Icons } from './Icons';
import { suggestCategory, parseReceiptImage, STANDARD_CATEGORIES } from '../services/geminiService';

interface QuickAddProps {
  onAdd: (transactions: Transaction[]) => void;
  onCancel: () => void;
}

export const QuickAdd: React.FC<QuickAddProps> = ({ onAdd, onCancel }) => {
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<OperationType>(OperationType.VIDA);
  const [person, setPerson] = useState<Person>(Person.ALAN);
  
  // Default to empty or first category? Empty forces user to choose (or AI to suggest)
  const [category, setCategory] = useState<string>(''); 
  
  const [isRollover, setIsRollover] = useState(false);
  const [rolloverFee, setRolloverFee] = useState<string>('');
  
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-suggest category on description blur or pause
  useEffect(() => {
    let active = true; 
    const timer = setTimeout(async () => {
      // Trigger if description is meaningful AND category hasn't been manually set (or is empty)
      if (description.length > 3 && !category) {
        if (active) setIsSuggesting(true);
        try {
          const suggestion = await suggestCategory(description);
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
  }, [description, category]);

  // Handle Type Change
  const handleTypeChange = (t: OperationType) => {
    setType(t);
    setIsRollover(t === OperationType.ROLAGEM);
    
    // Auto-set category for certain types to save clicks
    if (t === OperationType.DIVIDA) setCategory('Dívida');
    if (t === OperationType.INVESTIMENTO) setCategory('Investimento');
    if (t === OperationType.JUROS) setCategory('Taxas');
  };

  const handleTemplate = (mode: 'fatura' | 'pix') => {
    setType(OperationType.ROLAGEM);
    setIsRollover(true);
    
    if (mode === 'fatura') {
      setDescription('Pagamento Fatura Cruzado');
      setCategory('Dívida'); // Or Taxas depending on perspective, but Dívida/Rolagem fits better
    } else {
      setDescription('Saque/PIX no Crédito');
      setCategory('Dívida');
    }
  };

  // --- OCR / Camera Logic ---
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
      // Convert to Base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64String = reader.result as string;
        // Remove "data:image/jpeg;base64," prefix for Gemini
        const rawBase64 = base64String.split(',')[1];
        
        const data = await parseReceiptImage(rawBase64);
        
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
    
    // Reset input so same file can be selected again if needed
    event.target.value = '';
  };
  // --------------------------

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !category) return;

    const newTransactions: Transaction[] = [];
    const date = new Date().toISOString();
    const baseId = Date.now().toString();

    // Base transaction
    newTransactions.push({
      id: baseId,
      date,
      amount: parseFloat(amount),
      person,
      description,
      type: isRollover ? OperationType.ROLAGEM : type,
      category,
      status: 'paid'
    });

    // If Rollover with fee
    if (isRollover && rolloverFee) {
      newTransactions.push({
        id: `${baseId}_fee`,
        date,
        amount: parseFloat(rolloverFee),
        person,
        description: `Juros/Taxa: ${description}`,
        type: OperationType.JUROS,
        category: 'Taxas',
        status: 'paid'
      });
    }

    onAdd(newTransactions);
  };

  return (
    <div className="p-4 h-full flex flex-col animate-in slide-in-from-bottom duration-300">
      
      {/* Hidden File Input - Removed 'capture' to allow file selection */}
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Novo Lançamento</h2>
        <button 
          onClick={handleCameraClick}
          disabled={isScanning}
          className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all ${
            isScanning 
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
              : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          {isScanning ? (
            <>
              <Icons.Loader className="animate-spin" size={16} />
              <span className="text-xs font-bold">Lendo...</span>
            </>
          ) : (
            <>
              <Icons.Camera size={18} />
              <span className="text-xs font-bold">Scan / Upload</span>
            </>
          )}
        </button>
      </div>
      
      {/* Templates Section */}
      <div className="mb-6">
        <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Templates Inteligentes</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleTemplate('fatura')}
            className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl flex items-center gap-3 hover:bg-zinc-800 hover:border-zinc-700 transition-all text-left group"
          >
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300">
              <Icons.Debts size={18} />
            </div>
            <div>
              <span className="block text-xs font-bold text-zinc-200">Pagar Fatura</span>
              <span className="block text-[10px] text-zinc-500">com outro cartão</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleTemplate('pix')}
            className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl flex items-center gap-3 hover:bg-zinc-800 hover:border-zinc-700 transition-all text-left group"
          >
            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400 group-hover:bg-rose-500/20 group-hover:text-rose-300">
              <Icons.Burn size={18} />
            </div>
            <div>
              <span className="block text-xs font-bold text-zinc-200">Pix Crédito</span>
              <span className="block text-[10px] text-zinc-500">Saque/Empréstimo</span>
            </div>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 space-y-5">
        
        {/* Value Input */}
        <div>
          <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Valor R$ (Principal)</label>
          <input 
            type="number" 
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-transparent text-4xl font-bold text-white focus:outline-none placeholder-zinc-700 mt-1"
            placeholder="0,00"
          />
        </div>

        {/* Who */}
        <div className="flex gap-2">
          {Object.values(Person).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPerson(p)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                person === p 
                  ? 'bg-zinc-100 text-zinc-900' 
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Description */}
        <div>
           <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Descrição</label>
           <input 
            type="text" 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-zinc-900 p-3 rounded-xl border border-zinc-800 text-white focus:border-emerald-500 focus:outline-none mt-1"
            placeholder="Ex: Uber, Jantar, Fatura C6..."
          />
        </div>

        {/* Type Selection Chips */}
        <div>
          <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-2 block">Tipo de Operação</label>
          <div className="flex flex-wrap gap-2">
            {[OperationType.VIDA, OperationType.ROLAGEM, OperationType.DIVIDA, OperationType.INVESTIMENTO].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  type === t
                    ? t === OperationType.VIDA ? 'bg-blue-600 border-blue-600 text-white'
                    : t === OperationType.ROLAGEM ? 'bg-zinc-600 border-zinc-600 text-white'
                    : t === OperationType.DIVIDA ? 'bg-amber-600 border-amber-600 text-white'
                    : 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Rollover Specific Fields */}
        {isRollover && (
          <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-700 animate-in fade-in zoom-in-95">
             <div className="flex items-center gap-2 mb-3 text-amber-400">
               <Icons.Alert size={16} />
               <span className="text-sm font-bold">Rolagem detectada</span>
             </div>
             <div>
                <label className="text-xs text-zinc-400">Juros/Taxa dessa operação (R$)</label>
                <input 
                  type="number"
                  value={rolloverFee}
                  onChange={(e) => setRolloverFee(e.target.value)}
                  className="w-full bg-zinc-950 p-2 rounded-lg border border-zinc-700 text-rose-500 focus:border-rose-500 focus:outline-none mt-1"
                  placeholder="0,00"
                />
                <p className="text-[10px] text-zinc-500 mt-1">O valor principal será neutro. A taxa entrará como custo (Queimou).</p>
             </div>
          </div>
        )}

        {/* Category (Strict Dropdown) */}
        <div>
           <div className="flex justify-between items-center mb-1">
             <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Categoria</label>
             {isSuggesting && <span className="text-[10px] text-emerald-400 animate-pulse font-bold">IA Sugerindo...</span>}
           </div>
           
           <div className="relative">
             <select
               value={category}
               onChange={(e) => setCategory(e.target.value)}
               className="w-full bg-zinc-900 p-3 rounded-xl border border-zinc-800 text-white appearance-none focus:border-emerald-500 focus:outline-none"
             >
               <option value="" disabled>Selecione uma categoria...</option>
               {STANDARD_CATEGORIES.map(cat => (
                 <option key={cat} value={cat}>{cat}</option>
               ))}
             </select>
             {/* Custom Chevron for aesthetics */}
             <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-zinc-500">
               <Icons.ChevronRight className="rotate-90" size={16} />
             </div>
           </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button 
            type="button" 
            onClick={onCancel}
            className="flex-1 py-4 rounded-xl bg-zinc-800 text-zinc-400 font-bold hover:bg-zinc-700"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            disabled={!amount || !category}
            className="flex-1 py-4 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/50"
          >
            Salvar
          </button>
        </div>

      </form>
    </div>
  );
};