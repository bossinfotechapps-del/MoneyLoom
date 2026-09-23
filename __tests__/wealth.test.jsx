/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataProvider, useData } from '../src/data/DataContext';
import WealthScreen from '../src/screens/WealthScreen';
import DebtSheet from '../src/components/DebtSheet';
import DebtDetailSheet from '../src/components/DebtDetailSheet';
import ConfirmPayments from '../src/components/ConfirmPayments';
import AmountDateDialog from '../src/components/AmountDateDialog';
import { todayStr } from '../src/utils/dates';
import { makeSampleData } from '../src/data/sample';
import { AUTH_MODE_KEY, STORAGE_KEY } from '../src/data/constants';

const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const texts = (root) => root.root.findAllByType(Text).map((t) => [].concat(t.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join('')).join(' | ');
const pressByText = async (root, label) => {
  const node = root.root.findAll((n) => typeof n.props.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === label))[0];
  if (!node) throw new Error(`No button "${label}"`);
  await act(async () => { node.props.onPress(); });
};

let ctx;
function Grab() { ctx = useData(); return null; }

describe('Wealth, debts and net worth', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(AUTH_MODE_KEY, 'guest');
  });

  test('sample data renders every Wealth section and debt detail', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(makeSampleData()));
    let r;
    for (const segment of ['investments', 'debts', 'lent']) {
      await act(async () => {
        r = ReactTestRenderer.create(
          <DataProvider><Grab /><WealthScreen segment={segment} setSegment={() => {}} onAddInvestment={() => {}} onEditInvestment={() => {}} onAddDebt={() => {}} onOpenDebt={() => {}} onToast={() => {}} bottomSpace={96} /></DataProvider>
        );
      });
      await flush();
      expect(texts(r)).toMatch(/Net worth/);
      if (segment === 'debts') {
        expect(texts(r)).toMatch(/Bike loan/);
        expect(texts(r)).toMatch(/Gold loan/);
        expect(texts(r)).toMatch(/to confirm/);
      }
      if (segment === 'lent') {
        expect(texts(r)).toMatch(/Suresh/);
        expect(texts(r)).toMatch(/Office chit group/);
      }
      r.unmount();
    }
    // Auto-recorded EMIs and chit instalments were posted once
    expect(ctx.data.entries.some((e) => e.debtId && e.category === 'EMI & loans')).toBe(true);
    expect(ctx.data.investments.some((i) => i.debtId && i.type === 'Chit fund')).toBe(true);
    expect(ctx.netWorth.liabilities).toBeGreaterThan(0);
    // Chit instalments don't create a separate holding
    expect(ctx.holdings.some((h) => h.type === 'Chit fund')).toBe(false);

    for (const debt of ctx.data.debts) {
      await act(async () => {
        r = ReactTestRenderer.create(<DataProvider><DebtDetailSheet debtId={debt.id} onClose={() => {}} onToast={() => {}} /></DataProvider>);
      });
      await flush();
      expect(texts(r)).toContain(debt.name);
      r.unmount();
    }
  });

  test('confirming a payment adds the expense and reduces the loan', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(makeSampleData()));
    let r;
    await act(async () => { r = ReactTestRenderer.create(<DataProvider><Grab /><ConfirmPayments /></DataProvider>); });
    await flush();
    const loan = ctx.data.debts.find((d) => d.name === 'Personal loan');
    const before = ctx.data.entries.length;
    const paidBtn = r.root.findAll((n) => typeof n.props.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === 'Paid'))[0];
    if (paidBtn) {
      await act(async () => { paidBtn.props.onPress(); });
      const confirmation = r.root.findByType(AmountDateDialog);
      await act(async () => { confirmation.props.onSave({ amount: confirmation.props.initialAmount, date: todayStr(), switchOn: false }); });
      await flush();
      expect(ctx.data.entries.length).toBe(before + 1);
      expect(Object.values(ctx.data.debts.find((d) => d.id === loan.id).statuses)).toContain('paid');
    }
    r.unmount();
  });

  test('adding a loan through the form', async () => {
    const onSave = jest.fn();
    let r;
    await act(async () => { r = ReactTestRenderer.create(<DebtSheet initial={{ group: 'owe' }} onSave={onSave} onClose={() => {}} />); });
    expect(r.root.findAll((n) => n.props.label === 'Chit value (₹, optional)').length).toBe(0);
    await pressByText(r, 'Personal loan');
    expect(texts(r)).toMatch(/Interest % a year/);
    await pressByText(r, 'Save');
    expect(texts(r)).toMatch(/Enter lender/);
    const setText = async (label, v) => { const i = r.root.findAll((n) => n.props.label === label)[0]; await act(async () => { i.props.onChangeText(v); }); };
    await setText('Lender', 'Test bank');
    await setText('Loan amount (₹)', '68000');
    await setText('Interest % a year', '11.5');
    await setText('Tenure (months)', '24');
    const dateField = r.root.findAll((n) => n.props.label === 'First EMI date')[0];
    await act(async () => { dateField.props.onChange('2026-10-05'); });
    expect(texts(r)).toMatch(/EMI ₹3,185/);
    await pressByText(r, 'Save');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ kind: 'loan', principal: 68000, tenureMonths: 24, recordMode: 'ask' });
    expect(Math.round(onSave.mock.calls[0][0].emi)).toBe(3185);
    r.unmount();
  });
});

/* eslint-env jest */
describe('Upcoming payments', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(AUTH_MODE_KEY, 'guest');
  });

  test('the card lists what is due and splits the totals', async () => {
    const UpcomingCard = require('../src/components/UpcomingCard').default;
    const { addMonthsDate, todayStr } = require('../src/utils/dates');
    const soon = addMonthsDate(todayStr(), 0, Math.min(28, Number(todayStr().slice(8, 10)) + 3));
    const data = {
      entries: [], investments: [], values: {}, budgets: {}, netWorthHistory: [],
      debts: [
        {
          id: 'c1', kind: 'card', type: 'Credit card', name: 'Salary card', billAmount: 12000,
          billDate: todayStr(), billDueDate: soon, rate: 42, payments: [], recordMode: 'none', createdOn: todayStr(),
        },
      ],
      recurring: [
        {
          id: 'r1', tab: 'income', template: { kind: 'income', category: 'Salary', amount: 90000, mode: 'Bank transfer', note: 'Monthly salary' },
          day: 1, startMonth: '2026-01', lastPostedMonth: '2026-01', active: true,
        },
      ],
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    let r;
    await act(async () => { r = ReactTestRenderer.create(<DataProvider><UpcomingCard /></DataProvider>); });
    await flush();
    const t = texts(r);
    expect(t).toMatch(/Next 30 days/);
    expect(t).toMatch(/Salary card/);
    expect(t).toMatch(/₹12,000/);
    expect(t).toMatch(/Going out/);
    expect(t).toMatch(/Coming in/);
    r.unmount();
  });

  test('nothing due means no card at all', async () => {
    const UpcomingCard = require('../src/components/UpcomingCard').default;
    let r;
    await act(async () => { r = ReactTestRenderer.create(<DataProvider><UpcomingCard /></DataProvider>); });
    await flush();
    expect(texts(r)).toBe('');
    r.unmount();
  });
});
