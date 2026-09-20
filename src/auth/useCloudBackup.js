import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { CLOUD_META_KEY } from '../data/constants';
import {
  backupToCloud, deleteCloudBackup, fingerprintOf, listCloudVersions, readCloudBackup, readCloudVersion,
} from './cloud';

// One automatic backup a day is plenty for data that changes a few times a day
const DAY_MS = 24 * 60 * 60 * 1000;
// After a failure, wait this long before trying again on its own
const RETRY_MS = 15 * 60 * 1000;

const now = () => Date.now();
const isEmpty = (d) => !d.entries.length && !d.investments.length && !(d.debts || []).length;

/**
 * Keeps the signed-in user's data backed up.
 *
 * Automatic backups run when the app goes to the background, at most once a day, and only when
 * the data has actually changed since the last one. A failure is remembered and retried, and the
 * status shown in More is the truth rather than an assumption.
 */
export default function useCloudBackup({ user, data, loaded, replaceAll }) {
  const [status, setStatus] = useState({ at: null, failed: false, message: null, pending: false });
  const [busy, setBusy] = useState(false);

  const latest = useRef({ data, user });
  latest.current = { data, user };
  const meta = useRef({ at: null, ms: 0, fingerprint: null, failedAt: 0 });
  const running = useRef(false);

  // Remember what was backed up, so we can tell whether anything changed
  useEffect(() => {
    AsyncStorage.getItem(CLOUD_META_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        meta.current = { at: saved.at || null, ms: saved.ms || 0, fingerprint: saved.fingerprint || null, failedAt: 0 };
        setStatus((s) => ({ ...s, at: saved.at || null }));
      })
      .catch(() => {});
  }, []);

  const remember = useCallback(async (fingerprint) => {
    const at = new Date().toISOString();
    meta.current = { at, ms: now(), fingerprint, failedAt: 0 };
    setStatus({ at, failed: false, message: null, pending: false });
    try {
      await AsyncStorage.setItem(CLOUD_META_KEY, JSON.stringify(meta.current));
    } catch (e) {
      // Losing this only means one extra backup next time
    }
  }, []);

  // The single path every backup goes through, so the status is always accurate
  const runBackup = useCallback(
    async ({ silent }) => {
      const { user: u, data: d } = latest.current;
      if (!u) return { error: 'Sign in to use cloud backup.' };
      if (running.current) return { skipped: true };
      running.current = true;
      if (!silent) setBusy(true);
      try {
        const fingerprint = fingerprintOf(d);
        const result = await backupToCloud(u.uid, d);
        if (result.ok) {
          await remember(fingerprint);
          return result;
        }
        meta.current.failedAt = now();
        setStatus((s) => ({ ...s, failed: true, message: result.error, pending: false }));
        return result;
      } finally {
        running.current = false;
        if (!silent) setBusy(false);
      }
    },
    [remember]
  );

  const backupNow = useCallback(() => runBackup({ silent: false }), [runBackup]);

  const hasChanges = useCallback(() => fingerprintOf(latest.current.data) !== meta.current.fingerprint, []);

  // Due when something changed, and either a day has passed or a failed attempt is ready to retry
  const isDue = useCallback(() => {
    const { data: d } = latest.current;
    if (isEmpty(d) || !hasChanges()) return false;
    if (meta.current.failedAt) return now() - meta.current.failedAt > RETRY_MS;
    return now() - meta.current.ms > DAY_MS;
  }, [hasChanges]);

  const restore = useCallback(
    async (versionId) => {
      const { user: u } = latest.current;
      if (!u) return { error: 'Sign in to restore a cloud backup.' };
      setBusy(true);
      try {
        const result = versionId ? await readCloudVersion(u.uid, versionId) : await readCloudBackup(u.uid);
        if (result.data) replaceAll(result.data);
        return result;
      } finally {
        setBusy(false);
      }
    },
    [replaceAll]
  );

  const peek = useCallback(async () => {
    const { user: u } = latest.current;
    if (!u) return { error: 'Sign in first.' };
    return readCloudBackup(u.uid);
  }, []);

  const versions = useCallback(async () => {
    const { user: u } = latest.current;
    if (!u) return { error: 'Sign in first.' };
    return listCloudVersions(u.uid);
  }, []);

  const removeCloudCopy = useCallback(async () => {
    const { user: u } = latest.current;
    if (!u) return { ok: true };
    const result = await deleteCloudBackup(u.uid);
    if (result.ok) {
      meta.current = { at: null, ms: 0, fingerprint: null, failedAt: 0 };
      setStatus({ at: null, failed: false, message: null, pending: false });
      await AsyncStorage.removeItem(CLOUD_META_KEY).catch(() => {});
    }
    return result;
  }, []);

  // Back up when leaving the app, and retry a failure when coming back
  useEffect(() => {
    if (!user || !loaded) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (!isDue()) return;
      if (state === 'active' && !meta.current.failedAt) return;
      setStatus((s) => ({ ...s, pending: true }));
      runBackup({ silent: true });
    });
    return () => sub.remove();
  }, [user, loaded, isDue, runBackup]);

  return {
    lastBackup: status.at,
    failed: status.failed,
    failMessage: status.message,
    waiting: status.pending,
    changesPending: !!user && !isEmpty(data) && hasChanges(),
    busy,
    backupNow,
    restore,
    peek,
    versions,
    removeCloudCopy,
  };
}
