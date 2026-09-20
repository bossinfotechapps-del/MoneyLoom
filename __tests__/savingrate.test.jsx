/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import SavingRateCard from '../src/components/SavingRateCard';
import { addMonths, currentMonth } from '../src/utils/dates';

const texts = (root) => root.root.findAllByType(Text).map((t) => [].concat(t.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join('')).join(' | ');
const cur = currentMonth();

const monthsBack = (list) =>
  list.reduce((acc, t, i) => {
    acc[addMonths(cur, i - (list.length - 1))] = t;
    return acc;
  }, {});

describe('Saving rate card', () => {
  test('shows the latest rate and the direction it is moving', () => {
    const byMonth = monthsBack([
      { earned: 90000, spent: 60000, invested: 0 },
      { earned: 90000, spent: 58000, invested: 0 },
      { earned: 90000, spent: 55000, invested: 0 },
      { earned: 90000, spent: 45000, invested: 0 },
      { earned: 90000, spent: 42000, invested: 0 },
      { earned: 90000, spent: 41000, invested: 0 },
    ]);
    let r;
    act(() => { r = ReactTestRenderer.create(<SavingRateCard byMonth={byMonth} month={cur} />); });
    const t = texts(r);
    expect(t).toMatch(/Saving rate/);
    expect(t).toMatch(/54%/);
    expect(t).toMatch(/against/);
    expect(t).toMatch(/Best month so far/);
    r.unmount();
  });

  test('stays hidden until there are two months with income', () => {
    const byMonth = monthsBack([{ earned: 0, spent: 500, invested: 0 }, { earned: 90000, spent: 40000, invested: 0 }]);
    let r;
    act(() => { r = ReactTestRenderer.create(<SavingRateCard byMonth={byMonth} month={cur} />); });
    expect(r.toJSON()).toBeNull();
    r.unmount();
  });

  test('handles a negative rate without breaking', () => {
    const byMonth = monthsBack([
      { earned: 50000, spent: 70000, invested: 0 },
      { earned: 50000, spent: 60000, invested: 0 },
    ]);
    let r;
    act(() => { r = ReactTestRenderer.create(<SavingRateCard byMonth={byMonth} month={cur} />); });
    expect(texts(r)).toMatch(/-20%/);
    r.unmount();
  });
});
