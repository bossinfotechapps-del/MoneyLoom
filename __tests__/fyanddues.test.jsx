/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataProvider } from '../src/data/DataContext';
import FYOverview from '../src/screens/FYOverview';
import UpcomingSheet from '../src/components/UpcomingSheet';
import BudgetSheet from '../src/components/BudgetSheet';
import { AUTH_MODE_KEY, STORAGE_KEY } from '../src/data/constants';
import { addFY, currentFY, fyEnd, fyFirstDay, fyLabel, fyStart, isInFY } from '../src/utils/dates';

const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const texts = (root) => root.root.findAllByType(Text).map((t) => [].concat(t.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join('')).join(' | ');

describe('Financial year', () => {
  test('runs 1 April to 31 March', () => {
    expect(fyStart('2026-03-31')).toBe('2025-04');
    expect(fyStart('2026-04-01')).toBe('2026-04');
    expect(fyEnd('2026-04')).toBe('2027-03-31');
    expect(fyFirstDay('2026-04')).toBe('2026-04-01');
    expect(fyLabel('2026-04')).toBe('FY 2026-27');
    expect(addFY('2026-04', -1)).toBe('2025-04');
    expect(isInFY('2027-03-31', '2026-04')).toBe(true);
    expect(isInFY('2027-04-01', '2026-04')).toBe(false);
  });

  test('the FY screen totals the year and lets you open a month', async () => {
    const fy = currentFY();
    const year = Number(fy.slice(0, 4));
    const entries = [
      { id: 'i1', kind: 'income', date: `${year}-04-01`, category: 'Salary', amount: 90000, mode: 'Bank transfer', note: 'Salary' },
      { id: 'e1', kind: 'expense', date: `${year}-04-05`, category: 'Rent & housing', amount: 12000, mode: 'UPI', note: 'Rent' },
      { id: 'e2', kind: 'expense', date: `${year}-05-05`, category: 'Eating out', amount: 3000, mode: 'UPI', note: 'Dinner' },
    ];
    await AsyncStorage.clear();
    await AsyncStorage.setItem(AUTH_MODE_KEY, 'guest');
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ entries, investments: [], values: {} }));
    const onOpenMonth = jest.fn();
    let r;
    await act(async () => {
      r = ReactTestRenderer.create(
        <DataProvider><FYOverview fy={fy} setFY={() => {}} period="fy" setPeriod={() => {}} onOpenMonth={onOpenMonth} bottomSpace={96} /></DataProvider>
      );
    });
    await flush();
    const t = texts(r);
    expect(t).toMatch(new RegExp(fyLabel(fy)));
    expect(t).toMatch(/1 April/);
    expect(t).toMatch(/Where the year went/);
    expect(t).toMatch(/Rent & housing/);
    // Tapping a category row hands back to the caller
    const row = r.root.findAll((n) => n.props.accessibilityLabel && String(n.props.accessibilityLabel).startsWith('Rent & housing'))[0];
    await act(async () => { row.props.onPress(); });
    expect(onOpenMonth).toHaveBeenCalled();
    r.unmount();
  });
});

describe('EMIs and dues', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(AUTH_MODE_KEY, 'guest');
  });

  test('lists nothing politely when there are no debts', async () => {
    let r;
    await act(async () => { r = ReactTestRenderer.create(<DataProvider><UpcomingSheet onClose={() => {}} /></DataProvider>); });
    await flush();
    expect(texts(r)).toMatch(/Nothing due in the next 30 days/);
    r.unmount();
  });

  test('shows a loan EMI with its amount and offers longer ranges', async () => {
    const debts = [{
      id: 'p', kind: 'loan', type: 'Personal loan', name: 'Personal loan', principal: 68000, rate: 11.5,
      tenureMonths: 24, firstEmiDate: '2026-01-07', emi: 3185, recordMode: 'auto', createdOn: '2026-01-01', postedThrough: '',
    }];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ entries: [], investments: [], values: {}, debts }));
    let r;
    await act(async () => { r = ReactTestRenderer.create(<DataProvider><UpcomingSheet onClose={() => {}} /></DataProvider>); });
    await flush();
    const t = texts(r);
    expect(t).toMatch(/Personal loan/);
    expect(t).toMatch(/Going out/);
    expect(t).toMatch(/Next 90 days/);
    r.unmount();
  });
});

describe('Budget rows', () => {
  test('each row can be removed, and rows keep a fixed height while typing', async () => {
    await AsyncStorage.clear();
    let r;
    await act(async () => {
      r = ReactTestRenderer.create(
        <DataProvider>
          <BudgetSheet budgets={{ 'Eating out': 3000 }} budgetPeriod="monthly" spentByCategory={{ 'Eating out': 1200 }} onSave={() => {}} onClose={() => {}} />
        </DataProvider>
      );
    });
    await flush();
    const remove = r.root.findAll((n) => n.props.accessibilityLabel === 'Remove Eating out')[0];
    expect(remove).toBeTruthy();
    r.unmount();
  });
});
