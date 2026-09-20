import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  endConnection, fetchProducts, finishTransaction, getAvailablePurchases, initConnection,
  purchaseErrorListener, purchaseUpdatedListener, requestPurchase,
} from 'react-native-iap';
import { PREMIUM_KEY } from '../data/constants';
import { BILLING_ENABLED, PREMIUM_SKU } from './premiumConfig';

const PremiumContext = createContext({
  ready: false, isPremium: false, price: null, busy: false, storeAvailable: false,
  buy: () => {}, restore: () => {}, onPurchased: null,
});

const ownsPremium = (purchases) =>
  (purchases || []).find((p) => p.productId === PREMIUM_SKU && p.purchaseState === 'purchased');

export function PremiumProvider({ children, onMessage }) {
  // `ready` becomes true once the saved status is read, so ads never flash for paying users
  const [ready, setReady] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [price, setPrice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [storeAvailable, setStoreAvailable] = useState(false);
  const connected = useRef(false);
  const restoreRef = useRef(null);
  const messageRef = useRef(onMessage);
  messageRef.current = onMessage;

  const grant = useCallback(async (value) => {
    setIsPremium(value);
    try {
      await AsyncStorage.setItem(PREMIUM_KEY, value ? '1' : '0');
    } catch (e) {
      // Store check on next launch will correct it
    }
  }, []);

  // Acknowledge (required within 3 days or Google refunds) and unlock
  const completePurchase = useCallback(
    async (purchase) => {
      try {
        if (!purchase.isAcknowledgedAndroid) await finishTransaction({ purchase, isConsumable: false });
      } catch (e) {
        // Retried on next launch via getAvailablePurchases
      }
      await grant(true);
    },
    [grant]
  );

  useEffect(() => {
    let cancelled = false;
    let updatedSub = null;
    let errorSub = null;

    (async () => {
      try {
        const cached = await AsyncStorage.getItem(PREMIUM_KEY);
        if (!cancelled && cached === '1') setIsPremium(true);
      } catch (e) {
        // ignore
      }
      if (!cancelled) setReady(true);

      // Debug builds can't reach Play billing, so don't start it at all
      if (!BILLING_ENABLED) return;

      try {
        connected.current = await initConnection();
      } catch (e) {
        connected.current = false;
      }
      if (cancelled || !connected.current) return;
      setStoreAvailable(true);

      updatedSub = purchaseUpdatedListener(async (purchase) => {
        if (purchase.productId !== PREMIUM_SKU) return;
        if (purchase.purchaseState === 'purchased') {
          await completePurchase(purchase);
          setBusy(false);
          messageRef.current?.('Ads removed. Thank you for supporting MoneyLoom!');
        } else if (purchase.purchaseState === 'pending') {
          setBusy(false);
          Alert.alert('Payment pending', 'Ads will be removed automatically once Google Play confirms your payment.');
        }
      });

      errorSub = purchaseErrorListener((error) => {
        setBusy(false);
        if (error?.code === 'user-cancelled') return;
        if (error?.code === 'already-owned') {
          restoreRef.current?.(true);
          return;
        }
        Alert.alert('Purchase not completed', error?.message || 'Please try again in a moment.');
      });

      try {
        const products = await fetchProducts({ skus: [PREMIUM_SKU], type: 'in-app' });
        const product = (products || []).find((p) => p.id === PREMIUM_SKU || p.productId === PREMIUM_SKU);
        if (!cancelled && product) setPrice(product.displayPrice);
      } catch (e) {
        // Product not set up yet or offline
      }

      try {
        const purchases = await getAvailablePurchases();
        if (cancelled) return;
        const owned = ownsPremium(purchases);
        if (owned) await completePurchase(owned);
        else await grant(false); // store confirmed no purchase (e.g. refunded)
      } catch (e) {
        // Offline: keep the saved status
      }
    })();

    return () => {
      cancelled = true;
      updatedSub?.remove();
      errorSub?.remove();
      if (connected.current) endConnection().catch(() => {});
    };
  }, [completePurchase, grant]);

  const buy = useCallback(async () => {
    if (!connected.current) {
      Alert.alert(
        'Google Play not available',
        BILLING_ENABLED
          ? 'Install MoneyLoom from Google Play and sign in to the Play Store to buy.'
          : 'Purchases are switched off in this development build. Install from the Play testing track to try them.'
      );
      return;
    }
    setBusy(true);
    try {
      await requestPurchase({ request: { google: { skus: [PREMIUM_SKU] } }, type: 'in-app' });
      // Result arrives in purchaseUpdatedListener / purchaseErrorListener
    } catch (e) {
      setBusy(false);
      Alert.alert('Purchase not started', e?.message || 'Please try again in a moment.');
    }
  }, []);

  const restore = useCallback(
    async (silent = false) => {
      if (!connected.current) {
        if (!silent) Alert.alert('Google Play not available', 'Sign in to the Play Store with the account you bought with, then try again.');
        return;
      }
      setBusy(true);
      try {
        const owned = ownsPremium(await getAvailablePurchases());
        if (owned) {
          await completePurchase(owned);
          messageRef.current?.('Purchase restored. Ads removed.');
        } else if (!silent) {
          Alert.alert('No purchase found', 'This Google account hasn’t bought Remove ads yet.');
        }
      } catch (e) {
        if (!silent) Alert.alert('Couldn’t check purchases', 'Check your internet connection and try again.');
      } finally {
        setBusy(false);
      }
    },
    [completePurchase]
  );
  restoreRef.current = restore;

  const value = useMemo(
    () => ({ ready, isPremium, price, busy, storeAvailable, buy, restore }),
    [ready, isPremium, price, busy, storeAvailable, buy, restore]
  );
  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export const usePremium = () => useContext(PremiumContext);
