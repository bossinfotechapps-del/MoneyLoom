/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataProvider, useData } from '../src/data/DataContext';
import AccountList from '../src/components/AccountList';
import AccountSheet from '../src/components/AccountSheet';
import { computeNetWorth } from '../src/data/debts';
import { AUTH_MODE_KEY, STORAGE_KEY } from '../src/data/constants';

const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const texts = (root) => root.root.findAllByType(Text).map((t) => [].concat(t.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join('')).join(' | ');
const pressLabel = async (root, label) => {
  const node = root.root.findAll((n) => typeof n.props.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === label))[0];
  if (!node) throw new Error(`No button "${label}"`);
  await act(async () => { node.props.onPress(); });
};

let ctx;
function Grab() { ctx = useData(); return null; }

const seed = {
  entries: [], investments: [], values: [], debts: [],
  accounts: [
    { id: 'a1', name: 'Salary account', type: 'Salary', last4: '4417', balance: 48500, updatedOn: '2026-09-15', history: [] },
    { id: 'a2', name: 'Cash in hand', type: 'Cash', last4: '', balance: 3500, updatedOn: '2026-01-01', history: [] },
  ],
};

describe('Bank and cash accounts', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(AUTH_MODE_KEY, 'guest');
  });

  test('balances add into net worth', () => {
    const nw = computeNetWorth([], [], '2026-09-20', seed.accounts);
    expect(nw.cash).toBe(52000);
    expect(nw.assets).toBe(52000);
    expect(nw.netWorth).toBe(52000);
  });

  test('the list shows each account and flags a balance that has gone stale', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    let r;
    await act(async () => { r = ReactTestRenderer.create(<DataProvider><AccountList onToast={() => {}} bottomSpace={96} /></DataProvider>); });
    await flush();
    const t = texts(r);
    expect(t).toMatch(/Salary account ····4417/);
    expect(t).toMatch(/Cash in hand/);
    expect(t).toMatch(/₹52,000/);
    expect(t).toMatch(/tap to refresh/);
    r.unmount();
  });

  test('adding an account stores it and counts it', async () => {
    const onSave = jest.fn();
    let r;
    await act(async () => { r = ReactTestRenderer.create(<AccountSheet initial={{}} onSave={onSave} onDelete={() => {}} onClose={() => {}} />); });
    await pressLabel(r, 'Add account');
    expect(texts(r)).toMatch(/Name the account/);
    const field = (label) => r.root.findAll((n) => n.props.label === label)[0];
    await act(async () => { field('Account name').props.onChangeText('HDFC Savings'); });
    await act(async () => { field('Balance today (₹)').props.onChangeText('25,400'); });
    await pressLabel(r, 'Add account');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ name: 'HDFC Savings', balance: 25400, type: 'Savings' });
    r.unmount();
  });

  test('a full account number is refused; four digits are fine', async () => {
    const onSave = jest.fn();
    let r;
    await act(async () => { r = ReactTestRenderer.create(<AccountSheet initial={{}} onSave={onSave} onDelete={() => {}} onClose={() => {}} />); });
    const field = (label) => r.root.findAll((n) => n.props.label === label)[0];
    await act(async () => { field('Account name').props.onChangeText('ICICI'); });
    await act(async () => { field('Balance today (₹)').props.onChangeText('100'); });
    await act(async () => { field('Last 4 digits (optional)').props.onChangeText('12345678'); });
    await pressLabel(r, 'Add account');
    expect(onSave).not.toHaveBeenCalled();
    expect(texts(r)).toMatch(/four numbers/);
    await act(async () => { field('Last 4 digits (optional)').props.onChangeText('5678'); });
    await pressLabel(r, 'Add account');
    expect(onSave).toHaveBeenCalled();
    r.unmount();
  });

  test('updating a balance records the date and keeps a short history', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    let r;
    await act(async () => { r = ReactTestRenderer.create(<DataProvider><Grab /><AccountList onToast={() => {}} bottomSpace={96} /></DataProvider>); });
    await flush();
    await act(async () => { ctx.updateAccountBalance('a1', 51000); });
    await flush();
    const account = ctx.data.accounts.find((a) => a.id === 'a1');
    expect(account.balance).toBe(51000);
    expect(account.history.length).toBe(1);
    expect(ctx.netWorth.cash).toBe(54500);
    r.unmount();
  });

  test('removing an account takes it out of net worth', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    let r;
    await act(async () => { r = ReactTestRenderer.create(<DataProvider><Grab /><AccountList onToast={() => {}} bottomSpace={96} /></DataProvider>); });
    await flush();
    await act(async () => { ctx.removeAccount('a2'); });
    await flush();
    expect(ctx.data.accounts.length).toBe(1);
    expect(ctx.netWorth.cash).toBe(48500);
    r.unmount();
  });
});
