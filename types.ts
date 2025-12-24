export type Direction = 'in' | 'out';

export type TransactionKind =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'debt_payment'
  | 'fee_interest';

export type PaymentMethod = 'pix' | 'debit' | 'cash' | 'credit';

export type TransactionStatus = 'pending' | 'paid';

export type PersonId = 'alan' | 'kellen' | 'casa';

export interface InstallmentInfo {
  groupId: string;
  number: number;
  total: number;
  originalTotalAmount: number;
  perInstallmentAmount: number;
  startDate: string;
}

export interface Transaction {
  id: string;
  date: string; // ISO date
  competenceMonth: string; // YYYY-MM
  direction: Direction;
  kind: TransactionKind;
  amount: number;
  description: string;
  personId?: PersonId;
  categoryId?: string;
  paymentMethod: PaymentMethod;
  cardId?: string; // Required when paymentMethod === 'credit'
  status: TransactionStatus;
  tags?: string[];
  installment?: InstallmentInfo;
  isRecurring?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
  needsSync?: boolean;
}

export interface InstallmentPlan {
  id: string;
  createdAt: string;
  updatedAt?: string;
  description: string;
  personId?: PersonId;
  categoryId: string;
  cardId: string;
  purchaseDate: string;
  firstInstallmentDate: string;
  totalInstallments: number;
  totalAmount: number;
  perInstallmentAmount: number;
  status: 'active' | 'finished' | 'cancelled';
  remainingInstallments: number;
  notes?: string;
  deleted?: boolean;
}

export interface Card {
  id: string;
  name: string;
  closingDay?: number;
  dueDay?: number;
  aprMonthly?: number;
  limit?: number;
  balance?: number;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

export interface AppState {
  schemaVersion: number;
  transactions: Transaction[];
  cards: Card[];
  categories: string[];
  monthlyIncome: number;
  variableCap: number;
  installmentPlans: InstallmentPlan[];
  updatedAt?: string;
}

export type View = 'dashboard' | 'add' | 'plan' | 'debts' | 'reports';

export type TransactionDraft = Partial<
  Pick<
    Transaction,
    | 'amount'
    | 'personId'
    | 'description'
    | 'kind'
    | 'categoryId'
    | 'paymentMethod'
    | 'cardId'
    | 'status'
    | 'date'
    | 'direction'
    | 'competenceMonth'
  >
> & {
  installment?: InstallmentInfo;
};

export const PERSON_LABEL: Record<PersonId, string> = {
  alan: 'Alan',
  kellen: 'Kellen',
  casa: 'Casa',
};
