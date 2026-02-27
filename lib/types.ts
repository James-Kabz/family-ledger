export type Contribution = {
  id: string;
  name: string;
  amount: number;
  ref: string | null;
  pledged: boolean;
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
  key: string;
  name: string;
  total: number;
  lastContributedAt: string;
};
