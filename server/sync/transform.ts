import type { AppState, Card, InstallmentPlan, Transaction } from '../../types.js';
import { toDateOnly, toMonthStart } from '../dates.js';
import { entityToUuid, workspaceToUuid } from '../ids.js';

export type CardRow = {
  id: string;
  workspace_id: string;
  name: string;
  brand: string | null;
  limit_amount: number | null;
  closing_day: number | null;
  due_day: number | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CategoryRow = {
  id: string;
  workspace_id: string;
  name: string;
  kind: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InstallmentPlanRow = {
  id: string;
  workspace_id: string;
  card_id: string | null;
  description: string | null;
  total_amount: number;
  installment_count: number;
  start_competence_month: string;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TransactionRow = {
  id: string;
  workspace_id: string;
  kind: string;
  amount: number;
  occurred_at: string;
  competence_month: string;
  status: string;
  person: string | null;
  description: string | null;
  category_id: string | null;
  payment_method: string;
  card_id: string | null;
  installment_plan_id: string | null;
  installment_index: number | null;
  installment_count: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SyncRows = {
  workspaceUuid: string;
  cards: CardRow[];
  categories: CategoryRow[];
  installmentPlans: InstallmentPlanRow[];
  transactions: TransactionRow[];
};

const defaultDateOnly = () => new Date().toISOString().slice(0, 10);

const ensureMonthStart = (value?: string) => toMonthStart(value) || toMonthStart(defaultDateOnly())!;

const buildPlanFromInstallment = (
  workspaceUuid: string,
  tx: Transaction,
  nowIso: string
): InstallmentPlanRow | null => {
  const groupId = tx.installment?.groupId;
  if (!groupId) return null;
  const total = tx.installment?.total ?? 1;
  const perInstallmentAmount = tx.installment?.perInstallmentAmount ?? Math.abs(tx.amount || 0);
  const totalAmount = tx.installment?.originalTotalAmount ?? perInstallmentAmount * total;
  return {
    id: entityToUuid(workspaceUuid, 'plan', groupId),
    workspace_id: workspaceUuid,
    card_id: tx.cardId ? entityToUuid(workspaceUuid, 'card', tx.cardId) : null,
    description: tx.description || null,
    total_amount: totalAmount,
    installment_count: total,
    start_competence_month: ensureMonthStart(tx.installment?.startDate || tx.competenceMonth || tx.date),
    canceled_at: null,
    created_at: tx.createdAt || nowIso,
    updated_at: tx.updatedAt || nowIso,
  };
};

const normalizeCardRows = (cards: Card[], referencedCardIds: Set<string>, workspaceUuid: string, nowIso: string) => {
  const rows: CardRow[] = cards.map((card) => {
    const archivedAt = card.deleted ? card.updatedAt || nowIso : null;
    const row: CardRow = {
      id: entityToUuid(workspaceUuid, 'card', card.id),
      workspace_id: workspaceUuid,
      name: card.name,
      brand: null,
      limit_amount: card.limit ?? null,
      closing_day: card.closingDay ?? null,
      due_day: card.dueDay ?? null,
      archived_at: archivedAt,
      created_at: card.createdAt || nowIso,
      updated_at: card.updatedAt || nowIso,
    };
    return row;
  });

  referencedCardIds.forEach((cardId) => {
    if (cards.some((card) => card.id === cardId)) return;
    rows.push({
      id: entityToUuid(workspaceUuid, 'card', cardId),
      workspace_id: workspaceUuid,
      name: cardId,
      brand: null,
      limit_amount: null,
      closing_day: null,
      due_day: null,
      archived_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    });
  });

  return rows;
};

export const mapStateToRows = (state: AppState, workspaceId: string, nowIso = new Date().toISOString()): SyncRows => {
  const workspaceUuid = workspaceToUuid(workspaceId);
  const transactions = state.transactions || [];
  const cards = state.cards || [];
  const plans = state.installmentPlans || [];
  const categories = state.categories || [];

  const referencedCardIds = new Set<string>();
  const referencedCategoryNames = new Set<string>(categories.filter(Boolean));
  const referencedPlanIds = new Set<string>();

  transactions.forEach((tx) => {
    if (tx.cardId) referencedCardIds.add(tx.cardId);
    if (tx.categoryId) referencedCategoryNames.add(tx.categoryId);
    if (tx.installment?.groupId) referencedPlanIds.add(tx.installment.groupId);
  });

  plans.forEach((plan) => {
    if (plan.cardId) referencedCardIds.add(plan.cardId);
    if (plan.categoryId) referencedCategoryNames.add(plan.categoryId);
  });

  const cardRows = normalizeCardRows(cards, referencedCardIds, workspaceUuid, nowIso);

  const categoryRows: CategoryRow[] = Array.from(referencedCategoryNames).map((name) => ({
    id: entityToUuid(workspaceUuid, 'category', name),
    workspace_id: workspaceUuid,
    name,
    kind: null,
    archived_at: null,
    created_at: nowIso,
    updated_at: nowIso,
  }));

  const planById = new Map<string, InstallmentPlanRow>();
  plans.forEach((plan) => {
    const row: InstallmentPlanRow = {
      id: entityToUuid(workspaceUuid, 'plan', plan.id),
      workspace_id: workspaceUuid,
      card_id: plan.cardId ? entityToUuid(workspaceUuid, 'card', plan.cardId) : null,
      description: plan.description || null,
      total_amount: plan.totalAmount,
      installment_count: plan.totalInstallments,
      start_competence_month: ensureMonthStart(plan.firstInstallmentDate || plan.purchaseDate || plan.createdAt),
      canceled_at: null,
      created_at: plan.createdAt || nowIso,
      updated_at: plan.updatedAt || nowIso,
    };
    if (plan.status === 'cancelled' || plan.deleted) {
      row.canceled_at = plan.updatedAt || nowIso;
    }
    planById.set(plan.id, row);
  });

  referencedPlanIds.forEach((planId) => {
    if (planById.has(planId)) return;
    const relatedTx = transactions.find((tx) => tx.installment?.groupId === planId);
    if (!relatedTx) return;
    const placeholder = buildPlanFromInstallment(workspaceUuid, relatedTx, nowIso);
    if (placeholder) planById.set(planId, placeholder);
  });

  const transactionRows: TransactionRow[] = transactions.map((tx) => {
    const occurredAt = toDateOnly(tx.date) || defaultDateOnly();
    const competenceMonth = ensureMonthStart(tx.competenceMonth || tx.date);
    const planSourceId = tx.installment?.groupId;
    const planRow = planSourceId ? planById.get(planSourceId) : undefined;
    const installmentCount = planRow?.installment_count ?? tx.installment?.total ?? null;
    const row: TransactionRow = {
      id: entityToUuid(workspaceUuid, 'transaction', tx.id),
      workspace_id: workspaceUuid,
      kind: tx.kind,
      amount: tx.amount,
      occurred_at: occurredAt,
      competence_month: competenceMonth,
      status: tx.status || 'pending',
      person: tx.personId || null,
      description: tx.description || null,
      category_id: tx.categoryId ? entityToUuid(workspaceUuid, 'category', tx.categoryId) : null,
      payment_method: tx.paymentMethod || 'cash',
      card_id: tx.cardId ? entityToUuid(workspaceUuid, 'card', tx.cardId) : null,
      installment_plan_id: tx.installment?.groupId
        ? entityToUuid(workspaceUuid, 'plan', tx.installment.groupId)
        : null,
      installment_index: tx.installment?.number ?? null,
      installment_count: installmentCount,
      deleted_at: null,
      created_at: tx.createdAt || nowIso,
      updated_at: tx.updatedAt || nowIso,
    };
    if (tx.deleted) {
      row.deleted_at = tx.updatedAt || nowIso;
    }
    return row;
  });

  return {
    workspaceUuid,
    cards: cardRows,
    categories: categoryRows,
    installmentPlans: Array.from(planById.values()),
    transactions: transactionRows,
  };
};
