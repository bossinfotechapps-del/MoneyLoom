/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ScrollView, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataProvider } from '../src/data/DataContext';
import CategoryTrendSheet from '../src/components/CategoryTrendSheet';
import OverviewScreen from '../src/screens/OverviewScreen';
import { AUTH_MODE_KEY, STORAGE_KEY } from '../src/data/constants';
import { addMonths, currentMonth, thinLabels } from '../src/utils/dates';

const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const texts = (root) => root.root.findAllByType(Text).map((t) => [].concat(t.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join('')).join(' | ');

const cur = currentMonth();
const entry = (month, day, amount, note) => ({
  id: `${month}-${day}-${amount}`, kind: 'expense', date: `${month}-${String(day).padStart(2, '0')}`,
  category: 'Eating out', amount, mode: 'UPI', note,
});

const seed = {
  entries: [
    entry(addMonths(cur, -4), 5, 1000, 'Dinner'),
    entry(addMonths(cur, -3), 5, 1000, 'Dinner'),
    entry(addMonths(cur, -2), 5, 3000, 'Birthday dinner'),
    entry(addMonths(cur, -1), 5, 3000, 'Dinner'),
    entry(cur, 5, 3200, 'Dinner'),
    entry(cur, 9, 800, 'Snacks'),
  ],
  investments: [], values: {}, budgets: { 'Eating out': 3000 },
};

describe('Axis labels', () => {
  test('keeps every label when they fit', () => {
    expect(thinLabels(['Jan', 'Feb', 'Mar'], 40)).toEqual(['Jan', 'Feb', 'Mar']);
  });

  test('blanks the ones that would collide, keeping the most recent', () => {
    const labels = ['1 Sep', '8 Sep', '15 Sep', '22 Sep', '29 Sep', '6 Oct'];
    const thinned = thinLabels(labels, 18);
    expect(thinned[thinned.length - 1]).toBe('6 Oct');
    expect(thinned.filter(Boolean).length).toBeLessThan(labels.length);
    expect(thinned.length).toBe(labels.length);
  });

  test('longer labels get thinned harder', () => {
    const short = thinLabels(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], 20).filter(Boolean).length;
    const long = thinLabels(['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026'], 20).filter(Boolean).length;
    expect(long).toBeLessThanOrEqual(short);
  });
});

describe('Category trend', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(AUTH_MODE_KEY, 'guest');
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  });

  test('category detail is scrollable as soon as Month opens, before tapping Week', async () => {
    let r;
    await act(async () => {
      r = ReactTestRenderer.create(<DataProvider><CategoryTrendSheet category="Eating out" onClose={() => {}} /></DataProvider>);
    });
    await flush();
    expect(texts(r)).toMatch(/Month by month/);
    const vertical = r.root.findAllByType(ScrollView).filter(n => n.props.scrollEnabled === true && n.props.nestedScrollEnabled === true);
    expect(vertical.length).toBeGreaterThan(0);
    expect(vertical[0].props.contentContainerStyle.some(x => x && x.flexGrow === 1)).toBe(true);
    r.unmount();
  });

  test('shows the average, the highest month and this month’s entries', async () => {
    let r;
    await act(async () => {
      r = ReactTestRenderer.create(<DataProvider><CategoryTrendSheet category="Eating out" onClose={() => {}} onOpenBudgets={() => {}} /></DataProvider>);
    });
    await flush();
    const t = texts(r);
    expect(t).toMatch(/Eating out/);
    expect(t).toMatch(/Average a month/);
    expect(t).toMatch(/Highest/);
    // ₹4,000 this month across two entries
    expect(t).toMatch(/₹4,000/);
    expect(t).toMatch(/Dinner/);
    expect(t).toMatch(/Snacks/);
    // The budget line is described, not just drawn
    expect(t).toMatch(/monthly limit of ₹3,000/);
    r.unmount();
  });

  test('opens from a category row on Overview', async () => {
    let r;
    await act(async () => {
      r = ReactTestRenderer.create(
        <DataProvider>
          <OverviewScreen period="monthly" setPeriod={() => {}} month={cur} setMonth={() => {}} week="2026-09-14" setWeek={() => {}} onAdd={() => {}} onLoadSample={() => {}} onOpenWealth={() => {}} onOpenBudgets={() => {}} bottomSpace={96} />
        </DataProvider>
      );
    });
    await flush();
    const row = r.root.findAll((n) => n.props.accessibilityLabel && String(n.props.accessibilityLabel).includes('See the monthly trend'))[0];
    expect(row).toBeTruthy();
    await act(async () => { row.props.onPress(); });
    await flush();
    expect(texts(r)).toMatch(/Last 6 months/);
    r.unmount();
  });
});

/* eslint-env jest */
describe('Category trend matches Overview', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(AUTH_MODE_KEY, 'guest');
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  });

  test('offers a week view with start-date labels, and month labels read Apr-26', async () => {
    let r;
    await act(async () => {
      r = ReactTestRenderer.create(<DataProvider><CategoryTrendSheet category="Eating out" onClose={() => {}} onOpenBudgets={() => {}} /></DataProvider>);
    });
    await flush();
    expect(texts(r)).toMatch(/Last 6 months/);
    expect(texts(r)).toMatch(/Month by month/);
    // switch to the week view
    const weekBtn = r.root.findAll((n) => typeof n.props.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === 'Week'))[0];
    await act(async () => { weekBtn.props.onPress(); });
    await flush();
    const t = texts(r);
    expect(t).toMatch(/Week by week/);
    expect(t).toMatch(/Last 6 weeks/);
    expect(t).not.toMatch(/Week 1|Week 2/);
    r.unmount();
  });
});
