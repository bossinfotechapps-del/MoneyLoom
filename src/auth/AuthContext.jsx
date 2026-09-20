import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { getApp } from '@react-native-firebase/app';
import { GoogleAuthProvider, deleteUser, getAuth, onAuthStateChanged, signInWithCredential, signOut } from '@react-native-firebase/auth';
import { AUTH_MODE_KEY } from '../data/constants';
import { WEB_CLIENT_ID } from './authConfig';

const AuthContext = createContext(null);

// True once Firebase is actually set up (google-services.json present and a real web client ID)
export function isCloudConfigured() {
  try {
    getApp();
  } catch (e) {
    return false;
  }
  return !!WEB_CLIENT_ID && !WEB_CLIENT_ID.startsWith('YOUR_');
}

const friendlyError = (e) => {
  if (isErrorWithCode(e)) {
    switch (e.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return null; // the person closed the picker, not an error worth showing
      case statusCodes.IN_PROGRESS:
        return null;
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Google Play services is missing or out of date on this phone.';
      default:
        break;
    }
  }
  const code = e?.code || '';
  if (code.includes('network')) return 'No internet connection. Try again when you’re online.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Please try again in a few minutes.';
  return 'Sign-in didn’t finish. Please try again.';
};

export function AuthProvider({ children }) {
  const cloudReady = useMemo(() => isCloudConfigured(), []);
  const [user, setUser] = useState(null);
  // 'guest' once the person chooses to continue without an account; null until they choose
  const [mode, setMode] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const configured = useRef(false);

  useEffect(() => {
    let unsubscribe = null;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(AUTH_MODE_KEY);
        if (saved) setMode(saved);
      } catch (e) {
        // First launch
      }
      if (!cloudReady) {
        setLoaded(true);
        return;
      }
      try {
        GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, offlineAccess: false });
        configured.current = true;
      } catch (e) {
        configured.current = false;
      }
      unsubscribe = onAuthStateChanged(getAuth(), (u) => {
        setUser(u ? { uid: u.uid, name: u.displayName, email: u.email, photo: u.photoURL } : null);
        setLoaded(true);
      });
    })();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [cloudReady]);

  const rememberMode = useCallback(async (value) => {
    setMode(value);
    try {
      await AsyncStorage.setItem(AUTH_MODE_KEY, value);
    } catch (e) {
      // Not critical: the welcome screen would just show again
    }
  }, []);

  // Returns { ok } or { error } so screens can show the message inline
  const signInWithGoogle = useCallback(async () => {
    if (!cloudReady) return { error: 'Google sign-in isn’t set up in this build.' };
    setBusy(true);
    try {
      if (!configured.current) {
        GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, offlineAccess: false });
        configured.current = true;
      }
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return { cancelled: true };
      // Firebase rejects an empty access token, so fetch both tokens rather than passing the ID token alone
      const tokens = await GoogleSignin.getTokens();
      const idToken = tokens?.idToken || response.data?.idToken;
      const accessToken = tokens?.accessToken;
      if (!idToken) return { error: 'Google didn’t return a sign-in token. Check the web client ID in the app setup.' };
      await signInWithCredential(getAuth(), GoogleAuthProvider.credential(idToken, accessToken || null));
      await rememberMode('account');
      return { ok: true };
    } catch (e) {
      const message = friendlyError(e);
      return message ? { error: message } : { cancelled: true };
    } finally {
      setBusy(false);
    }
  }, [cloudReady, rememberMode]);

  const continueAsGuest = useCallback(() => rememberMode('guest'), [rememberMode]);

  const signOutOfGoogle = useCallback(async () => {
    setBusy(true);
    try {
      await GoogleSignin.signOut().catch(() => {});
      await signOut(getAuth());
      await rememberMode('guest');
      return { ok: true };
    } catch (e) {
      return { error: 'Couldn’t sign out. Please try again.' };
    } finally {
      setBusy(false);
    }
  }, [rememberMode]);

  // Removes the Google account link and the Firebase user. The caller deletes cloud data first.
  const deleteAccount = useCallback(async () => {
    setBusy(true);
    try {
      const current = getAuth().currentUser;
      if (current) await deleteUser(current);
      await GoogleSignin.revokeAccess().catch(() => {});
      await GoogleSignin.signOut().catch(() => {});
      await rememberMode('guest');
      return { ok: true };
    } catch (e) {
      if (e?.code === 'auth/requires-recent-login') {
        return { error: 'For your security, sign in again and then delete the account.' };
      }
      return { error: 'Couldn’t delete the account. Check your connection and try again.' };
    } finally {
      setBusy(false);
    }
  }, [rememberMode]);

  const value = useMemo(
    () => ({
      cloudReady, loaded, user, mode, busy,
      needsWelcome: loaded && !mode && !user,
      signInWithGoogle, continueAsGuest, signOut: signOutOfGoogle, deleteAccount,
    }),
    [cloudReady, loaded, user, mode, busy, signInWithGoogle, continueAsGuest, signOutOfGoogle, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
