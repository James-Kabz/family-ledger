export type Contribution = {
  id: string;
  name: string;
  amount: number;
  ref: string | null;
  contributedAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  spentAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LedgerUpdate = {
  id: string;
  cutoffAt: string;
  generatedMessage: string;
  createdAt: string;
};

export type ExpenseUpdate = {
  id: string;
  generatedMessage: string;
  createdAt: string;
};

export type RunningTotal = {
  name: string;
  total: number;
};
