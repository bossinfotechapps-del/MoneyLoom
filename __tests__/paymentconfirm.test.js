/* eslint-env jest */
import { addRepeatPayment, findExistingPayment, markRepeatStatus, scheduledRepeatItems } from '../src/data/paymentSchedule';
import { computeByMonth, computeHoldings, applyRecurring } from '../src/data/compute';
import { computeCashFlow } from '../src/data/cashFlow';
import { computeUpcoming } from '../src/data/upcoming';
import { computeDebt } from '../src/data/debts';

const TODAY = '2026-11-05';
const makeData = () => ({
  entries: [], investments: [], debts: [], accounts: [], values: {}, budgets: {},
  recurring: [{ id: 'nps', active: true, tab: 'investment', startMonth: '2026-10',
    lastPostedMonth: '2026-09', confirmationMode: 'ask', day: 1,
    template: { name: 'NPS', type: 'NPS', action: 'invest', amount: 1000 } }],
});

test('missed October + ₹2,000 paid in November creates ONE actual transaction allocated across both months', () => {
  let data = markRepeatStatus(makeData(), 'nps', '2026-10', 'missed');
  expect(applyRecurring(data, TODAY).posted).toBe(0);
  expect(computeByMonth(data, TODAY)).toEqual({});
  expect(scheduledRepeatItems(data, TODAY, TODAY).map(i => i.month)).toEqual(['2026-10', '2026-11']);

  data = addRepeatPayment(data, 'nps', '2026-11', { amount: 2000, date: TODAY }, true, null, TODAY);
  expect(data.investments).toHaveLength(1);
  expect(data.investments[0].scheduleAllocations).toEqual([
    { month: '2026-10', amount: 1000 }, { month: '2026-11', amount: 1000 },
  ]);
  expect(computeByMonth(data, TODAY)['2026-11'].invested).toBe(2000);
  expect(computeUpcoming(data, TODAY, 20).out).toBe(0);
  expect(addRepeatPayment(data, 'nps', '2026-11', { amount: 2000, date: TODAY }, true, null, TODAY)).toBe(data);
});

test('extra amount can stay in current contribution while earlier month remains missed', () => {
  const data = addRepeatPayment(makeData(), 'nps', '2026-11', { amount: 2000, date: TODAY }, false, null, TODAY);
  expect(data.investments).toHaveLength(1);
  expect(data.investments[0].scheduleAllocations).toEqual([{ month: '2026-11', amount: 1000 }]);
  expect(scheduledRepeatItems(data, TODAY, TODAY).map(i => i.month)).toEqual(['2026-10']);
  expect(computeByMonth(data, TODAY)['2026-11'].invested).toBe(2000);
});

test('partial contribution keeps only the unpaid balance as due', () => {
  let data = addRepeatPayment(makeData(), 'nps', '2026-10', { amount: 400, date: TODAY }, false, null, TODAY);
  expect(scheduledRepeatItems(data, TODAY, TODAY)[0].amount).toBe(600);
  data = addRepeatPayment(data, 'nps', '2026-10', { amount: 600, date: TODAY }, false, null, TODAY);
  expect(data.investments).toHaveLength(2);
  expect(scheduledRepeatItems(data, TODAY, TODAY).map(i => i.month)).toEqual(['2026-11']);
});

test('linking an already recorded manual expense does not add a duplicate', () => {
  const data = makeData();
  data.recurring[0] = { ...data.recurring[0], tab: 'expense', template: { amount: 1000, category: 'Subscriptions' } };
  data.entries = [{ id: 'manual', date: TODAY, kind: 'expense', category: 'Subscriptions', amount: 1000 }];
  expect(findExistingPayment(data, data.recurring[0], 1000, TODAY).id).toBe('manual');
  const linked = addRepeatPayment(data, 'nps', '2026-11', { amount: 1000, date: TODAY }, false, 'manual', TODAY);
  expect(linked.entries).toHaveLength(1);
  expect(linked.entries[0].scheduleAllocations).toEqual([{ month: '2026-11', amount: 1000 }]);
});

test('planned future investment affects dues but not actual invested or holdings', () => {
  const data = { ...makeData(), recurring: [], investments: [{ id: 'f', date: '2026-12-01',
    amount: 1000, planned: true, name: 'NPS', action: 'invest' }] };
  expect(computeUpcoming(data, TODAY, 30).out).toBe(1000);
  expect(computeByMonth(data, TODAY)).toEqual({});
  expect(computeHoldings(data.investments, {}, TODAY)).toHaveLength(0);
});

test('cash flow retains older outstanding commitments from last month', () => {
  const data = makeData();
  data.accounts = [{ id: 'checking', balance: 4000, updatedOn: TODAY }];
  expect(computeCashFlow(data, TODAY).totalRequired).toBe(2000);
});

test('partial EMI reduces debt owed and leaves only its unpaid portion due', () => {
  const debt = { id: 'loan', kind: 'loan', type: 'Personal loan', name: 'Bank', principal: 12000,
    rate: 0, tenureMonths: 12, startDate: '2026-09-01', firstEmiDate: '2026-10-01',
    createdOn: '2026-10-01', recordMode: 'ask', statuses: { '2026-10': 'partial' },
    paymentAmounts: { '2026-10': 400 } };
  const result = computeDebt(debt, TODAY);
  expect(result.pending.find(i => i.key === '2026-10').amount).toBe(600);
  expect(result.owed).toBe(11600);
});
