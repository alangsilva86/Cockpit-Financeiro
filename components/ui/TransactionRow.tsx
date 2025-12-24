import React from 'react';
import { Transaction } from '../../types';
import { Icons } from '../Icons';
import { formatCurrency, formatKindLabel, formatShortDate } from '../../utils/format';

interface TransactionRowProps {
  transaction: Transaction;
  onQuickAdd?: (draft: Partial<Transaction>) => void;
}

const kindTone = (kind: Transaction['kind']) => {
  switch (kind) {
    case 'income':
      return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
    case 'expense':
      return 'text-blue-300 border-blue-500/30 bg-blue-500/10';
    case 'fee_interest':
      return 'text-rose-300 border-rose-500/30 bg-rose-500/10';
    case 'debt_payment':
      return 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10';
    case 'transfer':
      return 'text-zinc-300 border-zinc-600/30 bg-zinc-500/10';
    default:
      return 'text-zinc-300 border-zinc-700 bg-zinc-800/60';
  }
};

const amountTone = (transaction: Transaction) => {
  if (transaction.kind === 'income') return 'text-emerald-400';
  if (transaction.kind === 'fee_interest') return 'text-rose-400';
  if (transaction.kind === 'transfer') return 'text-zinc-400';
  return 'text-zinc-200';
};

export const TransactionRow: React.FC<TransactionRowProps> = ({ transaction, onQuickAdd }) => {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 group">
      <div>
        <div className="text-sm font-medium text-zinc-200">{transaction.description}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
          <span>{formatShortDate(transaction.date)}</span>
          <span>•</span>
          <span className={`rounded-full border px-2 py-0.5 font-bold ${kindTone(transaction.kind)}`}>
            {formatKindLabel(transaction.kind)}
          </span>
          {transaction.categoryId && (
            <span className="text-zinc-500">{transaction.categoryId}</span>
          )}
          {transaction.personId && (
            <span className="uppercase text-zinc-600">{transaction.personId}</span>
          )}
          {transaction.installment && (
            <span className="text-zinc-600">
              {transaction.installment.number}/{transaction.installment.total}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`font-mono text-sm ${amountTone(transaction)}`}>
          R$ {formatCurrency(transaction.amount)}
        </span>
        {onQuickAdd && (
          <button
            onClick={() =>
              onQuickAdd({
                amount: transaction.amount,
                description: transaction.description,
                categoryId: transaction.categoryId,
                kind: transaction.kind,
                paymentMethod: transaction.paymentMethod,
                cardId: transaction.cardId,
                personId: transaction.personId,
                status: 'paid',
                date: new Date().toISOString(),
                direction: transaction.direction,
                competenceMonth: transaction.competenceMonth,
              })
            }
            className="text-zinc-600 opacity-0 transition-colors group-hover:opacity-100 hover:text-emerald-400"
            title="Relançar/ajustar este item"
          >
            <Icons.Edit size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
