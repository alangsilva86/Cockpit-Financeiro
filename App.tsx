import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { QuickAdd } from './components/QuickAdd';
import { Passivos } from './components/Passivos';
import { Planning } from './components/Planning';
import { Reports } from './components/Reports';
import { Icons } from './components/Icons';
import { AppState, Debt, OperationType, Person, Transaction, View } from './types';
import { INITIAL_CATEGORIES } from './services/geminiService';

// Initial Mock Data with Future/Pending transactions for the Roadmap
const INITIAL_STATE: AppState = {
  monthlyIncome: 25000,
  variableCap: 7500, // 30% of income rule
  categories: INITIAL_CATEGORIES,
  transactions: [
    // Past/Paid
    { id: '1', date: new Date().toISOString(), amount: 200, person: Person.ALAN, description: 'Uber Semana', type: OperationType.VIDA, category: 'Transporte', paymentMethod: 'Credit', cardId: 'd1', status: 'paid', isRecurring: false },
    
    // Future/Pending (The Roadmap)
    { id: '2', date: new Date(new Date().setDate(5)).toISOString(), amount: 2500, person: Person.CASA, description: 'Aluguel', type: OperationType.VIDA, category: 'Moradia', paymentMethod: 'Pix', status: 'pending', isRecurring: true },
    { id: '3', date: new Date(new Date().setDate(10)).toISOString(), amount: 650, person: Person.CASA, description: 'Condomínio', type: OperationType.VIDA, category: 'Moradia', paymentMethod: 'Pix', status: 'pending', isRecurring: true },
    { id: '4', date: new Date(new Date().setDate(12)).toISOString(), amount: 11200, person: Person.ALAN, description: 'Fatura XP (Estimada)', type: OperationType.ROLAGEM, category: 'Cartão', paymentMethod: 'Pix', status: 'pending', isRecurring: true },
    { id: '5', date: new Date(new Date().setDate(12)).toISOString(), amount: 400, person: Person.ALAN, description: 'Juros Antecipação XP', type: OperationType.JUROS, category: 'Taxas', paymentMethod: 'Debit', status: 'pending', isRecurring: false },
    { id: '6', date: new Date(new Date().setDate(15)).toISOString(), amount: 800, person: Person.KELLEN, description: 'Mercado Semanal', type: OperationType.VIDA, category: 'Alimentação', paymentMethod: 'Credit', cardId: 'd2', status: 'pending', isRecurring: true },
  ],
  debts: [
    { id: 'd1', name: 'Nubank Black', balance: 12400, currentInvoice: 3850, dueDate: '05', minPayment: 1500, rolloverCost: 14, status: 'critical' },
    { id: 'd2', name: 'XP Infinite', balance: 3200, currentInvoice: 3200, dueDate: '15', minPayment: 500, rolloverCost: 8, status: 'ok' },
  ]
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  const handleAddTransactions = (newTx: Transaction[]) => {
    // New transactions are added as 'paid' by default if they are quick added now, 
    // or 'pending' if future date (QuickAdd simplified always adds now for this MVP)
    const processedTx = newTx.map(t => ({
      ...t,
      status: 'paid' as const
    }));

    setState(prev => ({
      ...prev,
      transactions: [...prev.transactions, ...processedTx]
    }));
    setCurrentView('dashboard');
  };

  const handleToggleStatus = (id: string) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.map(t => 
        t.id === id ? { ...t, status: t.status === 'pending' ? 'paid' : 'pending' } : t
      )
    }));
  };

  const handleGenerateNextMonth = () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    // Simple logic: Copy all recurring transactions to next month
    const nextMonthTx = state.transactions
      .filter(t => t.isRecurring)
      .map(t => {
        const d = new Date(t.date);
        d.setMonth(d.getMonth() + 1);
        return {
          ...t,
          id: Math.random().toString(36).substr(2, 9),
          date: d.toISOString(),
          status: 'pending' as const
        };
      });

    setState(prev => ({
      ...prev,
      transactions: [...prev.transactions, ...nextMonthTx]
    }));
    alert(`Gerado ${nextMonthTx.length} itens para o próximo mês.`);
    setCurrentView('dashboard');
  };

  const handleAddDebt = (debt: Debt) => {
    setState(prev => ({
      ...prev,
      debts: [...prev.debts, debt]
    }));
  };

  const handleUpdateDebt = (updatedDebt: Debt) => {
    setState(prev => ({
      ...prev,
      debts: prev.debts.map(d => d.id === updatedDebt.id ? updatedDebt : d)
    }));
  };

  const handleAddCategory = (category: string) => {
    if (!state.categories.includes(category)) {
      setState(prev => ({
        ...prev,
        categories: [...prev.categories, category].sort()
      }));
    }
  };

  const NavButton = ({ view, icon: Icon, label, desktop }: { view: View, icon: any, label: string, desktop?: boolean }) => (
    <button 
      onClick={() => setCurrentView(view)}
      className={`
        flex items-center transition-all duration-200
        ${desktop 
            ? `w-full px-4 py-3 rounded-xl gap-3 mb-2 hover:bg-zinc-900 ${currentView === view ? 'bg-zinc-900 text-emerald-400 border border-zinc-800' : 'text-zinc-500'}`
            : `flex-col justify-center w-full py-1 space-y-1 ${currentView === view ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`
        }
      `}
    >
      <Icon size={desktop ? 20 : 20} strokeWidth={currentView === view ? 2.5 : 2} />
      <span className={`${desktop ? 'text-sm font-bold' : 'text-[10px] font-medium'}`}>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-emerald-900 selection:text-white flex overflow-hidden">
      
      {/* === DESKTOP SIDEBAR === */}
      <aside className="hidden md:flex flex-col w-64 bg-zinc-950 border-r border-zinc-900 p-6 flex-shrink-0 z-20">
        <div className="mb-10 pl-2">
            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
            Cockpit 2026
            </h1>
            <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">
            Financial Control
            </p>
        </div>

        <nav className="flex-1">
            <NavButton view="dashboard" icon={Icons.Calendar} label="Meu Mês" desktop />
            <NavButton view="reports" icon={Icons.Reports} label="Relatórios" desktop />
            <NavButton view="debts" icon={Icons.Debts} label="Passivos" desktop />
            <NavButton view="plan" icon={Icons.Plan} label="Planejamento" desktop />
        </nav>

        <button 
            onClick={() => setCurrentView('add')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
        >
            <Icons.Add size={18} /> Novo Lançamento
        </button>

        <div className="mt-8 pt-6 border-t border-zinc-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-400">
              AL
            </div>
            <div>
                <p className="text-sm font-bold text-white">Alan</p>
                <p className="text-xs text-zinc-500">Premium User</p>
            </div>
        </div>
      </aside>

      {/* === MAIN CONTENT WRAPPER === */}
      <main className="flex-1 relative flex flex-col h-screen overflow-hidden bg-black md:bg-zinc-950/50">
        
        {/* Mobile Header (Hidden on Desktop) */}
        {currentView !== 'add' && (
          <header className="md:hidden px-6 pt-6 pb-2 flex justify-between items-center bg-zinc-950/80 backdrop-blur sticky top-0 z-10 flex-shrink-0">
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
                Cockpit 2026
              </h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                {currentView === 'reports' ? 'Inteligência' : 'Meu Mês'}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-400">
              AL
            </div>
          </header>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto pb-24 md:pb-0 scroll-smooth">
            {/* Desktop Center Container - constrained for readability but wider than mobile */}
            <div className="md:max-w-2xl md:mx-auto md:my-6 md:bg-zinc-950 md:min-h-[90vh] md:rounded-2xl md:border md:border-zinc-900/50 md:shadow-2xl">
                {currentView === 'dashboard' && <Dashboard state={state} onToggleStatus={handleToggleStatus} />}
                {currentView === 'reports' && <Reports state={state} onGenerateNextMonth={handleGenerateNextMonth} />}
                {currentView === 'add' && (
                    <QuickAdd 
                    onAdd={handleAddTransactions} 
                    onCancel={() => setCurrentView('dashboard')} 
                    availableCategories={state.categories}
                    availableCards={state.debts}
                    onAddCard={handleAddDebt}
                    />
                )}
                {currentView === 'debts' && (
                    <Passivos 
                    debts={state.debts} 
                    onAddDebt={handleAddDebt}
                    onUpdateDebt={handleUpdateDebt}
                    />
                )}
                {currentView === 'plan' && (
                    <Planning 
                    onGenerateNextMonth={handleGenerateNextMonth} 
                    variableCap={state.variableCap} 
                    categories={state.categories}
                    onAddCategory={handleAddCategory}
                    />
                )}
            </div>
        </div>

        {/* Mobile Bottom Navigation (Hidden on Add screen & Desktop) */}
        {currentView !== 'add' && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-lg border-t border-zinc-900 pb-safe pt-2 px-2 z-50">
            <div className="flex justify-between items-end pb-4 px-2 max-w-md mx-auto">
              <NavButton view="dashboard" icon={Icons.Calendar} label="Meu Mês" />
              <NavButton view="reports" icon={Icons.Reports} label="Relatórios" />
              
              {/* Floating Action Button (FAB) */}
              <div className="relative -top-5">
                <button 
                  onClick={() => setCurrentView('add')}
                  className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-900/50 hover:bg-emerald-500 transition-transform active:scale-95 border-4 border-zinc-950"
                >
                  <Icons.Add size={28} />
                </button>
              </div>

              <NavButton view="debts" icon={Icons.Debts} label="Passivos" />
              <NavButton view="plan" icon={Icons.Plan} label="Plano" />
            </div>
          </nav>
        )}
      </main>
    </div>
  );
};

export default App;