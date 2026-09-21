import { getApp } from '@react-native-firebase/app';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, setDoc } from '@react-native-firebase/firestore';
import { normalizeData } from '../data/compute';

// One document per user: users/{uid}. Firestore allows just under 1 MB per document,
// so very large histories are refused here with a clear message instead of failing in the SDK.
const MAX_BYTES = 900 * 1024;

// Firestore queues writes and only settles once the server confirms, so a missing database or
// blocked rules leave the promise pending for ever. Everything here is given a deadline instead.
const TIMEOUT_MS = 20000;

class Timeout extends Error {}

const withTimeout = (work, ms = TIMEOUT_MS) =>
  Promise.race([
    work,
    new Promise((resolve, reject) => {
      setTimeout(() => reject(new Timeout('timeout')), ms);
    }),
  ]);

const timeoutMessage =
  'The cloud didn’t answer. Check you’re online, and that Firestore is created and its rules are published in the Firebase console.';

const userDoc = (uid) => doc(getFirestore(getApp()), 'users', uid);
// Older copies live under users/{uid}/versions/{id}, so a bad restore or a wipe can be undone
const versionsRef = (uid) => collection(getFirestore(getApp()), 'users', uid, 'versions');
const versionDoc = (uid, id) => doc(getFirestore(getApp()), 'users', uid, 'versions', id);

// How many past copies to keep
export const KEEP_VERSIONS = 5;

// A cheap change check: same length and same counts means nothing worth uploading
export const fingerprintOf = (data) => {
  const payload = JSON.stringify(data);
  return `${payload.length}:${data.entries.length}:${data.investments.length}:${(data.debts || []).length}`;
};

const countOf = (data) => ({
  entries: data.entries.length,
  investments: data.investments.length,
  debts: (data.debts || []).length,
});

// Turns Firestore's codes into something a person can act on
function describeFirestoreError(e) {
  if (e instanceof Timeout) return timeoutMessage;
  const code = String(e?.code || '');
  if (code.includes('permission-denied')) return 'Your account isn’t allowed to write this backup. Publish the Firestore rules in the Firebase console and try again.';
  if (code.includes('unauthenticated')) return 'You’re signed out. Sign in again and retry.';
  if (code.includes('unavailable') || code.includes('deadline')) return 'Couldn’t reach the cloud. Check your internet connection and try again.';
  if (code.includes('not-found')) return 'No Firestore database was found for this project. Create one in the Firebase console.';
  if (code.includes('resource-exhausted')) return 'The free cloud quota for today is used up. Try again tomorrow, or save a backup file instead.';
  return `Backup failed${code ? ` (${code})` : ''}. Check your internet connection and try again.`;
}

export async function backupToCloud(uid, data) {
  const payload = JSON.stringify(data);
  const bytes = payload.length;
  if (bytes > MAX_BYTES) {
    return { error: 'Your history is too large for cloud backup. Use More > Back up everything to save a file instead.' };
  }
  const updatedAt = new Date().toISOString();
  const record = { payload, version: 1, bytes, counts: countOf(data), updatedAt, fingerprint: fingerprintOf(data) };
  try {
    await withTimeout(setDoc(userDoc(uid), record));
  } catch (e) {
    return { error: describeFirestoreError(e) };
  }
  // Keeping history is a bonus: if it fails, the backup itself still succeeded
  try {
    await withTimeout(setDoc(versionDoc(uid, updatedAt.slice(0, 19).replace(/[:T]/g, '-')), record));
    await trimVersions(uid);
  } catch (e) {
    return { ok: true, bytes, historyFailed: true };
  }
  return { ok: true, bytes };
}

// Newest first
export async function listCloudVersions(uid) {
  try {
    const snap = await withTimeout(getDocs(versionsRef(uid)));
    const rows = [];
    snap.forEach((d) => {
      const v = d.data();
      rows.push({ id: d.id, updatedAt: v.updatedAt, bytes: v.bytes, counts: v.counts });
    });
    return { versions: rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) };
  } catch (e) {
    return { error: describeFirestoreError(e) };
  }
}

async function trimVersions(uid) {
  const { versions } = await listCloudVersions(uid);
  if (!versions) return;
  await Promise.all(versions.slice(KEEP_VERSIONS).map((v) => deleteDoc(versionDoc(uid, v.id)).catch(() => {})));
}

export async function readCloudVersion(uid, id) {
  try {
    const snap = await withTimeout(getDoc(versionDoc(uid, id)));
    const exists = typeof snap.exists === 'function' ? snap.exists() : snap.exists;
    if (!exists) return { empty: true };
    const raw = snap.data();
    return { data: normalizeData(JSON.parse(raw.payload)), updatedAt: raw.updatedAt, counts: raw.counts };
  } catch (e) {
    return { error: describeFirestoreError(e) };
  }
}

export async function readCloudBackup(uid) {
  try {
    const snap = await withTimeout(getDoc(userDoc(uid)));
    // exists is a method in the modular API and a property in older ones
    const exists = typeof snap.exists === 'function' ? snap.exists() : snap.exists;
    if (!exists) return { empty: true };
    const raw = snap.data();
    const parsed = JSON.parse(raw.payload);
    return { data: normalizeData(parsed), updatedAt: raw.updatedAt, counts: raw.counts };
  } catch (e) {
    return { error: describeFirestoreError(e) };
  }
}

export async function deleteCloudBackup(uid) {
  try {
    const history = await listCloudVersions(uid);
    if (history.error) return { error: history.error };

    // Do not silently ignore a failed history deletion. Account deletion should only
    // continue once every version we know about has been removed successfully.
    await Promise.all(
      (history.versions || []).map((v) => withTimeout(deleteDoc(versionDoc(uid, v.id))))
    );
    await withTimeout(deleteDoc(userDoc(uid)));
    return { ok: true };
  } catch (e) {
    return { error: describeFirestoreError(e) };
  }
}
