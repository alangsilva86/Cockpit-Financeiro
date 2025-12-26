import { describe, expect, it } from 'vitest';
import type { AppState } from '../../types';
import { toDateOnly, toMonthStart } from '../../api/lib/dates';
import { mapStateToRows } from '../../api/lib/sync/transform';

describe('date normalization', () => {
  it('normalizes month strings and dates', () => {
    expect(toMonthStart('2025-03')).toBe('2025-03-01');
    expect(toMonthStart('2025-03-14')).toBe('2025-03-01');
    expect(toDateOnly('2025-03-14T10:12:00.000Z')).toBe('2025-03-14');
  });
});

describe('sync mapping', () => {
  it('maps categories, cards, and transactions consistently', () => {
    const state: AppState = {
      schemaVersion: 2,
      transactions: [
        {
          id: 'tx-1',
          date: '2025-02-10',
          competenceMonth: '2025-02',
          direction: 'out',
          kind: 'expense',
          amount: 120,
          description: 'Groceries',
          personId: 'alan',
          categoryId: 'Food',
          paymentMethod: 'debit',
          cardId: 'card-1',
          status: 'paid',
          updatedAt: '2025-02-11T10:00:00.000Z',
        },
        {
          id: 'tx-2',
          date: '2025-02-12',
          competenceMonth: '2025-02',
          direction: 'out',
          kind: 'expense',
          amount: 40,
          description: 'Coffee',
          paymentMethod: 'cash',
          status: 'paid',
          deleted: true,
          updatedAt: '2025-02-13T09:00:00.000Z',
        },
      ],
      cards: [
        {
          id: 'card-1',
          name: 'Nubank',
          closingDay: 5,
          dueDay: 12,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ],
      categories: ['Food'],
      monthlyIncome: 0,
      variableCap: 0,
      installmentPlans: [],
      updatedAt: '2025-02-11T11:00:00.000Z',
    };

    const rows = mapStateToRows(state, 'workspace-demo', '2025-02-11T12:00:00.000Z');
    expect(rows.transactions[0].competence_month).toBe('2025-02-01');
    expect(rows.transactions[0].occurred_at).toBe('2025-02-10');
    expect(rows.transactions[1].deleted_at).toBe('2025-02-13T09:00:00.000Z');
    expect(rows.transactions[0].deleted_at).toBeUndefined();
    expect(rows.categories[0].id).toBe(rows.transactions[0].category_id);
    expect(rows.cards[0].id).toBe(rows.transactions[0].card_id);
  });

  it('keeps installment_count consistent with the plan', () => {
    const state: AppState = {
      schemaVersion: 2,
      transactions: [
        {
          id: 'tx-10',
          date: '2025-01-10',
          competenceMonth: '2025-01',
          direction: 'out',
          kind: 'expense',
          amount: 100,
          description: 'Parcelado',
          paymentMethod: 'credit',
          cardId: 'card-1',
          status: 'pending',
          installment: {
            groupId: 'plan-1',
            number: 1,
            total: 12,
            originalTotalAmount: 1000,
            perInstallmentAmount: 100,
            startDate: '2025-01-10',
          },
        },
      ],
      cards: [{ id: 'card-1', name: 'Nubank' }],
      categories: [],
      monthlyIncome: 0,
      variableCap: 0,
      installmentPlans: [
        {
          id: 'plan-1',
          createdAt: '2025-01-10T00:00:00.000Z',
          description: 'Plano 10x',
          categoryId: 'Misc',
          cardId: 'card-1',
          purchaseDate: '2025-01-10',
          firstInstallmentDate: '2025-01-10',
          totalInstallments: 10,
          totalAmount: 1000,
          perInstallmentAmount: 100,
          status: 'active',
          remainingInstallments: 9,
        },
      ],
      updatedAt: '2025-01-10T10:00:00.000Z',
    };

    const rows = mapStateToRows(state, 'workspace-demo', '2025-01-10T12:00:00.000Z');
    expect(rows.transactions[0].installment_count).toBe(10);
  });
});
