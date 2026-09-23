/* eslint-env jest */
import { computeByMonth, computeByWeek, computeHoldings } from '../src/data/compute';
import { computeCashFlow } from '../src/data/cashFlow';
import { computeUpcoming } from '../src/data/upcoming';

const TODAY = '2026-09-21';
const EMPTY = { entries: [], investments: [], recurring: [], debts: [], budgets: {}, accounts: [] };
const rule = (id, tab, day, amount, category, extra = {}) => ({
  id, tab, day, active: true, startMonth: '2026-09', lastPostedMonth: '2026-08',
  template: { name: category, category, note: category, amount }, ...extra,
});

describe('This month cash-flow plan', () => {
  test('deducts past spending, covers scheduled subscriptions with existing category budget, and includes NPS once', () => {
    const data = {
      ...EMPTY, accounts: [{ id: 'bank', balance: 60000, updatedOn: TODAY }],
      budgets: { 'Groceries & food': 12000, Subscriptions: 2000 },
      entries: [{ id: 'spent', kind: 'expense', date: '2026-09-05', category: 'Groceries & food', amount: 2000 }],
      recurring: [rule('sub', 'expense', 25, 2000, 'Subscriptions'), rule('nps', 'investment', 27, 1000, 'NPS'), rule('salary', 'income', 28, 20000, 'Salary')],
    };
    const plan = computeCashFlow(data, TODAY);
    expect(plan.remainingBudget).toBe(12000);
    expect(plan.dueRows.find((i) => i.title === 'Subscriptions').extraRequired).toBe(0);
    expect(plan.totalRequired).toBe(13000);
    expect(plan.upcomingIncoming).toBe(20000);
    expect(plan.surplus).toBe(67000);
  });

  test('does not show a made-up surplus if the user has not added account balances', () => {
    const plan = computeCashFlow({ ...EMPTY, recurring: [rule('salary', 'income', 28, 30000, 'Salary')] }, TODAY);
    expect(plan.available).toBeNull();
    expect(plan.surplus).toBeNull();
    expect(plan.upcomingIncoming).toBe(30000);
  });

  test('a fixed monthly category stays monthly even when general budgets are weekly', () => {
    const plan = computeCashFlow({ ...EMPTY, budgets: { Subscriptions: 2000 }, budgetPeriod: 'weekly', fixedMonthlyCategories: { Subscriptions: true } }, TODAY);
    expect(plan.remainingBudget).toBe(2000);
  });

  test('the This month view uses calendar dates and the rolling view includes later repeat occurrences', () => {
    const data = { ...EMPTY, recurring: [rule('subscription', 'expense', 25, 2000, 'Subscriptions', { lastPostedMonth: '2026-09' })] };
    expect(computeUpcoming(data, TODAY, 30, { thisMonth: true }).items).toHaveLength(0);
    expect(computeUpcoming(data, TODAY, 100).items.map((i) => i.date)).toEqual(['2026-10-25', '2026-11-25', '2026-12-25']);
  });

  test('future dated salary and NPS appear as scheduled, not already earned or invested', () => {
    const data = {
      ...EMPTY,
      investments: [{ id: 'nps', date: '2026-10-01', name: 'NPS', type: 'NPS', amount: 1000, action: 'invest' }],
      entries: [{ id: 'income', date: '2026-10-02', kind: 'income', category: 'Salary', amount: 5000 }],
    };
    expect(computeHoldings(data.investments, {}, TODAY)).toHaveLength(0);
    expect(computeByMonth(data, TODAY)).toEqual({});
    expect(computeByWeek(data, TODAY)).toEqual({});
    const upcoming = computeUpcoming(data, TODAY, 30);
    expect(upcoming.items.map((i) => i.title)).toEqual(['NPS', 'Salary']);
    expect(upcoming.out).toBe(1000);
    expect(upcoming.in).toBe(5000);
  });
});
