import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { errorCodes, isErrorWithCode, keepLocalCopy, pick, types } from '@react-native-documents/picker';

const cachePath = (filename) => `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;

/**
 * Saves a text file into the phone's Downloads folder.
 * Android 10+ uses MediaStore, which needs no storage permission; older versions write directly.
 * Returns { saved: true, where } or { error }.
 */
export async function saveToDownloads(filename, text, mimeType) {
  const temp = cachePath(filename);
  try {
    await ReactNativeBlobUtil.fs.writeFile(temp, text, 'utf8');
  } catch (e) {
    return { error: 'Couldn’t write the file. Check that your phone has free storage.' };
  }

  // Android 10+ uses MediaStore; only genuinely older versions take the direct-write path
  const apiLevel = Number(Platform.Version) || 0;
  const legacyAndroid = Platform.OS === 'android' && apiLevel > 0 && apiLevel < 29;
  try {
    if (legacyAndroid) {
      const target = `${ReactNativeBlobUtil.fs.dirs.LegacyDownloadDir}/${filename}`;
      await ReactNativeBlobUtil.fs.cp(temp, target);
    } else {
      await ReactNativeBlobUtil.MediaCollection.copyToMediaStore({ name: filename, parentFolder: '', mimeType }, 'Download', temp);
    }
    return { saved: true, where: `Downloads/${filename}` };
  } catch (e) {
    return { error: 'Couldn’t save to Downloads. Use Share instead to send the file somewhere.' };
  } finally {
    ReactNativeBlobUtil.fs.unlink(temp).catch(() => {});
  }
}

/**
 * Opens Android's share sheet so the file can go to Drive, Gmail, WhatsApp and so on.
 * Returns { shared: true }, { cancelled: true } or { error }.
 */
export async function shareTextFile(filename, text, mimeType) {
  const path = cachePath(filename);
  try {
    await ReactNativeBlobUtil.fs.writeFile(path, text, 'utf8');
  } catch (e) {
    return { error: 'Couldn’t write the file. Check that your phone has free storage.' };
  }
  try {
    const result = await Share.open({ url: `file://${path}`, type: mimeType, filename, failOnCancel: false });
    // failOnCancel: false resolves with dismissedAction when the sheet is closed
    if (result?.dismissedAction) return { cancelled: true };
    return { shared: true };
  } catch (e) {
    const message = String(e?.message || '');
    if (/No Activity found|no app|not supported/i.test(message)) {
      return { error: 'No app on this phone can receive the file. Save it to Downloads instead.' };
    }
    return { error: 'Sharing didn’t finish. Save the file to Downloads instead.' };
  }
}

/** Lets the user pick a file and returns its text, or null if they cancelled. */
export async function pickTextFile(kind) {
  const allowed = kind === 'json' ? [types.json, types.plainText, types.allFiles] : [types.csv, types.plainText, types.allFiles];
  try {
    const [file] = await pick({ type: allowed, allowMultiSelection: false });
    if (!file) return null;
    const [copy] = await keepLocalCopy({
      files: [{ uri: file.uri, fileName: file.name ?? `import-${Date.now()}` }],
      destination: 'cachesDirectory',
    });
    if (copy.status !== 'success') throw new Error(copy.copyError || 'Could not copy the file');
    const localPath = decodeURIComponent(copy.localUri.replace('file://', ''));
    const text = await ReactNativeBlobUtil.fs.readFile(localPath, 'utf8');
    ReactNativeBlobUtil.fs.unlink(localPath).catch(() => {});
    return { name: file.name, text };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return null;
    throw e;
  }
}
