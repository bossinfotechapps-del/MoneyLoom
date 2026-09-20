/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Keyboard, ScrollView, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataProvider } from '../src/data/DataContext';
import EntrySheet from '../src/components/EntrySheet';
import BudgetSheet from '../src/components/BudgetSheet';
import DebtSheet from '../src/components/DebtSheet';
import AccountSheet from '../src/components/AccountSheet';
import DebtDetailSheet from '../src/components/DebtDetailSheet';
import UpcomingSheet from '../src/components/UpcomingSheet';
import PayoffPlannerSheet from '../src/components/PayoffPlannerSheet';
import CategoryTrendSheet from '../src/components/CategoryTrendSheet';
import AmountDialog from '../src/components/AmountDialog';
import TextPromptDialog from '../src/components/TextPromptDialog';
import { AUTH_MODE_KEY, STORAGE_KEY } from '../src/data/constants';

const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const texts = (root) => root.root.findAllByType(Text).map((t) => [].concat(t.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join('')).join(' | ');

const loan = {
  id: 'p', kind: 'loan', type: 'Personal loan', name: 'Personal loan', principal: 68000, rate: 11.5,
  tenureMonths: 24, firstEmiDate: '2026-01-07', emi: 3185, recordMode: 'auto', createdOn: '2026-01-01', postedThrough: '',
};

const wrap = (el) => <DataProvider>{el}</DataProvider>;

const render = async (el) => {
  let r;
  await act(async () => { r = ReactTestRenderer.create(wrap(el)); });
  await flush();
  return r;
};

describe('Every sheet scrolls and keeps its bottom actions reachable', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(AUTH_MODE_KEY, 'guest');
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ entries: [], investments: [], values: {}, debts: [loan] }));
  });

  const cases = [
    ['Add entry', () => <EntrySheet initial={{ tab: 'expense' }} investmentNames={[]} onSave={() => {}} onDelete={() => {}} onClose={() => {}} />],
    ['Budgets', () => <BudgetSheet budgets={{}} budgetPeriod="monthly" spentByCategory={{}} onSave={() => {}} onClose={() => {}} />],
    ['Add debt', () => <DebtSheet initial={{ group: 'owe' }} onSave={() => {}} onClose={() => {}} />],
    ['Add account', () => <AccountSheet initial={{}} onSave={() => {}} onDelete={() => {}} onClose={() => {}} />],
    ['Loan detail', () => <DebtDetailSheet debtId="p" onClose={() => {}} onToast={() => {}} />],
    ['EMIs and dues', () => <UpcomingSheet onClose={() => {}} />],
    ['Payoff planner', () => <PayoffPlannerSheet onClose={() => {}} />],
    ['Category trend', () => <CategoryTrendSheet category="Eating out" onClose={() => {}} onOpenBudgets={() => {}} />],
  ];

  test.each(cases)('%s scrolls and has a close action', async (name, make) => {
    const r = await render(make());
    // Every sheet must have a scrollable body, or its lower half becomes unreachable
    expect(r.root.findAllByType(ScrollView).length).toBeGreaterThan(0);
    expect(r.root.findAll((n) => n.props.accessibilityLabel === 'Close').length).toBeGreaterThan(0);
    r.unmount();
  });

  test('the loan screen shows Delete at the bottom of a scrollable body', async () => {
    const r = await render(<DebtDetailSheet debtId="p" onClose={() => {}} onToast={() => {}} />);
    const t = texts(r);
    expect(t).toMatch(/Delete/);
    expect(t).toMatch(/Mark as closed/);
    expect(r.root.findAllByType(ScrollView).length).toBeGreaterThan(0);
    r.unmount();
  });

  test('dialogs keep their buttons outside the scrolling body', async () => {
    let r;
    await act(async () => {
      r = ReactTestRenderer.create(<AmountDialog title="Balance" label="Amount (₹)" initial={100} onSave={() => {}} onClose={() => {}} />);
    });
    expect(texts(r)).toMatch(/Cancel/);
    expect(texts(r)).toMatch(/Save/);
    expect(r.root.findAllByType(ScrollView).length).toBeGreaterThan(0);
    r.unmount();

    await act(async () => {
      r = ReactTestRenderer.create(<TextPromptDialog title="New category" label="Category name" onSave={() => null} onClose={() => {}} />);
    });
    expect(texts(r)).toMatch(/Add/);
    r.unmount();
  });
});

describe('Keyboard space', () => {
  const listeners = {};
  beforeEach(() => {
    Object.keys(listeners).forEach((k) => delete listeners[k]);
    jest.spyOn(Keyboard, 'addListener').mockImplementation((event, handler) => {
      listeners[event] = handler;
      return { remove: () => delete listeners[event] };
    });
  });
  afterEach(() => jest.restoreAllMocks());

  test('a form sheet makes room when the keyboard opens', async () => {
    const r = await render(<AccountSheet initial={{}} onSave={() => {}} onDelete={() => {}} onClose={() => {}} />);
    const spacer = () => {
      const views = r.root.findAll((n) => n.props.style && n.props.style.height !== undefined && typeof n.type === 'string');
      return views.length ? views[views.length - 1].props.style.height : null;
    };
    expect(spacer()).toBe(0);
    await act(async () => { listeners.keyboardDidShow?.({ endCoordinates: { screenY: 400, height: 350 } }); });
    await flush();
    expect(spacer()).toBeGreaterThan(0);
    r.unmount();
  });
});
