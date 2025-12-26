import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { QuickAdd } from './components/QuickAdd';
import { Passivos } from './components/Passivos';
import { Planning } from './components/Planning';
import { Reports } from './components/Reports';
import { Icons } from './components/Icons';
import { Button } from './components/ui/Button';
import { BottomNavItem } from './components/ui/BottomNavItem';
import { IconButton } from './components/ui/IconButton';
import { AppState, Card, InstallmentPlan, Transaction, TransactionDraft, View } from './types';
import { INITIAL_CATEGORIES } from './services/categories';
import { syncAppState } from './services/syncService';
import { BottomSheetModal } from './components/ui/BottomSheetModal';
import { SetupProgressCard } from './components/ui/SetupProgressCard';
import { ToastAction } from './components/ui/ToastAction';
import { formatRelativeTime } from './utils/format';

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

const buildDemoState = (): AppState => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 5);
  const monthMid = new Date(now.getFullYear(), now.getMonth(), 12);
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 24);
  const futureCharge = new Date(now.getFullYear(), now.getMonth(), 28);

  const demoCards: Card[] = [
    {
      id: 'demo-nubank',
      name: 'Nubank',
      dueDay: 5,
      closingDay: 28,
      limit: 12000,
      aprMonthly: 12,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: 'demo-xp',
      name: 'XP Visa',
      dueDay: 15,
      closingDay: 5,
      limit: 20000,
      aprMonthly: 8,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];

  const rawDemoTransactions: Transaction[] = [
    {
      id: 'demo-1',
      date: monthStart.toISOString(),
      competenceMonth: deriveCompetence(monthStart.toISOString()),
      direction: 'in',
      kind: 'income',
      amount: 12000,
      description: 'Salário',
      personId: 'alan',
      categoryId: 'Salário',
      paymentMethod: 'pix',
      status: 'paid',
      needsSync: false,
    },
    {
      id: 'demo-2',
      date: monthStart.toISOString(),
      competenceMonth: deriveCompetence(monthStart.toISOString()),
      direction: 'out',
      kind: 'expense',
      amount: 3200,
      description: 'Aluguel',
      personId: 'casa',
      categoryId: 'Moradia',
      paymentMethod: 'pix',
      status: 'paid',
      needsSync: false,
    },
    {
      id: 'demo-3',
      date: monthMid.toISOString(),
      competenceMonth: deriveCompetence(monthMid.toISOString()),
      direction: 'out',
      kind: 'expense',
      amount: 680,
      description: 'Mercado',
      personId: 'casa',
      categoryId: 'Alimentação',
      paymentMethod: 'debit',
      status: 'paid',
      needsSync: false,
    },
    {
      id: 'demo-4',
      date: monthEnd.toISOString(),
      competenceMonth: deriveCompetence(monthEnd.toISOString()),
      direction: 'out',
      kind: 'expense',
      amount: 1250,
      description: 'Notebook',
      personId: 'alan',
      categoryId: 'Compras',
      paymentMethod: 'credit',
      cardId: demoCards[0].id,
      status: 'pending',
      needsSync: false,
    },
    {
      id: 'demo-5',
      date: futureCharge.toISOString(),
      competenceMonth: deriveCompetence(futureCharge.toISOString()),
      direction: 'out',
      kind: 'fee_interest',
      amount: 120,
      description: 'Juros parcelamento',
      personId: 'alan',
      categoryId: 'Taxas',
      paymentMethod: 'credit',
      cardId: demoCards[0].id,
      status: 'pending',
      needsSync: false,
    },
    {
      id: 'demo-6',
      date: monthEnd.toISOString(),
      competenceMonth: deriveCompetence(monthEnd.toISOString()),
      direction: 'out',
      kind: 'debt_payment',
      amount: 2400,
      description: 'Pagamento fatura Nubank',
      personId: 'alan',
      categoryId: 'Taxas',
      paymentMethod: 'pix',
      cardId: demoCards[0].id,
      status: 'paid',
      needsSync: false,
    },
    {
      id: 'demo-7',
      date: monthMid.toISOString(),
      competenceMonth: deriveCompetence(monthMid.toISOString()),
      direction: 'out',
      kind: 'transfer',
      amount: 800,
      description: 'Reserva',
      personId: 'alan',
      categoryId: 'Investimento',
      paymentMethod: 'pix',
      status: 'paid',
      needsSync: false,
    },
  ];
  const demoTransactions = rawDemoTransactions.map(normalizeTransaction);

  return {
    schemaVersion: SCHEMA_VERSION,
    monthlyIncome: 12000,
    variableCap: 3600,
    categories: INITIAL_CATEGORIES,
    cards: demoCards.map(normalizeCard),
    installmentPlans: [],
    transactions: demoTransactions,
    updatedAt: nowIso(),
  };
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
  const [toast, setToast] = useState<{
    message: string;
    type?: 'success' | 'error';
    actionLabel?: string;
    onAction?: () => void;
    secondaryLabel?: string;
    onSecondary?: () => void;
    durationMs?: number;
  } | null>(null);
  const [quickAddDraft, setQuickAddDraft] = useState<TransactionDraft | null>(null);
  const [lastGeneration, setLastGeneration] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [swUpdateReady, setSwUpdateReady] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number>(0);
  const [forceSync, setForceSync] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showTrustDetails, setShowTrustDetails] = useState(false);
  const [forceSetupOpen, setForceSetupOpen] = useState(false);
  const [hasBudgetConfigured, setHasBudgetConfigured] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('cockpit-setup-budget') === 'true';
  });
  const toastTimerRef = useRef<number | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const undoSnapshotRef = useRef<AppState | null>(null);
  const [undoExpiresAt, setUndoExpiresAt] = useState<number | null>(null);

  const pendingCount = useMemo(
    () => state.transactions.filter((t) => t.needsSync && !t.deleted).length,
    [state.transactions]
  );
  const headerSpendRatio = useMemo(() => {
    const spent = state.transactions
      .filter((t) => !t.deleted && t.kind !== 'income')
      .reduce((acc, tx) => acc + (tx.amount || 0), 0);
    if (state.monthlyIncome <= 0) return 0;
    return Math.min(100, Math.round((spent / state.monthlyIncome) * 100));
  }, [state.transactions, state.monthlyIncome]);

  const hasCard = useMemo(() => state.cards.some((c) => !c.deleted), [state.cards]);
  const hasTransaction = useMemo(() => state.transactions.some((t) => !t.deleted), [state.transactions]);
  const isSetupComplete = hasBudgetConfigured && hasCard && hasTransaction;
  const showSetupCard = !isSetupComplete || forceSetupOpen;

  const lastUsedTransaction = useMemo(() => {
    const items = state.transactions.filter((t) => !t.deleted);
    if (items.length === 0) return null;
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [state.transactions]);

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

  const handleApplyUpdate = () => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.controller?.postMessage('SKIP_WAITING');
    }
    setSwUpdateReady(false);
    window.location.reload();
  };

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
    };
    window.addEventListener('beforeinstallprompt', handler as any);
    return () => window.removeEventListener('beforeinstallprompt', handler as any);
  }, []);

  const pushToast = useCallback(
    (
      message: string,
      type: 'success' | 'error' = 'success',
      options?: {
        actionLabel?: string;
        onAction?: () => void;
        secondaryLabel?: string;
        onSecondary?: () => void;
        durationMs?: number;
      }
    ) => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      setToast({
        message,
        type,
        actionLabel: options?.actionLabel,
        onAction: options?.onAction,
        secondaryLabel: options?.secondaryLabel,
        onSecondary: options?.onSecondary,
        durationMs: options?.durationMs,
      });
      const duration = options?.durationMs ?? 2400;
      toastTimerRef.current = window.setTimeout(() => setToast(null), duration);
    },
    []
  );

  const runSync = useCallback(
    async (force = false) => {
      if (!isOnline || isSyncing) return;
      const now = Date.now();
      if (!force && now - lastSyncAt < 3000) return;
      setIsSyncing(true);
      setSyncError(null);
      try {
        const result = await syncAppState(state, { force });
        if (result?.state) {
          setState({
            ...result.state,
            transactions: result.state.transactions.map(normalizeTransaction),
            cards: result.state.cards.map(normalizeCard),
            installmentPlans: result.state.installmentPlans.map(normalizePlan),
          });
          setLastSyncAt(Date.now());
          if (force || pendingCount > 0) {
            pushToast('Sincronizado com a nuvem');
          }
        }
      } catch (error) {
        console.error('Erro ao sincronizar', error);
        setSyncError(error instanceof Error ? error.message : 'Erro ao sincronizar');
        pushToast('Falha na sincronização. Tentaremos novamente.', 'error');
      } finally {
        setIsSyncing(false);
        if (force) setForceSync(false);
      }
    },
    [isOnline, isSyncing, lastSyncAt, pendingCount, pushToast, state]
  );

  useEffect(() => {
    if (!isOnline) return;
    let mounted = true;

    const attemptSync = async (force = false) => {
      if (!mounted) return;
      await runSync(force);
    };

    attemptSync(forceSync);
    const interval = setInterval(() => attemptSync(), 20000);
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
  }, [forceSync, isOnline, runSync]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!undoExpiresAt) return;
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    const delay = Math.max(undoExpiresAt - Date.now(), 0);
    undoTimerRef.current = window.setTimeout(() => {
    undoSnapshotRef.current = null;
      setUndoExpiresAt(null);
    }, delay);
  }, [undoExpiresAt]);

  const queueUndo = (snapshot: AppState) => {
    undoSnapshotRef.current = snapshot;
    setUndoExpiresAt(Date.now() + 30000);
  };

  const handleUndo = () => {
    const snapshot = undoSnapshotRef.current;
    if (!snapshot) return;
    setState({ ...snapshot, updatedAt: nowIso() });
    undoSnapshotRef.current = null;
    setUndoExpiresAt(null);
    pushToast('Lançamento desfeito');
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

    setState((prev) => {
      queueUndo(prev);
      return {
        ...prev,
        transactions: [...prev.transactions, ...processedTx],
        installmentPlans: options?.newPlan
          ? [...prev.installmentPlans, normalizePlan({ ...options.newPlan, updatedAt: nowIso() })]
          : prev.installmentPlans,
        updatedAt: nowIso(),
      };
    });

    pushToast(isOnline ? 'Lançamento salvo' : 'Salvo offline. Sincroniza quando voltar à rede.', 'success', {
      actionLabel: 'Desfazer',
      onAction: handleUndo,
      secondaryLabel: 'Ver no mês',
      onSecondary: () => setCurrentView('dashboard'),
      durationMs: 30000,
    });
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

  const handleRemoveTransaction = (id: string) => {
    const exists = state.transactions.some((t) => t.id === id && !t.deleted);
    if (!exists) return;

    setState((prev) => {
      queueUndo(prev);
      return {
        ...prev,
        transactions: prev.transactions.map((t) =>
          t.id === id ? { ...t, deleted: true, needsSync: true, updatedAt: nowIso() } : t
        ),
        updatedAt: nowIso(),
      };
    });

    pushToast('Lançamento removido', 'success', {
      actionLabel: 'Desfazer',
      onAction: handleUndo,
      durationMs: 30000,
    });
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
    if (typeof window !== 'undefined') {
      localStorage.setItem('cockpit-setup-budget', 'true');
    }
    setHasBudgetConfigured(true);
    pushToast('Planejamento atualizado');
  };

  const handleSeedDemo = () => {
    const demo = buildDemoState();
    setState(demo);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cockpit-setup-budget', 'true');
    }
    setHasBudgetConfigured(true);
    setForceSetupOpen(false);
    pushToast('Dados demo carregados');
  };

  const handleOpenSetup = () => setForceSetupOpen(true);

  const handleDismissSetup = () => setForceSetupOpen(false);

  const handleOpenQuickAddWithDraft = (draft: TransactionDraft) => {
    setQuickAddDraft(draft);
    setCurrentView('add');
  };

  const handleInstallClick = async () => {
    if (!installPrompt?.prompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    pushToast(outcome === 'accepted' ? 'PWA instalado' : 'Instalação cancelada', outcome === 'accepted' ? 'success' : 'error');
  };

  const NavButton = ({ view, icon: Icon, label, desktop }: { view: View, icon: any, label: string, desktop?: boolean }) => (
    <button 
      onClick={() => setCurrentView(view)}
      className={`
        flex items-center transition-all duration-200
        ${desktop 
            ? `w-full px-4 py-4 rounded-xl gap-2 mb-2 hover:bg-zinc-900 ${currentView === view ? 'bg-zinc-900 text-emerald-400 border border-zinc-800' : 'text-zinc-500'}`
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

        <Button
            variant="ghost"
            fullWidth
            className="mb-3 justify-start text-xs text-zinc-400 hover:text-white"
            onClick={handleOpenSetup}
        >
            <Icons.Help size={16} />
            Ajuda/Setup
        </Button>

        <Button
            variant="primary"
            fullWidth
            onClick={() => setCurrentView('add')}
            className="flex items-center justify-center gap-2"
        >
            <Icons.Add size={18} />
            Novo Lançamento
        </Button>

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

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto pb-32 md:pb-0 scroll-smooth min-h-0">
            {/* Desktop Center Container - constrained for readability but wider than mobile */}
            <div className="md:max-w-2xl md:mx-auto md:my-6 md:bg-zinc-950 md:min-h-[90vh] md:rounded-2xl md:border md:border-zinc-900/50 md:shadow-2xl">
                {currentView !== 'add' && (
                  <section className="border-b border-zinc-900/60 bg-zinc-950/60 px-6 pt-6 pb-4 md:px-10">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.5em] text-zinc-500">MEU MÊS</p>
                        <h1 className="text-3xl font-bold text-emerald-400">Cockpit 2026</h1>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${
                            isOnline ? 'border-emerald-500/60 text-emerald-300' : 'border-amber-500/60 text-amber-200'
                          }`}
                        >
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                        <button
                          onClick={() => setShowTrustDetails(true)}
                          className="rounded-full border border-zinc-800 px-4 py-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-300 transition hover:border-emerald-400 hover:text-white"
                        >
                          Detalhes
                        </button>
                        <IconButton
                          aria-label="Ajuda e setup"
                          icon={<Icons.Help size={16} />}
                          onClick={handleOpenSetup}
                          className="h-10 w-10 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 shadow-none"
                        />
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-xs font-bold text-zinc-300 uppercase">
                          AL
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 h-1 rounded-full bg-zinc-900">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                        style={{ width: `${Math.max(16, headerSpendRatio)}%` }}
                      />
                    </div>
                  </section>
                )}
                {showSetupCard && currentView !== 'add' && (
                  <div className="p-4">
                    <SetupProgressCard
                      isComplete={isSetupComplete}
                      onSeedDemo={handleSeedDemo}
                      onDismiss={isSetupComplete ? handleDismissSetup : undefined}
                      steps={[
                        {
                          id: 'budget',
                          label: 'Definir renda e teto',
                          done: hasBudgetConfigured,
                          ctaLabel: 'Ir para Planejamento',
                          onClick: () => setCurrentView('plan'),
                        },
                        {
                          id: 'card',
                          label: 'Cadastrar 1 cartão',
                          done: hasCard,
                          ctaLabel: 'Ir para Cartões',
                          onClick: () => setCurrentView('debts'),
                        },
                        {
                          id: 'tx',
                          label: 'Criar 1 lançamento',
                          done: hasTransaction,
                          ctaLabel: 'Ir para Novo',
                          onClick: () => setCurrentView('add'),
                        },
                      ]}
                    />
                  </div>
                )}
                {currentView === 'dashboard' && (
                  <Dashboard 
                    state={state} 
                    onToggleStatus={handleToggleStatus} 
                    onRemoveTransaction={handleRemoveTransaction}
                    onQuickAddDraft={handleOpenQuickAddWithDraft}
                    isOnline={isOnline}
                  />
                )}
                {currentView === 'reports' && (
                  <Reports 
                    state={state} 
                    onGenerateNextMonth={handleGenerateNextMonth} 
                    onRemoveTransaction={handleRemoveTransaction}
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
                      lastUsed={lastUsedTransaction}
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
            <div className="md:hidden h-40 pointer-events-none" aria-hidden="true" />
        </div>

        {/* Mobile Bottom Navigation (Hidden on Add screen & Desktop) */}
        {currentView !== 'add' && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-lg border-t border-zinc-900 pb-safe pt-2 px-2 z-50">
            <div className="flex justify-between items-end pb-4 px-2 max-w-md mx-auto gap-2">
              <BottomNavItem
                icon={Icons.Calendar}
                label="Meu Mês"
                active={currentView === 'dashboard'}
                onClick={() => setCurrentView('dashboard')}
              />
              <BottomNavItem
                icon={Icons.Reports}
                label="Relatórios"
                active={currentView === 'reports'}
                onClick={() => setCurrentView('reports')}
              />

              {/* Floating Action Button (FAB) */}
                <div className="relative -top-5">
                  <Button
                    variant="primary"
                    id="fab-action"
                    className="h-14 w-14 rounded-full text-white shadow-lg shadow-emerald-900/50 flex items-center justify-center p-0"
                    onClick={() => setCurrentView('add')}
                  >
                  <Icons.Add size={28} />
                </Button>
              </div>

              <BottomNavItem
                icon={Icons.Debts}
                label="Passivos"
                active={currentView === 'debts'}
                onClick={() => setCurrentView('debts')}
              />
              <BottomNavItem
                icon={Icons.Plan}
                label="Plano"
                active={currentView === 'plan'}
                onClick={() => setCurrentView('plan')}
              />
            </div>
          </nav>
        )}

      </main>

      <BottomSheetModal
        open={showTrustDetails}
        onClose={() => setShowTrustDetails(false)}
        title="Status da sincronização"
        actions={
          <button
            onClick={() => runSync(true)}
            disabled={!isOnline}
            className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sincronizar agora
          </button>
        }
      >
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Status</span>
          <span className="text-zinc-200">{isOnline ? 'Online' : 'Offline'}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Pendências</span>
          <span className="text-zinc-200">{pendingCount}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Última sincronização</span>
          <span className="text-zinc-200">{formatRelativeTime(lastSyncAt)}</span>
        </div>
        {syncError && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            {syncError}
          </div>
        )}
      </BottomSheetModal>
      
      {toast && (
        <div className="fixed bottom-6 right-4 left-4 md:left-auto md:w-80 z-50">
          <ToastAction
            message={toast.message}
            type={toast.type}
            actionLabel={toast.actionLabel}
            onAction={toast.onAction}
            secondaryLabel={toast.secondaryLabel}
            onSecondary={toast.onSecondary}
          />
        </div>
      )}
      {swUpdateReady && (
        <div className="fixed bottom-20 right-4 left-4 md:left-auto md:w-72 p-3 rounded-xl shadow-2xl border text-sm bg-blue-500/10 border-blue-500/40 text-blue-100 flex justify-between items-center">
          <span>Nova versão disponível</span>
          <button
            onClick={handleApplyUpdate}
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
