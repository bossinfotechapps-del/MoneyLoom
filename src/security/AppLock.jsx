import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Local screen lock only: AsyncStorage is not encrypted. Never include lock secrets in backups.
const PIN_KEY = '@moneyloom:screen-pin:v1';
const RECOVERY_KEY = '@moneyloom:screen-pin-recovery:v1';
const LockContext = createContext(null);
export const useAppLock = () => useContext(LockContext);
const validPin = value => /^\d{6}$/.test(value);
const validRecovery = value => typeof value === 'string' && value.trim().length >= 16 && value.trim().length <= 128;

export function AppLockProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [pin, setPin] = useState(null);
  const [recoveryEnabled, setRecoveryEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState('');
  const backgroundAt = useRef(null);
  const pinRef = useRef(null);
  const recoveryRef = useRef(null);
  const failures = useRef(0);
  const blockedUntil = useRef(0);

  useEffect(() => {
    let mounted = true;
    Promise.all([AsyncStorage.getItem(PIN_KEY), AsyncStorage.getItem(RECOVERY_KEY)])
      .then(([savedPin, savedRecovery]) => {
        if (!mounted) return;
        // Never silently unlock if the stored PIN is unreadable or invalid.
        const next = validPin(savedPin || '') ? savedPin : null;
        if (savedPin && !next) setError('App Lock settings are invalid. Do not clear app data; restore your project backup.');
        pinRef.current = next;
        recoveryRef.current = next && validRecovery(savedRecovery) ? savedRecovery : null;
        setPin(next);
        setRecoveryEnabled(Boolean(recoveryRef.current));
        setLocked(Boolean(next));
      })
      .catch(() => { if (mounted) { setError('Could not read App Lock settings. Try restarting the app.'); setLocked(true); } })
      .finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' || state === 'inactive') {
        if (backgroundAt.current == null) backgroundAt.current = Date.now();
      } else if (state === 'active') {
        if (pinRef.current && backgroundAt.current != null && Date.now() - backgroundAt.current >= 1000) setLocked(true);
        backgroundAt.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  const enable = useCallback(async value => {
    if (!validPin(value)) throw new Error('Enter a six-digit PIN.');
    await AsyncStorage.setItem(PIN_KEY, value);
    pinRef.current = value;
    setPin(value);
    setLocked(false);
  }, []);

  const disable = useCallback(async value => {
    if (value !== pinRef.current) return false;
    await AsyncStorage.removeItem(PIN_KEY);
    await AsyncStorage.removeItem(RECOVERY_KEY);
    pinRef.current = null;
    recoveryRef.current = null;
    setPin(null);
    setRecoveryEnabled(false);
    setLocked(false);
    return true;
  }, []);

  const changePin = useCallback(async (oldPin, newPin) => {
    if (oldPin !== pinRef.current) return false;
    if (!validPin(newPin)) throw new Error('Enter a six-digit PIN.');
    await AsyncStorage.setItem(PIN_KEY, newPin);
    pinRef.current = newPin;
    setPin(newPin);
    return true;
  }, []);

  const setRecovery = useCallback(async (currentPin, phrase) => {
    if (!pinRef.current || currentPin !== pinRef.current) return false;
    if (!validRecovery(phrase)) throw new Error('Use a recovery phrase of 16–128 characters.');
    if (phrase === currentPin) throw new Error('Your recovery phrase must be different from your PIN.');
    const next = phrase.trim();
    await AsyncStorage.setItem(RECOVERY_KEY, next);
    recoveryRef.current = next;
    setRecoveryEnabled(true);
    return true;
  }, []);

  const unlock = useCallback(value => {
    if (pinRef.current && value === pinRef.current) { setLocked(false); failures.current = 0; return true; }
    return false;
  }, []);

  const recoverPin = useCallback(async (phrase, newPin) => {
    if (Date.now() < blockedUntil.current) throw new Error('Too many attempts. Try again in 60 seconds.');
    if (!recoveryRef.current || !pinRef.current) throw new Error('No recovery phrase was configured.');
    if (phrase.trim() !== recoveryRef.current) {
      failures.current += 1;
      if (failures.current >= 5) { failures.current = 0; blockedUntil.current = Date.now() + 60000; }
      return false;
    }
    if (!validPin(newPin)) throw new Error('Enter a new six-digit PIN.');
    await AsyncStorage.setItem(PIN_KEY, newPin);
    pinRef.current = newPin;
    setPin(newPin);
    failures.current = 0;
    setLocked(false);
    return true;
  }, []);

  return <LockContext.Provider value={{ ready, enabled: Boolean(pin), recoveryEnabled, locked, error, enable, disable, changePin, setRecovery, unlock, recoverPin, lock: () => { if (pinRef.current) setLocked(true); } }}>{children}</LockContext.Provider>;
}
