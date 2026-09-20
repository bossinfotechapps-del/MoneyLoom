export const STORAGE_KEY = 'moneyloom:data:v1';
// Kept separate from entries so Delete all data and Restore never touch them
export const SETTINGS_KEY = 'moneyloom:settings:v1';
export const PREMIUM_KEY = 'moneyloom:premium:v1';
export const AUTH_MODE_KEY = 'moneyloom:authmode:v1';
export const CLOUD_META_KEY = 'moneyloom:cloud:v1';

export const EXPENSE_CATS = [
  'Groceries & food', 'Eating out', 'Rent & housing', 'EMI & loans',
  'Bills & utilities', 'Fuel & transport', 'Health', 'Shopping',
  'Family & gifts', 'Subscriptions', 'Education', 'Entertainment', 'Other',
];

export const INCOME_CATS = ['Salary', 'Side business', 'Interest & dividends', 'Other income'];

export const MODES = ['UPI', 'Card', 'Cash', 'Bank transfer', 'Auto-debit'];

export const INV_TYPES = [
  'Mutual fund / SIP', 'Stocks', 'PPF', 'NPS', 'FD / RD', 'Gold', 'Emergency fund', 'Chit fund', 'Other',
];

export const ACCOUNT_TYPES = ['Savings', 'Salary', 'Current', 'Wallet', 'Cash', 'Other'];

export const EMPTY_DATA = {
  entries: [], investments: [], values: {}, recurring: [], budgets: {}, debts: [], netWorthHistory: [],
  customCategories: { expense: [], income: [] },
  accounts: [], goals: [],
  // 'monthly' or 'weekly': the period the budget amounts are set in
  budgetPeriod: 'monthly',
  fixedMonthlyCategories: {},
};
export const ZERO_MONTH = { spent: 0, earned: 0, invested: 0 };
