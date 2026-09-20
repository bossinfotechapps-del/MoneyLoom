/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import { AuthProvider } from '../src/auth/AuthContext';
import { PremiumProvider } from '../src/premium/PremiumContext';
import WelcomeScreen from '../src/screens/WelcomeScreen';
import { AUTH_MODE_KEY } from '../src/data/constants';

const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const texts = (root) => root.root.findAllByType(Text).map((t) => [].concat(t.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join('')).join(' | ');
const press = async (root, label) => {
  const node = root.root.findAll((n) => typeof n.props.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === label))[0];
  if (!node) throw new Error(`No button "${label}"`);
  await act(async () => { node.props.onPress(); });
};

describe('Welcome and sign-in', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  test('first launch shows the welcome screen, and the choice is remembered', async () => {
    let r;
    await act(async () => { r = ReactTestRenderer.create(<App />); });
    await flush();
    expect(texts(r)).toMatch(/MoneyLoom/);
    expect(texts(r)).toMatch(/Log in seconds/);
    // Without Firebase set up, only the offline option is offered
    expect(texts(r)).toMatch(/Get started/);
    await press(r, 'Get started');
    await flush();
    expect(texts(r)).toMatch(/Start your money log/);
    expect(await AsyncStorage.getItem(AUTH_MODE_KEY)).toBe('guest');
    r.unmount();
  });

  test('a returning guest goes straight to the app', async () => {
    await AsyncStorage.setItem(AUTH_MODE_KEY, 'guest');
    let r;
    await act(async () => { r = ReactTestRenderer.create(<App />); });
    await flush();
    expect(texts(r)).not.toMatch(/Log in seconds/);
    r.unmount();
  });

  test('welcome screen renders its legal links', async () => {
    let r;
    await act(async () => { r = ReactTestRenderer.create(<AuthProvider><WelcomeScreen /></AuthProvider>); });
    await flush();
    expect(texts(r)).toMatch(/Terms of use/);
    expect(texts(r)).toMatch(/Privacy policy/);
    r.unmount();
  });
});

/* eslint-env jest */
describe('Billing in development builds', () => {
  test('Play billing is never started in a debug build', async () => {
    const iap = require('react-native-iap');
    iap.initConnection.mockClear();
    iap.fetchProducts.mockClear();
    iap.getAvailablePurchases.mockClear();
    let r;
    await act(async () => { r = ReactTestRenderer.create(<PremiumProvider><Text>ok</Text></PremiumProvider>); });
    await flush();
    // __DEV__ is true under Jest, so nothing should touch the Play Store
    expect(iap.initConnection).not.toHaveBeenCalled();
    expect(iap.fetchProducts).not.toHaveBeenCalled();
    expect(iap.getAvailablePurchases).not.toHaveBeenCalled();
    r.unmount();
  });
});
