import React, { useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { QuickAdd } from './components/QuickAdd';
import { Passivos } from './components/Passivos';
import { Planning } from './components/Planning';
import { Reports } from './components/Reports';
import { Icons } from './components/Icons';
import { AppState, Card, InstallmentPlan, Transaction, TransactionDraft, View } from './types';
import { INITIAL_CATEGORIES } from './services/categories';
import { syncAppState } from './services/syncService';

const SCHEMA_VERSION = 2;

const deriveCompetence = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const nowIso = () => new Date().toISOString();

// Initial Mock Data adapted ao novo modelo
const INITIAL_STATE: AppState = {
  schemaVersion: SCHEMA_VERSION,
  monthlyIncome: 25000,
  variableCap: 7500, // 30% of income rule
  categories: INITIAL_CATEGORIES,
  cards: [
    { id: 'd1', name: 'Nubank Black', dueDay: 5, closingDay: 28, aprMonthly: 14, limit: 20000, createdAt: nowIso(), updatedAt: nowIso() },
    { id: 'd2', name: 'XP Infinite', dueDay: 15, closingDay: 5, aprMonthly: 8, limit: 30000, createdAt: nowIso(), updatedAt: nowIso() },
  ],
  installmentPlans: [],
  transactions: [],
  updatedAt: nowIso(),
};

const STORAGE_KEY = 'cockpit-state-v2';
const VIEW_KEY = 'cockpit-view';

const normalizeTransaction = (tx: Transaction): Transaction => {
  const status: Transaction['status'] = tx.status || (new Date(tx.date) > new Date() ? 'pending' : 'paid');
  const createdAt = tx.createdAt || tx.date || nowIso();
  const updatedAt = tx.updatedAt || createdAt;
  return {
    ...tx,
    competenceMonth: tx.competenceMonth || deriveCompetence(tx.date),
    status,
    needsSync: tx.needsSync ?? false,
    createdAt,
    updatedAt,
    deleted: tx.deleted ?? false,
  };
};

const normalizeCard = (card: Card): Card => {
  const createdAt = card.createdAt || nowIso();
  return {
    ...card,
    createdAt,
    updatedAt: card.updatedAt || createdAt,
    deleted: card.deleted ?? false,
  };
};

const normalizePlan = (plan: InstallmentPlan): InstallmentPlan => {
  const createdAt = plan.createdAt || nowIso();
  return {
    ...plan,
    createdAt,
    updatedAt: plan.updatedAt || createdAt,
    deleted: plan.deleted ?? false,
  };
};

type LegacyTransaction = any;
type LegacyState = any;

const mapLegacyTransaction = (tx: LegacyTransaction): Transaction => {
  const type = tx.type || tx.kind;
  const kindMap: Record<string, Transaction['kind']> = {
    Receita: 'income',
    Vida: 'expense',
    Dívida: 'debt_payment',
    Rolagem: 'transfer',
    Juros: 'fee_interest',
    Investimento: 'transfer',
  };
  const kind = kindMap[type] || tx.kind || 'expense';
  const direction: Transaction['direction'] = kind === 'income' ? 'in' : 'out';
  const paymentMethod = (tx.paymentMethod || '').toString().toLowerCase() as Transaction['paymentMethod'];
  const personId = tx.person ? tx.person.toString().toLowerCase() : undefined;
  return normalizeTransaction({
    id: tx.id || Math.random().toString(36).slice(2),
    date: tx.date || new Date().toISOString(),
    competenceMonth: tx.competenceMonth || deriveCompetence(tx.date || new Date().toISOString()),
    direction,
    kind,
    amount: tx.amount || 0,
    description: tx.description || '',
    personId,
    categoryId: tx.category || tx.categoryId,
    paymentMethod: paymentMethod || 'pix',
    cardId: tx.cardId,
    status: tx.status || 'pending',
    tags: tx.tags,
    installment: tx.installment,
    isRecurring: tx.isRecurring,
    needsSync: tx.needsSync,
  });
};

const migrateState = (raw: LegacyState): AppState => {
  if (!raw) return INITIAL_STATE;
  if (raw.schemaVersion === SCHEMA_VERSION) {
    return {
      ...INITIAL_STATE,
      ...raw,
      transactions: (raw.transactions || []).map(normalizeTransaction),
      installmentPlans: (raw.installmentPlans || []).map(normalizePlan),
      cards: (raw.cards || []).map(normalizeCard),
      updatedAt: raw.updatedAt || nowIso(),
    };
  }

  const legacyTx = (raw.transactions || []).map(mapLegacyTransaction);
  const legacyCards: Card[] =
    (raw.debts || raw.cards || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      dueDay: d.dueDate ? parseInt(d.dueDate, 10) : undefined,
      aprMonthly: d.rolloverCost,
      limit: d.balance,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })) || [];

  return {
    ...INITIAL_STATE,
    schemaVersion: SCHEMA_VERSION,
    transactions: legacyTx.map(normalizeTransaction),
    cards: (legacyCards.length ? legacyCards : INITIAL_STATE.cards).map(normalizeCard),
    categories: raw.categories || INITIAL_CATEGORIES,
    monthlyIncome: raw.monthlyIncome ?? INITIAL_STATE.monthlyIncome,
    variableCap: raw.variableCap ?? INITIAL_STATE.variableCap,
    installmentPlans: (raw.installmentPlans || []).map(normalizePlan),
    updatedAt: raw.updatedAt || nowIso(),
  };
};

const loadPersistedState = (): AppState => {
  if (typeof localStorage === 'undefined') return INITIAL_STATE;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw);
    return migrateState(parsed);
  } catch (error) {
    console.error('Erro ao hidratar estado, usando padrão', error);
    return INITIAL_STATE;
  }
};

const getInitialView = (): View => {
  if (typeof window === 'undefined') return 'dashboard';
  const hash = window.location.hash.replace('#/', '').replace('#', '');
  const saved = localStorage.getItem(VIEW_KEY) as View | null;
  const views: View[] = ['dashboard', 'reports', 'add', 'debts', 'plan'];
  if (views.includes(hash as View)) return hash as View;
  if (saved && views.includes(saved)) return saved as View;
  return 'dashboard';
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(getInitialView);
  const [state, setState] = useState<AppState>(loadPersistedState);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null);
  const [quickAddDraft, setQuickAddDraft] = useState<TransactionDraft | null>(null);
  const [lastGeneration, setLastGeneration] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [swUpdateReady, setSwUpdateReady] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number>(0);
  const [forceSync, setForceSync] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Não foi possível salvar o estado localmente', error);
    }
  }, [state]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.location.hash = `#/${currentView}`;
    localStorage.setItem(VIEW_KEY, currentView);
  }, [currentView]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      const views: View[] = ['dashboard', 'reports', 'add', 'debts', 'plan'];
      if (views.includes(hash as View)) setCurrentView(hash as View);
    };
    window.addEventListener('hashchange', handler);
    const swHandler = () => setSwUpdateReady(true);
    window.addEventListener('sw-update-ready', swHandler as any);
    return () => {
      window.removeEventListener('hashchange', handler);
      window.removeEventListener('sw-update-ready', swHandler as any);
    };
  }, []);

  useEffect(() => {
    const online = () => {
      setIsOnline(true);
      setForceSync(true);
    };
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler as any);
    return () => window.removeEventListener('beforeinstallprompt', handler as any);
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    let mounted = true;

    const attemptSync = async (force = false) => {
      if (!mounted || isSyncing) return;
      const now = Date.now();
      if (!force && now - lastSyncAt < 3000) return;
      setIsSyncing(true);
      try {
        const result = await syncAppState(state);
        if (result?.state) {
          setState({
            ...result.state,
            transactions: result.state.transactions.map(normalizeTransaction),
            cards: result.state.cards.map(normalizeCard),
            installmentPlans: result.state.installmentPlans.map(normalizePlan),
          });
          setLastSyncAt(Date.now());
          pushToast('Sincronizado com a nuvem');
        }
      } catch (error) {
        console.error('Erro ao sincronizar', error);
        pushToast('Falha na sincronização. Tentaremos novamente.', 'error');
      } finally {
        setIsSyncing(false);
        if (force) setForceSync(false);
      }
    };

    attemptSync(forceSync);
    const interval = setInterval(attemptSync, 20000);
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        attemptSync();
      }
    };
    window.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [isOnline, isSyncing, state.updatedAt, lastSyncAt, forceSync]);

  const pushToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2400);
  };

  const handleAddTransactions = (
    newTx: Transaction[],
    options?: { stayOnAdd?: boolean; newPlan?: InstallmentPlan | null }
  ) => {
    const now = new Date();
    const processedTx = newTx.map((t) => {
      const txDate = new Date(t.date);
      const createdAt = t.createdAt || nowIso();
      const updatedAt = t.updatedAt || createdAt;
      return {
        ...t,
        competenceMonth: t.competenceMonth || deriveCompetence(t.date),
        status: t.status || (txDate > now ? 'pending' : 'paid'),
        needsSync: t.needsSync ?? !isOnline,
        createdAt,
        updatedAt,
      };
    });

    setState((prev) => ({
      ...prev,
      transactions: [...prev.transactions, ...processedTx],
      installmentPlans: options?.newPlan ? [...prev.installmentPlans, normalizePlan({ ...options.newPlan, updatedAt: nowIso() })] : prev.installmentPlans,
      updatedAt: nowIso(),
    }));

    pushToast(isOnline ? 'Lançamento salvo' : 'Salvo offline. Sincroniza quando voltar à rede.');
    if (!options?.stayOnAdd) {
      setCurrentView('dashboard');
      setQuickAddDraft(null);
    }
  };

  const handleToggleStatus = (id: string) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.map(t => 
        t.id === id ? { ...t, status: t.status === 'pending' ? 'paid' : 'pending', needsSync: t.needsSync || !isOnline, updatedAt: nowIso() } : t
      ),
      updatedAt: nowIso(),
    }));
  };

  const handleGenerateNextMonth = () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthLabel = nextMonth.toLocaleDateString('pt-BR', { month: 'long' });
    
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
          competenceMonth: deriveCompetence(d.toISOString()),
          status: 'pending' as const,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
      });

    setState(prev => ({
      ...prev,
      transactions: [...prev.transactions, ...nextMonthTx.map(normalizeTransaction)],
      updatedAt: nowIso(),
    }));
    const message = `Gerado ${nextMonthTx.length} itens para ${monthLabel}.`;
    setLastGeneration(message);
    pushToast(message);
    setCurrentView('dashboard');
  };

  const handleAddCard = (card: Card) => {
    setState(prev => ({
      ...prev,
      cards: [...prev.cards, normalizeCard({ ...card, updatedAt: nowIso() })],
      updatedAt: nowIso(),
    }));
  };

  const handleUpdateCard = (updatedCard: Card) => {
    setState(prev => ({
      ...prev,
      cards: prev.cards.map(d => d.id === updatedCard.id ? normalizeCard({ ...updatedCard, updatedAt: nowIso() }) : d),
      updatedAt: nowIso(),
    }));
  };

  const handleAddCategory = (category: string) => {
    if (!state.categories.includes(category)) {
      setState(prev => ({
        ...prev,
        categories: [...prev.categories, category].sort(),
        updatedAt: nowIso(),
      }));
    }
  };

  const handleBudgetUpdate = (payload: { monthlyIncome?: number; variableCap?: number }) => {
    setState((prev) => ({
      ...prev,
      monthlyIncome: payload.monthlyIncome ?? prev.monthlyIncome,
      variableCap: payload.variableCap ?? prev.variableCap,
      updatedAt: nowIso(),
    }));
    pushToast('Planejamento atualizado');
  };

  const handleOpenQuickAddWithDraft = (draft: TransactionDraft) => {
    setQuickAddDraft(draft);
    setCurrentView('add');
  };

  const handleInstallClick = async () => {
    if (!installPrompt?.prompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    setShowInstallBanner(false);
    pushToast(outcome === 'accepted' ? 'PWA instalado' : 'Instalação cancelada', outcome === 'accepted' ? 'success' : 'error');
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    setInstallPrompt(null);
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
        
        {/* Network / generation signals */}
        {!isOnline && (
          <div className="px-4 py-2 text-xs bg-amber-500/10 text-amber-300 border-b border-amber-500/30 flex items-center gap-2">
            <Icons.Alert size={14} /> Modo offline: novos lançamentos ficam pendentes para sincronizar.
          </div>
        )}
        {isSyncing && (
          <div className="px-4 py-2 text-xs bg-emerald-500/10 text-emerald-200 border-b border-emerald-500/30 flex items-center gap-2">
            <Icons.Loader className="animate-spin" size={14} /> Sincronizando lançamentos...
          </div>
        )}
        {lastGeneration && (
          <div className="px-4 py-2 text-xs bg-emerald-500/10 text-emerald-200 border-b border-emerald-500/30 flex items-center justify-between">
            <span>{lastGeneration}</span>
            <button onClick={() => setLastGeneration(null)} className="text-emerald-400 hover:text-white text-[10px]">OK</button>
          </div>
        )}
        
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
                {currentView === 'dashboard' && (
                  <Dashboard 
                    state={state} 
                    onToggleStatus={handleToggleStatus} 
                    onQuickAddDraft={handleOpenQuickAddWithDraft}
                    isOnline={isOnline}
                  />
                )}
                {currentView === 'reports' && (
                  <Reports 
                    state={state} 
                    onGenerateNextMonth={handleGenerateNextMonth} 
                    onQuickAddDraft={handleOpenQuickAddWithDraft}
                    onToast={pushToast}
                    onUpdateInstallments={(plans, txs) => setState((prev) => ({ ...prev, installmentPlans: plans, transactions: txs }))}
                  />
                )}
                {currentView === 'add' && (
                    <QuickAdd 
                      onAdd={handleAddTransactions} 
                      onCancel={() => setCurrentView('dashboard')} 
                      availableCategories={state.categories}
                      availableCards={state.cards.filter((c) => !c.deleted)}
                      onAddCard={handleAddCard}
                      draft={quickAddDraft}
                      onClearDraft={() => setQuickAddDraft(null)}
                      isOnline={isOnline}
                      onToast={pushToast}
                    />
                )}
                {currentView === 'debts' && (
                    <Passivos 
                      cards={state.cards.filter((c) => !c.deleted)} 
                      transactions={state.transactions.filter((t) => !t.deleted)}
                      installmentPlans={state.installmentPlans.filter((p) => !p.deleted)}
                      onAddCard={handleAddCard}
                      onUpdateCard={handleUpdateCard}
                      onUpdateInstallments={(plans, txs) => setState((prev) => ({ ...prev, installmentPlans: plans, transactions: txs }))}
                      onQuickAddDraft={handleOpenQuickAddWithDraft}
                    />
                )}
                {currentView === 'plan' && (
                    <Planning 
                      onGenerateNextMonth={handleGenerateNextMonth} 
                      variableCap={state.variableCap} 
                      monthlyIncome={state.monthlyIncome}
                      categories={state.categories}
                      onAddCategory={handleAddCategory}
                      onBudgetChange={handleBudgetUpdate}
                      lastGeneration={lastGeneration}
                      transactions={state.transactions.filter((t) => !t.deleted)}
                      cards={state.cards.filter((c) => !c.deleted)}
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

        {showInstallBanner && (
          <div className="fixed bottom-24 right-4 left-4 md:left-auto md:w-80 bg-zinc-900 border border-emerald-500/30 rounded-2xl p-4 shadow-2xl z-50">
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="text-sm font-bold text-white">Instale o Cockpit</p>
                <p className="text-xs text-zinc-400">Acesso offline, full-screen e carregamento mais rápido.</p>
              </div>
              <button onClick={dismissInstallBanner} className="text-zinc-500 hover:text-white">
                <Icons.Close size={14} />
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleInstallClick} className="flex-1 bg-emerald-600 text-white py-2 rounded-xl font-bold hover:bg-emerald-500">Instalar</button>
              <button onClick={dismissInstallBanner} className="px-3 py-2 rounded-xl text-sm text-zinc-400 border border-zinc-800">Depois</button>
            </div>
          </div>
        )}
      </main>
      
      {toast && (
        <div className={`fixed bottom-6 right-4 left-4 md:left-auto md:w-72 p-3 rounded-xl shadow-2xl border text-sm ${
          toast.type === 'error' ? 'bg-rose-500/10 border-rose-500/40 text-rose-100' : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-100'
        }`}>
          {toast.message}
        </div>
      )}
      {swUpdateReady && (
        <div className="fixed bottom-20 right-4 left-4 md:left-auto md:w-72 p-3 rounded-xl shadow-2xl border text-sm bg-blue-500/10 border-blue-500/40 text-blue-100 flex justify-between items-center">
          <span>Nova versão disponível</span>
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-lg hover:bg-blue-500"
          >
            Atualizar
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
