/* eslint-env jest */
import { findLeaks, savingRateTrend, savingRateChange } from '../src/data/leaks';

const e = (date, category, amount, note = '') => ({ id: `${date}-${amount}-${note}`, kind: 'expense', date, category, amount, mode: 'UPI', note });

describe('Leak finder', () => {
  test('spots the same note bought over and over', () => {
    const entries = [
      e('2026-09-02', 'Eating out', 120, 'Tea'),
      e('2026-09-05', 'Eating out', 140, 'Tea'),
      e('2026-09-09', 'Eating out', 120, 'tea '),
      e('2026-09-14', 'Eating out', 160, 'Tea'),
      e('2026-09-15', 'Groceries & food', 2200, 'Weekly groceries'),
    ];
    const leaks = findLeaks({ entries }, '2026-09', false);
    const repeat = leaks.find((l) => l.kind === 'repeat');
    expect(repeat).toBeTruthy();
    expect(repeat.title).toBe('Tea');
    expect(repeat.amount).toBe(540);
    expect(repeat.detail).toContain('4 times');
  });

  test('adds up lots of small spends in one category', () => {
    // Different notes each time, so this is about the count of small amounts, not a repeat
    const notes = ['Auto', 'Bus', 'Metro', 'Share auto', 'Parking', 'Toll', 'Cab', 'Petrol top-up'];
    const entries = notes.map((note, i) => e(`2026-09-0${i + 1}`, 'Fuel & transport', 150, note));
    const leaks = findLeaks({ entries }, '2026-09', false);
    const small = leaks.find((l) => l.kind === 'small');
    expect(small).toBeTruthy();
    expect(small.amount).toBe(1200);
    expect(small.detail).toContain('8 spends');
  });

  test('flags a category well above its usual level', () => {
    const entries = [
      e('2026-06-10', 'Shopping', 2000, 'Clothes'),
      e('2026-07-10', 'Shopping', 2000, 'Clothes'),
      e('2026-08-10', 'Shopping', 2000, 'Clothes'),
      e('2026-09-10', 'Shopping', 9000, 'Phone'),
      e('2026-09-12', 'Shopping', 1000, 'Shoes'),
      e('2026-09-13', 'Groceries & food', 500, 'Milk'),
      e('2026-09-14', 'Health', 400, 'Pharmacy'),
    ];
    const leaks = findLeaks({ entries }, '2026-09', false);
    const above = leaks.find((l) => l.kind === 'above');
    expect(above).toBeTruthy();
    expect(above.title).toBe('Shopping');
    expect(above.amount).toBe(10000);
    expect(above.usual).toBe(2000);
  });

  test('stays quiet when there is little to say', () => {
    const entries = [e('2026-09-01', 'Health', 400, 'Pharmacy'), e('2026-09-02', 'Health', 300, 'Tests')];
    expect(findLeaks({ entries }, '2026-09', false)).toEqual([]);
  });

  test('one finding per category, biggest first, capped at three', () => {
    const entries = [
      ...Array.from({ length: 8 }, (_, i) => e(`2026-09-0${i + 1}`, 'Eating out', 200, 'Tea')),
      ...Array.from({ length: 7 }, (_, i) => e(`2026-09-1${i}`, 'Fuel & transport', 250, 'Auto')),
      ...Array.from({ length: 6 }, (_, i) => e(`2026-09-2${i}`, 'Subscriptions', 100, 'App')),
      ...Array.from({ length: 6 }, (_, i) => e(`2026-09-0${i + 1}`, 'Shopping', 120, 'Bits')),
    ];
    const leaks = findLeaks({ entries }, '2026-09', false);
    expect(leaks.length).toBe(3);
    expect(new Set(leaks.map((l) => l.category)).size).toBe(3);
    expect(leaks[0].amount).toBeGreaterThanOrEqual(leaks[1].amount);
  });

  test('works on a Monday-to-Sunday week', () => {
    const entries = Array.from({ length: 6 }, (_, i) => e(`2026-09-1${4 + i}`, 'Eating out', 180, 'Snack'));
    const leaks = findLeaks({ entries }, '2026-09-14', true);
    expect(leaks.length).toBeGreaterThan(0);
    expect(leaks[0].detail).toContain('week');
  });
});

describe('Saving rate trend', () => {
  const byMonth = {
    '2026-04': { earned: 90000, spent: 60000, invested: 0 },
    '2026-05': { earned: 90000, spent: 58000, invested: 0 },
    '2026-06': { earned: 90000, spent: 55000, invested: 0 },
    '2026-07': { earned: 90000, spent: 45000, invested: 0 },
    '2026-08': { earned: 90000, spent: 42000, invested: 0 },
    '2026-09': { earned: 90000, spent: 41000, invested: 0 },
  };

  test('returns one point per month, newest last', () => {
    const trend = savingRateTrend(byMonth, '2026-09', 6);
    expect(trend.length).toBe(6);
    expect(trend[0].key).toBe('2026-04');
    expect(Math.round(trend[0].rate)).toBe(33);
    expect(Math.round(trend[5].rate)).toBe(54);
  });

  test('months without income have no rate', () => {
    const trend = savingRateTrend({ '2026-09': { earned: 0, spent: 1000, invested: 0 } }, '2026-09', 2);
    expect(trend.every((t) => t.rate === null)).toBe(true);
    expect(savingRateChange(trend)).toBeNull();
  });

  test('compares the older half with the recent half', () => {
    const change = savingRateChange(savingRateTrend(byMonth, '2026-09', 6));
    expect(change.months).toBe(6);
    expect(change.recent).toBeGreaterThan(change.older);
  });
});
