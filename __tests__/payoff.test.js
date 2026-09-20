/* eslint-env jest */
import { payoffWithExtra, payoffComparison, payoffOrder, canPlanPayoff, computeDebt } from '../src/data/debts';

const TODAY = '2026-09-15';

const loan = {
  id: 'p', kind: 'loan', type: 'Personal loan', name: 'Personal loan',
  principal: 68000, rate: 11.5, tenureMonths: 24, firstEmiDate: '2026-09-07',
  recordMode: 'auto', createdOn: '2026-09-01',
};

const gold = {
  id: 'g', kind: 'gold', type: 'Gold loan', name: 'Gold loan', principal: 50000, rate: 12,
  startDate: '2026-06-20', maturityDate: '2026-12-20', goldStyle: 'emi', recordMode: 'none', createdOn: '2026-06-20',
};

const card = {
  id: 'c', kind: 'card', type: 'Credit card', name: 'Card', billAmount: 12000,
  billDate: '2026-09-01', billDueDate: '2026-09-28', rate: 42, payments: [], createdOn: '2026-09-01',
};

describe('Payoff planner', () => {
  test('paying extra clears the loan sooner and costs less interest', () => {
    const { now, faster, monthsSaved, interestSaved } = payoffComparison(loan, 3000, TODAY);
    expect(now.months).toBeGreaterThan(faster.months);
    expect(monthsSaved).toBeGreaterThan(0);
    expect(interestSaved).toBeGreaterThan(0);
    expect(faster.monthly).toBe(now.monthly + 3000);
  });

  test('no extra means nothing changes', () => {
    const { monthsSaved, interestSaved } = payoffComparison(loan, 0, TODAY);
    expect(monthsSaved).toBe(0);
    expect(interestSaved).toBe(0);
  });

  test('a payment below the monthly interest never clears the balance', () => {
    const tiny = { ...loan, emi: 100, emiCustom: true };
    const result = payoffWithExtra(tiny, 0, TODAY);
    expect(result.neverEnds).toBe(true);
    expect(result.months).toBeNull();
  });

  test('an interest-free hand loan clears at the rate you choose', () => {
    const hand = { id: 'h', kind: 'hand', name: 'Ravi', principal: 10000, ratePerMonth: 0, startDate: '2026-07-15', payments: [], recordMode: 'none', createdOn: '2026-07-15' };
    const result = payoffWithExtra(hand, 2000, TODAY);
    expect(result.months).toBe(5);
    expect(result.interest).toBe(0);
  });

  test('costliest first and smallest first give different orders', () => {
    const debts = [loan, gold];
    const byInterest = payoffOrder(debts, 'interest', TODAY);
    const byBalance = payoffOrder(debts, 'balance', TODAY);
    expect(byInterest[0].rate).toBeGreaterThanOrEqual(byInterest[1].rate);
    expect(byBalance[0].owed).toBeLessThanOrEqual(byBalance[1].owed);
    expect(byInterest[0].position).toBe(1);
  });

  test('cards, chits and money lent are left out of the planner', () => {
    expect(canPlanPayoff(card, computeDebt(card, TODAY))).toBe(false);
    expect(canPlanPayoff(loan, computeDebt(loan, TODAY))).toBe(true);
    expect(payoffOrder([card], 'interest', TODAY)).toEqual([]);
  });

  test('a settled loan is not offered', () => {
    const paid = { ...loan, firstEmiDate: '2023-01-05', createdOn: '2023-01-01' };
    expect(canPlanPayoff(paid, computeDebt(paid, TODAY))).toBe(false);
  });
});
