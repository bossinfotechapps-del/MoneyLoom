/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { AppState, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useCloudBackup from '../src/auth/useCloudBackup';
import { fingerprintOf } from '../src/auth/cloud';
import { CLOUD_META_KEY } from '../src/data/constants';

// Firebase is "not configured" everywhere else in the tests; here it is, so the backup path runs
jest.mock('@react-native-firebase/app', () => ({ getApp: () => ({}) }));

const firestore = require('@react-native-firebase/firestore');

const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };

const user = { uid: 'u1', name: 'Test', email: 't@example.com' };
const withEntries = (n) => ({
  entries: Array.from({ length: n }, (_, i) => ({ id: `e${i}`, kind: 'expense', date: '2026-09-01', category: 'Health', amount: 100, mode: 'UPI', note: '' })),
  investments: [], values: {}, debts: [], recurring: [], budgets: {}, netWorthHistory: [],
});

let api;
function Probe({ data, replaceAll = () => {} }) {
  api = useCloudBackup({ user, data, loaded: true, replaceAll });
  return <Text>ok</Text>;
}

const mount = async (data) => {
  let r;
  await act(async () => { r = ReactTestRenderer.create(<Probe data={data} />); });
  await flush();
  return r;
};

describe('Cloud backup', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    firestore.setDoc.mockClear();
    firestore.setDoc.mockImplementation(() => Promise.resolve());
  });

  test('a manual backup writes the data and the history copy, then records the time', async () => {
    const r = await mount(withEntries(3));
    await act(async () => { await api.backupNow(); });
    await flush();
    // One write for the current copy, one for the version
    expect(firestore.setDoc).toHaveBeenCalledTimes(2);
    expect(api.lastBackup).toBeTruthy();
    expect(api.failed).toBe(false);
    const meta = JSON.parse(await AsyncStorage.getItem(CLOUD_META_KEY));
    expect(meta.fingerprint).toBe(fingerprintOf(withEntries(3)));
    r.unmount();
  });

  test('a failure is remembered and shown, not swallowed', async () => {
    firestore.setDoc.mockImplementation(() => Promise.reject({ code: 'firestore/permission-denied' }));
    const r = await mount(withEntries(2));
    await act(async () => { await api.backupNow(); });
    await flush();
    expect(api.failed).toBe(true);
    expect(api.failMessage).toMatch(/Firestore rules/);
    expect(api.lastBackup).toBeNull();
    r.unmount();
  });

  test('leaving the app does nothing when the data has not changed since the last backup', async () => {
    const data = withEntries(4);
    await AsyncStorage.setItem(CLOUD_META_KEY, JSON.stringify({ at: new Date().toISOString(), ms: 0, fingerprint: fingerprintOf(data) }));
    const r = await mount(data);
    expect(api.changesPending).toBe(false);
    await act(async () => { AppState.emit ? AppState.emit('change', 'background') : null; });
    await flush();
    expect(firestore.setDoc).not.toHaveBeenCalled();
    r.unmount();
  });

  test('changes since the last backup are flagged', async () => {
    await AsyncStorage.setItem(CLOUD_META_KEY, JSON.stringify({ at: new Date().toISOString(), ms: Date.now(), fingerprint: 'stale' }));
    const r = await mount(withEntries(5));
    expect(api.changesPending).toBe(true);
    r.unmount();
  });

  test('an empty ledger is never backed up automatically', async () => {
    const r = await mount(withEntries(0));
    expect(api.changesPending).toBe(false);
    r.unmount();
  });
});

/* eslint-env jest */
describe('Cloud backup that never answers', () => {
  test('gives up after the deadline instead of spinning for ever', async () => {
    jest.useFakeTimers();
    const { backupToCloud } = require('../src/auth/cloud');
    // Firestore queues the write and never settles: exactly what a missing database looks like
    firestore.setDoc.mockImplementation(() => new Promise(() => {}));
    const promise = backupToCloud('u1', { entries: [], investments: [], values: {}, debts: [] });
    await act(async () => { jest.advanceTimersByTime(21000); });
    const result = await promise;
    expect(result.error).toMatch(/didn’t answer/);
    jest.useRealTimers();
  });
});
