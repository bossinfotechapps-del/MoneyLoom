/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import { DataProvider } from '../src/data/DataContext';
import OverviewScreen from '../src/screens/OverviewScreen';
import EntriesScreen from '../src/screens/EntriesScreen';
import InvestmentsScreen from '../src/screens/InvestmentsScreen';
import MoreScreen from '../src/screens/MoreScreen';
import { PremiumProvider } from '../src/premium/PremiumContext';
import { AuthProvider } from '../src/auth/AuthContext';
import BudgetSheet from '../src/components/BudgetSheet';
import { applyRecurring, templateFrom } from '../src/data/compute';
import EntrySheet from '../src/components/EntrySheet';
import { makeSampleData } from '../src/data/sample';
import { AUTH_MODE_KEY, STORAGE_KEY } from '../src/data/constants';
import { currentMonth, currentWeek, addMonths } from '../src/utils/dates';

const cloudStub = { lastBackup: null, busy: false, backupNow: async () => ({ ok: true }), restore: async () => ({ ok: true }), peek: async () => ({ empty: true }), removeCloudCopy: async () => ({ ok: true }) };

const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const texts = (root) => root.root.findAllByType(Text).map((t) => [].concat(t.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join('')).join(' | ');

describe('MoneyLoom', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(AUTH_MODE_KEY, 'guest'); // past the welcome screen
  });

  test('app renders empty state', async () => {
    let r;
    await act(async () => { r = ReactTestRenderer.create(<App />); });
    await flush();
    expect(texts(r)).toContain('Start your money log');
    r.unmount(); // stop its pending save from overwriting the next test's data
  });

  test('screens render with sample data', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(makeSampleData()));
    const wrap = (el) => <DataProvider>{el}</DataProvider>;
    let r;
    for (const m of [currentMonth(), addMonths(currentMonth(), -1), addMonths(currentMonth(), -20)]) {
      await act(async () => { r = ReactTestRenderer.create(wrap(<OverviewScreen period="monthly" setPeriod={() => {}} month={m} setMonth={() => {}} week="2026-09-14" setWeek={() => {}} onAdd={() => {}} onLoadSample={() => {}} onOpenWealth={() => {}} onOpenBudgets={() => {}} bottomSpace={96} />)); });
      await flush();
      const t = texts(r);
      expect(t).toMatch(/Earned/);
      r.unmount();
    }
    await act(async () => { r = ReactTestRenderer.create(wrap(<EntriesScreen onAdd={() => {}} onEdit={() => {}} bottomSpace={96} />)); });
    await flush();
    expect(texts(r)).toMatch(/Spent/);
    r.unmount();
    await act(async () => { r = ReactTestRenderer.create(wrap(<InvestmentsScreen onAdd={() => {}} onEdit={() => {}} onToast={() => {}} bottomSpace={96} />)); });
    await flush();
    expect(texts(r)).toMatch(/Nifty 50 Index Fund/);
    r.unmount();
    await act(async () => { r = ReactTestRenderer.create(
        <AuthProvider><DataProvider><PremiumProvider>
          <MoreScreen onToast={() => {}} onOpenBudgets={() => {}} cloud={cloudStub} bottomSpace={32} appVersion="1.0.0" />
        </PremiumProvider></DataProvider></AuthProvider>
      ); });
    await flush();
    await flush();
    expect(texts(r)).toMatch(/Back up everything/);
    expect(texts(r)).toMatch(/Remove ads/);
    expect(texts(r)).toMatch(/Monthly repeats/);
    expect(texts(r)).not.toMatch(/Load sample data/);
    r.unmount();
    await act(async () => { r = ReactTestRenderer.create(<DataProvider><BudgetSheet budgets={{ 'Eating out': 3000 }} spentByCategory={{ 'Eating out': 1200 }} onSave={() => {}} onClose={() => {}} /></DataProvider>); });
    await flush();
    expect(texts(r)).toMatch(/Total ₹3,000 a month/);
    r.unmount();
  });

  test('overview shows budgets', async () => {
    const d = makeSampleData();
    d.budgets = { 'Eating out': 100, Health: 50000 };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    let r;
    await act(async () => { r = ReactTestRenderer.create(<DataProvider><OverviewScreen period="monthly" setPeriod={() => {}} month={currentMonth()} setMonth={() => {}} week={currentWeek()} setWeek={() => {}} onAdd={() => {}} onLoadSample={() => {}} onOpenWealth={() => {}} onOpenBudgets={() => {}} bottomSpace={96} /></DataProvider>); });
    await flush();
    expect(texts(r)).toMatch(/budget/);
    // Donut legend lists categories with their share of spending
    expect(texts(r)).toMatch(/Rent & housing/);
    expect(texts(r)).toMatch(/Spent/);
    // Removed sections stay gone; net worth line and pace sentence replace them
    expect(texts(r)).not.toMatch(/Portfolio/);
    expect(texts(r)).not.toMatch(/Spending pace/);
    expect(texts(r)).toMatch(/Net worth/);
    expect(texts(r)).toMatch(/Biggest spends/);
    expect(texts(r)).toMatch(/₹[\d,]+ (more|less)|Nothing was logged by this day|same as by this day/);
    r.unmount();
  });

  test('monthly repeats post due months once', () => {
    const rule = { id: 'r1', tab: 'expense', template: templateFrom('expense', { id: 'x', date: '2026-01-05', kind: 'expense', category: 'Rent & housing', amount: 12000, mode: 'UPI', note: 'Rent' }), day: 31, startMonth: '2026-01', lastPostedMonth: '2026-01', active: true, confirmationMode: 'auto' };
    const base = { entries: [], investments: [], values: {}, budgets: {}, recurring: [rule] };
    const a = applyRecurring(base, '2026-04-29');
    expect(a.posted).toBe(2); // Feb (28th) and Mar (31st); April's day 30 not reached yet
    expect(a.data.entries.map((e) => e.date)).toEqual(['2026-02-28', '2026-03-31']);
    expect(a.data.recurring[0].lastPostedMonth).toBe('2026-03');
    const b = applyRecurring(a.data, '2026-04-30');
    expect(b.posted).toBe(1);
    expect(b.data.entries[2].date).toBe('2026-04-30');
    expect(applyRecurring(b.data, '2026-04-30').posted).toBe(0);
    const paused = { ...base, recurring: [{ ...rule, active: false }] };
    expect(applyRecurring(paused, '2026-09-01').posted).toBe(0);
    const inv = { ...base, recurring: [{ ...rule, tab: 'investment', template: templateFrom('investment', { id: 'y', date: '2026-01-05', action: 'invest', type: 'PPF', name: 'PPF', amount: 3000, note: '' }) }] };
    const c = applyRecurring(inv, '2026-02-28');
    expect(c.data.investments[0]).toMatchObject({ name: 'PPF', date: '2026-02-28', recurringId: 'r1' });
    expect(c.data.investments[0].kind).toBeUndefined();
  });

  test('entry sheet validates and saves', async () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    let r;
    await act(async () => { r = ReactTestRenderer.create(<DataProvider><EntrySheet initial={{ tab: 'expense' }} investmentNames={[]} onSave={onSave} onDelete={() => {}} onClose={onClose} /></DataProvider>); });
    await flush();
    const saveBtn = r.root.findAll((n) => n.props.accessibilityRole === undefined && typeof n.props.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === 'Save entry'))[0];
    await act(async () => { saveBtn.props.onPress(); });
    expect(texts(r)).toContain('Enter an amount greater than zero.');
    const amount = r.root.findAll((n) => n.props.keyboardType === 'decimal-pad' && typeof n.props.onChangeText === 'function')[0];
    await act(async () => { amount.props.onChangeText('1,250'); });
    await act(async () => { saveBtn.props.onPress(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toBe('expense');
    expect(onSave.mock.calls[0][1].amount).toBe(1250);
    expect(onSave.mock.calls[0][3]).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });
});

/* eslint-env jest */
describe('Custom categories', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(AUTH_MODE_KEY, 'guest');
  });

  test('a category added from the entry form is saved and selected', async () => {
    const onSave = jest.fn();
    let r;
    await act(async () => {
      r = ReactTestRenderer.create(
        <DataProvider><EntrySheet initial={{ tab: 'expense' }} investmentNames={[]} onSave={onSave} onDelete={() => {}} onClose={() => {}} /></DataProvider>
      );
    });
    await flush();
    const newChip = r.root.findAll((n) => typeof n.props.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === '+ New category'))[0];
    await act(async () => { newChip.props.onPress(); });
    const nameInput = r.root.findAll((n) => n.props.label === 'Category name' && typeof n.props.onChangeText === 'function')[0];
    await act(async () => { nameInput.props.onChangeText('Insurance'); });
    const addBtn = r.root.findAll((n) => typeof n.props.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === 'Add'))[0];
    await act(async () => { addBtn.props.onPress(); });
    await flush();
    expect(texts(r)).toMatch(/Insurance/);
    const amount = r.root.findAll((n) => n.props.keyboardType === 'decimal-pad' && typeof n.props.onChangeText === 'function')[0];
    await act(async () => { amount.props.onChangeText('2400'); });
    const saveBtn = r.root.findAll((n) => typeof n.props.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === 'Save entry'))[0];
    await act(async () => { saveBtn.props.onPress(); });
    expect(onSave.mock.calls[0][1]).toMatchObject({ category: 'Insurance', amount: 2400 });
    // and it was stored for next time (the save is debounced)
    await act(async () => { await new Promise((res) => setTimeout(res, 600)); });
    const saved = JSON.parse(await AsyncStorage.getItem(STORAGE_KEY));
    expect(saved.customCategories.expense).toContain('Insurance');
    r.unmount();
  });
});

/* eslint-env jest */
describe('Backup file helpers', () => {

  test('saving to Downloads reports where the file went', async () => {
    const blob = require('react-native-blob-util');
    blob.MediaCollection = { copyToMediaStore: jest.fn(() => Promise.resolve('content://downloads/1')) };
    blob.fs.writeFile = jest.fn(() => Promise.resolve());
    const { saveToDownloads } = require('../src/utils/files');
    const result = await saveToDownloads('moneyloom-backup.json', '{}', 'application/json');
    expect(result).toEqual({ saved: true, where: 'Downloads/moneyloom-backup.json' });
    expect(blob.MediaCollection.copyToMediaStore).toHaveBeenCalled();
  });

  test('a failed save returns a message instead of doing nothing', async () => {
    const blob = require('react-native-blob-util');
    blob.MediaCollection = { copyToMediaStore: jest.fn(() => Promise.reject(new Error('no space'))) };
    blob.fs.writeFile = jest.fn(() => Promise.resolve());
    const { saveToDownloads } = require('../src/utils/files');
    const result = await saveToDownloads('x.json', '{}', 'application/json');
    expect(result.error).toMatch(/Couldn’t save/);
  });

  test('closing the share sheet is not treated as an error', async () => {
    const blob = require('react-native-blob-util');
    blob.fs.writeFile = jest.fn(() => Promise.resolve());
    const share = require('react-native-share');
    share.open = jest.fn(() => Promise.resolve({ dismissedAction: true }));
    const { shareTextFile } = require('../src/utils/files');
    expect(await shareTextFile('x.json', '{}', 'application/json')).toEqual({ cancelled: true });
  });
});

/* eslint-env jest */
describe('Weekly budgets', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(AUTH_MODE_KEY, 'guest');
  });

  test('week view totals only Monday to Sunday', async () => {
    const { weekStart, weekEnd, addWeeks } = require('../src/utils/dates');
    const thisWeek = currentWeek();
    const lastWeek = addWeeks(thisWeek, -1);
    const data = {
      entries: [
        { id: '1', kind: 'expense', date: thisWeek, category: 'Eating out', amount: 500, mode: 'UPI', note: 'in week' },
        { id: '2', kind: 'expense', date: weekEnd(thisWeek), category: 'Eating out', amount: 300, mode: 'UPI', note: 'sunday' },
        { id: '3', kind: 'expense', date: lastWeek, category: 'Eating out', amount: 900, mode: 'UPI', note: 'last week' },
      ],
      investments: [], values: {}, budgets: { 'Eating out': 1000 }, budgetPeriod: 'weekly',
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    let r;
    await act(async () => {
      r = ReactTestRenderer.create(
        <DataProvider>
          <OverviewScreen period="weekly" setPeriod={() => {}} month={currentMonth()} setMonth={() => {}} week={thisWeek} setWeek={() => {}} onAdd={() => {}} onLoadSample={() => {}} onOpenWealth={() => {}} onOpenBudgets={() => {}} bottomSpace={96} />
        </DataProvider>
      );
    });
    await flush();
    const t = texts(r);
    expect(t).toMatch(/₹800/); // 500 + 300, last week's 900 excluded
    expect(t).toMatch(/Last 6 weeks/);
    expect(t).toMatch(/₹200 left of ₹1,000 this week/);
    expect(weekStart(weekEnd(thisWeek))).toBe(thisWeek);
    r.unmount();
  });

  test('a monthly budget is converted when viewing weekly', () => {
    const { budgetFor } = require('../src/data/compute');
    const data = { budgets: { 'Eating out': 4345 }, budgetPeriod: 'monthly' };
    expect(budgetFor(data, 'Eating out', 'monthly')).toBe(4345);
    expect(budgetFor(data, 'Eating out', 'weekly')).toBe(1003);
    const weeklyData = { budgets: { 'Eating out': 1000 }, budgetPeriod: 'weekly' };
    expect(budgetFor(weeklyData, 'Eating out', 'monthly')).toBe(4333);
  });
});

/* eslint-env jest */
describe('Leak card on Overview', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(AUTH_MODE_KEY, 'guest');
  });

  test('shows repeated spends for the month on screen', async () => {
    const today = currentMonth();
    const entries = ['Tea', 'Tea', 'Tea', 'Tea', 'Tea'].map((note, i) => ({
      id: `t${i}`, kind: 'expense', date: `${today}-0${i + 1}`, category: 'Eating out', amount: 120, mode: 'UPI', note,
    }));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ entries, investments: [], values: {} }));
    let r;
    await act(async () => {
      r = ReactTestRenderer.create(
        <DataProvider>
          <OverviewScreen period="monthly" setPeriod={() => {}} month={currentMonth()} setMonth={() => {}} week="2026-09-14" setWeek={() => {}} onAdd={() => {}} onLoadSample={() => {}} onOpenWealth={() => {}} onOpenBudgets={() => {}} bottomSpace={96} />
        </DataProvider>
      );
    });
    await flush();
    expect(texts(r)).toMatch(/Adds up quietly/);
    expect(texts(r)).toMatch(/Tea/);
    expect(texts(r)).toMatch(/5 times this month/);
    r.unmount();
  });
});
