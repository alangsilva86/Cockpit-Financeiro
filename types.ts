export enum OperationType {
  VIDA = 'Vida', // Custo de Vida
  DIVIDA = 'Dívida', // Amortização de Principal
  ROLAGEM = 'Rolagem', // Transferência de Dívida (Neutro)
  JUROS = 'Juros', // Custo Financeiro/Taxas
  INVESTIMENTO = 'Investimento'
}

export enum Person {
  ALAN = 'Alan',
  KELLEN = 'Kellen',
  CASA = 'Casa'
}

export type TransactionStatus = 'pending' | 'paid';

export interface Transaction {
  id: string;
  date: string; // ISO date
  amount: number;
  person: Person;
  description: string;
  type: OperationType;
  category: string;
  status: TransactionStatus;
  isRecurring?: boolean; // Para clonar no próximo mês
}

export interface Debt {
  id: string;
  name: string;
  balance: number; // Saldo devedor total
  currentInvoice?: number; // Fatura que vence neste mês
  dueDate: string; // Day of month
  minPayment: number;
  rolloverCost: number; // Percentage or fixed amount
  status: 'ok' | 'attention' | 'critical';
}

export interface AppState {
  transactions: Transaction[];
  debts: Debt[];
  monthlyIncome: number;
  variableCap: number; // Teto de variáveis
}

export type View = 'dashboard' | 'add' | 'plan' | 'debts' | 'reports';