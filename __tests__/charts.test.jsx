/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StatusToast from '../src/components/StatusToast';
import OverviewScreen from '../src/screens/OverviewScreen';
import { DataProvider } from '../src/data/DataContext';
import { axisMonthShort, axisWeekStart, addMonths, currentMonth } from '../src/utils/dates';
import { AUTH_MODE_KEY, STORAGE_KEY } from '../src/data/constants';

const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const texts = (root) => root.root.findAllByType(Text).map((t) => [].concat(t.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join('')).join(' | ');

describe('Chart labels', () => {
  test('months read as Apr-26', () => {
    expect(axisMonthShort('2026-04')).toBe('Apr-26');
    expect(axisMonthShort('2026-09')).toBe('Sep-26');
    expect(axisMonthShort('2027-01')).toBe('Jan-27');
  });

  test('weeks read as their start date', () => {
    expect(axisWeekStart('2026-09-07')).toBe('7-Sep');
    expect(axisWeekStart('2026-09-14')).toBe('14-Sep');
    expect(axisWeekStart('2026-09-28', true)).toBe('28-Sep-26');
  });
});

describe('Overview trend', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(AUTH_MODE_KEY, 'guest');
  });

  test('shows six months, not twelve, with exact figures under the chart', async () => {
    const cur = currentMonth();
    const entries = [0, 1, 2].map((i) => ({
      id: `e${i}`, kind: 'expense', date: `${addMonths(cur, -i)}-05`, category: 'Rent & housing', amount: 12000, mode: 'UPI', note: 'Rent',
    }));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ entries, investments: [], values: {} }));
    let r;
    await act(async () => {
      r = ReactTestRenderer.create(
        <DataProvider>
          <OverviewScreen period="monthly" setPeriod={() => {}} month={cur} setMonth={() => {}} week="2026-09-14" setWeek={() => {}} onAdd={() => {}} onLoadSample={() => {}} onOpenWealth={() => {}} onOpenBudgets={() => {}} bottomSpace={96} />
        </DataProvider>
      );
    });
    await flush();
    const t = texts(r);
    expect(t).toMatch(/Last 6 months/);
    expect(t).not.toMatch(/Last 12 months/);
    // the detail line under the chart names the period and the three figures
    expect(t).toMatch(/Spent/);
    expect(t).toMatch(/Invested/);
    expect(t).toMatch(/Earned/);
    r.unmount();
  });
});

describe('Status toast', () => {
  test('says what it is doing, then what happened', async () => {
    let r;
    await act(async () => { r = ReactTestRenderer.create(<StatusToast status={{ kind: 'working', title: 'Backing up…', detail: 'Sending your data' }} />); });
    expect(texts(r)).toMatch(/Backing up/);
    await act(async () => { r.update(<StatusToast status={{ kind: 'success', title: 'Backed up', detail: '12 entries saved' }} />); });
    expect(texts(r)).toMatch(/Backed up \| 12 entries saved/);
    await act(async () => { r.update(<StatusToast status={{ kind: 'error', title: 'Backup didn’t finish', detail: 'No internet' }} />); });
    expect(texts(r)).toMatch(/didn’t finish/);
    await act(async () => { r.update(<StatusToast status={null} />); });
    expect(r.toJSON()).toBeNull();
    r.unmount();
  });
});
