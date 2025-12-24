import { Transaction } from '../types';

export const toCompetenceMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const addMonths = (date: Date, delta: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + delta);
  return next;
};

export const formatCurrency = (value?: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);

export const formatKindLabel = (kind: Transaction['kind']) => {
  switch (kind) {
    case 'expense':
      return 'Compra';
    case 'income':
      return 'Receita';
    case 'debt_payment':
      return 'Pagamento do cartão';
    case 'fee_interest':
      return 'Taxas/Juros';
    case 'transfer':
      return 'Transferência';
    default:
      return 'Movimento';
  }
};

export const formatRelativeTime = (timestamp?: number | null) => {
  if (!timestamp) return 'Nunca sincronizado';
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60000) return 'Agora';
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `Há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Há ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  return `Há ${diffD} d`;
};

export const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
