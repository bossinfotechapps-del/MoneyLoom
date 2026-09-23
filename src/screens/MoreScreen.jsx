import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { BellRing, CloudOff, CloudUpload, Crown, Download, LogOut, Pencil, Plus, Repeat, Sparkles, Tags, Target, Trash, Upload, UserRound } from 'lucide-react-native';
import { C, T } from '../theme';
import { useData } from '../data/DataContext';
import { categoriesFor, categoryUsage, entriesToCsv, isValidBackup, parseEntriesCsv } from '../data/compute';
import { pickTextFile, saveToDownloads, shareTextFile } from '../utils/files';
import { fmtDate, todayStr } from '../utils/dates';
import { fmt } from '../utils/format';
import { usePremium } from '../premium/PremiumContext';
import { useAuth } from '../auth/AuthContext';
import { DELETE_ACCOUNT_URL, PRIVACY_POLICY_URL, SUPPORT_EMAIL, TERMS_URL } from '../auth/authConfig';
import useSettings from '../reminders/useSettings';
import {
  cancelDailyReminder, cancelMonthlyNotes, formatTime, scheduleDailyReminder, scheduleMonthlyNotes,
} from '../reminders/reminders';
import AmountDialog from '../components/AmountDialog';
import TextPromptDialog from '../components/TextPromptDialog';
import VersionPicker from '../components/VersionPicker';
import { Card, GhostButton, IconButton, PrimaryButton, ScreenHeading, SectionHeader, Tag } from '../components/ui';

const TAB_LABEL = { expense: 'Expense', income: 'Income', investment: 'Investment' };
const switchColors = (on) => ({ trackColor: { false: C.line, true: '#8BBDB9' }, thumbColor: on ? C.invest : '#F4F4F4' });

function Item({ title, body, children }) {
  return (
    <View style={s.item}>
      <Text style={T.h3}>{title}</Text>
      <Text style={[T.small, { marginTop: 2, lineHeight: 19 }]}>{body}</Text>
      <View style={{ marginTop: 10, flexDirection: 'row', gap: 10 }}>{children}</View>
    </View>
  );
}

export default function MoreScreen({ onToast, onStatus, onOpenBudgets, cloud, bottomSpace, appVersion }) {
  const { data, appendEntries, replaceAll, clearAll, updateRecurring, removeRecurring, addCategory, removeCategory } = useData();
  const premium = usePremium();
  const auth = useAuth();
  const { settings, update } = useSettings();
  const [editingRepeat, setEditingRepeat] = useState(null);
  const [newCategoryKind, setNewCategoryKind] = useState(null);
  const [versionList, setVersionList] = useState(null);
  const [busy, setBusy] = useState(null);
  const hasData = data.entries.length + data.investments.length > 0;

  const run = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Something went wrong', e?.message ? String(e.message) : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const importCsv = () =>
    run('import', async () => {
      const file = await pickTextFile('csv');
      if (!file) return;
      const { rows, skipped, hadHeader } = parseEntriesCsv(file.text);
      if (!hadHeader) {
        Alert.alert('Missing columns', 'The first row of the CSV must have column names, including date and amount.');
        return;
      }
      if (rows.length === 0) {
        Alert.alert('Nothing imported', 'No rows had a valid date and amount. Dates should be YYYY-MM-DD or DD-MM-YYYY.');
        return;
      }
      Alert.alert(
        `Import ${rows.length} entries?`,
        skipped ? `${skipped} rows will be skipped because the date or amount is missing.` : 'They will be added to your existing entries.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: () => {
              appendEntries(rows);
              onToast(`Imported ${rows.length} entries`);
            },
          },
        ]
      );
    });

  // Offers Downloads first (always works) and the share sheet second
  const saveOrShare = (key, filename, text, mimeType, label) => {
    if (busy) return;
    Alert.alert(label, 'Where would you like to put the file?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share',
          onPress: () =>
            run(key, async () => {
              onStatus({ kind: 'working', title: `${label}…`, detail: 'Preparing the file' });
              const result = await shareTextFile(filename, text, mimeType);
              if (result?.error) onStatus({ kind: 'error', title: 'Couldn’t share the file', detail: result.error });
              else if (result?.shared) onStatus({ kind: 'success', title: 'File shared', detail: filename });
              else onStatus(null);
            }),
        },
        {
          text: 'Save to Downloads',
          onPress: () =>
            run(key, async () => {
              onStatus({ kind: 'working', title: `${label}…`, detail: 'Writing the file' });
              const result = await saveToDownloads(filename, text, mimeType);
              if (result?.error) onStatus({ kind: 'error', title: 'Couldn’t save the file', detail: result.error });
              else onStatus({ kind: 'success', title: 'Saved', detail: `${filename} in ${result.where}` });
            }),
        },
    ]);
  };

  const exportEntries = () =>
    saveOrShare('csv', `moneyloom-expenses-${todayStr()}.csv`, entriesToCsv(data.entries), 'text/csv', 'Export expenses');
  const backup = () =>
    saveOrShare(
      'backup',
      `moneyloom-backup-${todayStr()}.json`,
      JSON.stringify({ app: 'MoneyLoom', version: 1, exportedOn: todayStr(), ...data }),
      'application/json',
      'Back up everything'
    );

  const restore = () =>
    run('restore', async () => {
      const file = await pickTextFile('json');
      if (!file) return;
      onStatus({ kind: 'working', title: 'Restoring…', detail: file.name || 'Reading the backup file' });
      let parsed;
      try {
        parsed = JSON.parse(file.text);
      } catch (e) {
        parsed = null;
      }
      if (!isValidBackup(parsed)) {
        onStatus({ kind: 'error', title: 'Not a MoneyLoom backup', detail: 'Choose a .json file created with Back up.' });
        return;
      }
      Alert.alert(
        'Restore this backup?',
        `${parsed.entries.length} entries and ${parsed.investments.length} investments. This replaces everything currently in the app.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: () => {
              replaceAll(parsed);
              onStatus({
                kind: 'success',
                title: 'Backup restored',
                detail: `${(parsed.entries || []).length} entries and ${(parsed.debts || []).length} debts are back`,
              });
            },
          },
        ]
      );
    });

  const deleteAll = () => {
    Alert.alert('Delete all data?', 'Every expense, income and investment will be removed from this phone. This can’t be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: () => {
          clearAll();
          onToast('All data deleted');
        },
      },
    ]);
  };

  // ---------- Account and cloud backup ----------
  const signIn = async () => {
    const result = await auth.signInWithGoogle();
    if (result?.error) Alert.alert('Sign-in didn’t finish', result.error);
    else if (result?.ok) onToast('Signed in');
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'Your entries stay on this phone. Automatic cloud backup stops until you sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        onPress: async () => {
          const result = await auth.signOut();
          if (result?.error) Alert.alert('Couldn’t sign out', result.error);
          else onToast('Signed out');
        },
      },
    ]);
  };

  const cloudBackupNow = () =>
    run('cloud-backup', async () => {
      onStatus({ kind: 'working', title: 'Backing up…', detail: 'Sending your data to your Google account' });
      const result = await cloud.backupNow();
      if (result?.error) {
        onStatus({ kind: 'error', title: 'Backup didn’t finish', detail: result.error });
        return;
      }
      onStatus({
        kind: 'success',
        title: 'Backed up',
        detail: `${data.entries.length} entries saved to your Google account${result?.historyFailed ? '. Older copies couldn’t be updated.' : ''}`,
      });
    });

  const describeBackup = (b) => {
    const counts = b.counts || {};
    return `${fmtDate(String(b.updatedAt).slice(0, 10))}: ${counts.entries || 0} entries, ${counts.investments || 0} investments, ${counts.debts || 0} debts`;
  };

  const doRestore = (versionId, label) =>
    Alert.alert('Restore this backup?', `${label}. This replaces everything on this phone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        style: 'destructive',
        onPress: async () => {
          onStatus({ kind: 'working', title: 'Restoring…', detail: 'Bringing your data back from the cloud' });
          const result = await cloud.restore(versionId);
          if (result?.error) onStatus({ kind: 'error', title: 'Restore didn’t finish', detail: result.error });
          else onStatus({ kind: 'success', title: 'Restored', detail: 'Your data is back on this phone' });
        },
      },
    ]);

  const cloudRestore = () =>
    run('cloud-restore', async () => {
      const peeked = await cloud.peek();
      if (peeked?.error) {
        Alert.alert('Couldn’t check the cloud', peeked.error);
        return;
      }
      if (peeked?.empty) {
        Alert.alert('Nothing saved yet', 'There’s no cloud backup for this Google account.');
        return;
      }
      const latestLabel = describeBackup(peeked);
      const history = await cloud.versions();
      const older = (history?.versions || []).filter((v) => v.updatedAt !== peeked.updatedAt);
      if (!older.length) {
        doRestore(null, latestLabel);
        return;
      }
      Alert.alert('Restore from cloud', `Latest backup, ${latestLabel}.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Older copy…', onPress: () => setVersionList(older) },
        { text: 'Restore latest', style: 'destructive', onPress: () => doRestore(null, latestLabel) },
      ]);
    });

  const openAccountDeletionHelp = async () => {
    const configured = DELETE_ACCOUNT_URL && !DELETE_ACCOUNT_URL.includes('YOUR-') && !DELETE_ACCOUNT_URL.includes('YOUR_');
    const target = configured ? DELETE_ACCOUNT_URL : `mailto:${SUPPORT_EMAIL}?subject=MoneyLoom%20account%20deletion`;
    try {
      await Linking.openURL(target);
    } catch (e) {
      Alert.alert('Account deletion help', `Email ${SUPPORT_EMAIL} to request account deletion.`);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'Your Google account is unlinked and the cloud backup is deleted. Entries on this phone are kept, so delete those separately if you want them gone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            const removed = await cloud.removeCloudCopy();
            if (removed?.error) {
              Alert.alert('Couldn’t delete the cloud backup', removed.error);
              return;
            }
            const result = await auth.deleteAccount();
            if (result?.error) Alert.alert('Couldn’t delete the account', result.error);
            else onToast('Account deleted');
          },
        },
      ]
    );
  };

  // ---------- Reminder ----------
  const reminderTime = formatTime(settings.reminderHour, settings.reminderMinute);

  const toggleReminder = async (on) => {
    try {
      if (!on) {
        await cancelDailyReminder();
        await update({ reminderEnabled: false });
        return;
      }
      const ok = await scheduleDailyReminder(settings.reminderHour, settings.reminderMinute, true, data);
      if (!ok) {
        Alert.alert('Notifications are off', 'Allow notifications for MoneyLoom in Android settings to get the daily reminder.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      await update({ reminderEnabled: true });
      onToast(`Reminder set for ${reminderTime} every day`);
    } catch (e) {
      Alert.alert('Couldn’t set the reminder', 'Please try again.');
    }
  };

  const toggleMonthlyNotes = async (on) => {
    try {
      if (!on) {
        await cancelMonthlyNotes();
        await update({ monthlyNotesEnabled: false });
        return;
      }
      const ok = await scheduleMonthlyNotes(true, data);
      if (!ok) {
        Alert.alert('Notifications are off', 'Allow notifications for MoneyLoom in Android settings to get these.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      await update({ monthlyNotesEnabled: true });
      onToast('Month-end note on');
    } catch (e) {
      Alert.alert('Couldn’t set that up', 'Please try again.');
    }
  };

  const pickReminderTime = () => {
    DateTimePickerAndroid.open({
      value: new Date(2000, 0, 1, settings.reminderHour, settings.reminderMinute),
      mode: 'time',
      is24Hour: false,
      onChange: async (event, date) => {
        if (event.type !== 'set' || !date) return;
        const next = await update({ reminderHour: date.getHours(), reminderMinute: date.getMinutes() });
        if (next.reminderEnabled) {
          await scheduleDailyReminder(next.reminderHour, next.reminderMinute, false, data).catch(() => {});
          onToast(`Reminder moved to ${formatTime(next.reminderHour, next.reminderMinute)}`);
        }
      },
    });
  };

  // ---------- Budgets ----------
  const budgetTotal = useMemo(() => Object.values(data.budgets || {}).reduce((sum, v) => sum + v, 0), [data.budgets]);
  const budgetCount = Object.keys(data.budgets || {}).length;

  // ---------- Categories ----------
  const customExpense = data.customCategories?.expense || [];
  const customIncome = data.customCategories?.income || [];
  const customCats = [
    ...customExpense.map((name) => ({ name, kind: 'expense' })),
    ...customIncome.map((name) => ({ name, kind: 'income' })),
  ];

  const confirmRemoveCategory = (cat) => {
    const usage = categoryUsage(data, cat.name);
    const notes = [];
    if (usage.entries) notes.push(`${usage.entries} ${usage.entries === 1 ? 'entry uses' : 'entries use'} it and keep the name`);
    if (usage.inRepeats) notes.push('a monthly repeat uses it and keeps the name');
    if (usage.budget) notes.push('its budget is removed');
    Alert.alert(
      `Remove ${cat.name}?`,
      notes.length ? `${notes.join(', ')}.` : 'It disappears from the category list.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeCategory(cat.kind, cat.name);
            onToast('Category removed');
          },
        },
      ]
    );
  };

  // ---------- Monthly repeats ----------
  const repeats = useMemo(
    () => [...(data.recurring || [])].sort((a, b) => Number(b.active) - Number(a.active) || a.day - b.day),
    [data.recurring]
  );
  const repeatName = (r) => (r.tab === 'investment' ? r.template.name : r.template.note || r.template.category);

  const confirmRemoveRepeat = (r) => {
    Alert.alert('Delete this repeat?', `${repeatName(r)} will stop being added. Entries already added stay.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeRecurring(r.id);
          onToast('Repeat deleted');
        },
      },
    ]);
  };

  const icon = (Comp, key) => (busy === key ? <ActivityIndicator size="small" color={C.invest} /> : <Comp size={16} color={C.ink} />);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomSpace, gap: 14 }}>
      <ScreenHeading title="More" subtitle="Your settings, privacy and app preferences" eyebrow="PERSONALISE MONEYLOOM" />

      {auth.user ? (
        <Card>
          <View style={s.inline}>
            <View style={s.avatar}>
              <UserRound size={22} color={C.invest} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={T.h3} numberOfLines={1}>{auth.user.name || 'Signed in'}</Text>
              <Text style={T.small} numberOfLines={1}>{auth.user.email}</Text>
            </View>
            <IconButton onPress={confirmSignOut} label="Sign out">
              <LogOut size={18} color={C.muted} />
            </IconButton>
          </View>
          <View style={s.cloudRow}>
            <CloudUpload size={17} color={C.invest} />
            <Text style={[T.small, { flex: 1, color: cloud.failed ? C.loss : C.muted, fontWeight: cloud.failed ? '700' : '400' }]}>
              {cloud.failed
                ? 'Last backup failed. Tap Back up now to try again.'
                : cloud.lastBackup
                  ? `Last cloud backup ${fmtDate(cloud.lastBackup.slice(0, 10))}${cloud.changesPending ? ' · changes since then' : ''}`
                  : 'Not backed up to the cloud yet'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <GhostButton label="Back up now" icon={icon(CloudUpload, 'cloud-backup')} onPress={cloudBackupNow} disabled={cloud.busy} style={{ flex: 1 }} />
            <GhostButton label="Restore" icon={icon(Download, 'cloud-restore')} onPress={cloudRestore} disabled={cloud.busy} style={{ flex: 1 }} />
          </View>
          <Text style={[T.small, { marginTop: 8 }]}>
            Backs up on its own once a day when you leave the app, and only when something changed. The last 5 copies are kept.
          </Text>
          {cloud.failed && cloud.failMessage ? (
            <Text style={[T.small, { marginTop: 6, color: C.loss }]}>{cloud.failMessage}</Text>
          ) : null}
        </Card>
      ) : (
        <Card>
          <View style={s.inline}>
            <CloudOff size={20} color={C.inkSoft} />
            <View style={{ flex: 1 }}>
              <Text style={T.h3}>{auth.cloudReady ? 'Using MoneyLoom without an account' : 'Cloud backup isn’t set up'}</Text>
              <Text style={[T.small, { marginTop: 2, lineHeight: 18 }]}>
                {auth.cloudReady
                  ? 'Everything works as it is. Sign in with Google if you want your data back when you change phones.'
                  : 'This build has no Firebase configuration, so sign-in is off. File backups still work.'}
              </Text>
            </View>
          </View>
          {auth.cloudReady && (
            <PrimaryButton label={auth.busy ? 'Signing in…' : 'Sign in with Google'} onPress={signIn} disabled={auth.busy} style={{ marginTop: 12 }} />
          )}
        </Card>
      )}

      <Card>
        {premium.isPremium ? (
          <View style={s.inline}>
            <Crown size={22} color={C.invest} />
            <View style={{ flex: 1 }}>
              <Text style={T.h2}>Ads removed</Text>
              <Text style={T.small}>Thank you for supporting MoneyLoom.</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={s.inline}>
              <Sparkles size={20} color={C.invest} />
              <Text style={T.h2}>Remove ads</Text>
            </View>
            <Text style={[T.small, { marginTop: 6, lineHeight: 19 }]}>
              One-time purchase for your Google account. No banners or full-screen ads, ever. Every feature stays free either way.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <PrimaryButton
                label={premium.busy ? 'Please wait…' : premium.price ? `Remove ads for ${premium.price}` : 'Remove ads'}
                onPress={premium.buy}
                disabled={premium.busy}
                style={{ flex: 1 }}
              />
              <GhostButton label="Restore" onPress={() => premium.restore(false)} disabled={premium.busy} />
            </View>
            {!premium.storeAvailable && (
              <Text style={[T.small, { marginTop: 8 }]}>
                {__DEV__ ? 'Purchases are off in development builds.' : 'Purchases work in the version installed from Google Play.'}
              </Text>
            )}
          </>
        )}
      </Card>

      <Card>
        <View style={s.inline}>
          <BellRing size={20} color={C.inkSoft} />
          <View style={{ flex: 1 }}>
            <Text style={T.h3}>Evening summary</Text>
            <Text style={T.small}>What you spent today, and what’s left of your budget</Text>
          </View>
          <Switch
            value={settings.reminderEnabled}
            onValueChange={toggleReminder}
            {...switchColors(settings.reminderEnabled)}
            accessibilityLabel="Evening summary"
          />
        </View>
        <Pressable onPress={pickReminderTime} style={s.timeRow} accessibilityRole="button" accessibilityLabel="Change reminder time">
          <Text style={T.body}>Time</Text>
          <Text style={[T.body, { fontWeight: '700', color: C.invest }]}>{reminderTime}</Text>
        </Pressable>
        <View style={[s.inline, s.timeRow]}>
          <View style={{ flex: 1 }}>
            <Text style={T.body}>Month-end note</Text>
            <Text style={T.small}>A nudge to set next month’s budget, and a summary on the 1st</Text>
          </View>
          <Switch
            value={settings.monthlyNotesEnabled}
            onValueChange={toggleMonthlyNotes}
            {...switchColors(settings.monthlyNotesEnabled)}
            accessibilityLabel="Month-end note"
          />
        </View>
      </Card>

      <Card>
        <View style={s.inline}>
          <Target size={20} color={C.inkSoft} />
          <View style={{ flex: 1 }}>
            <Text style={T.h3}>Monthly budgets</Text>
            <Text style={T.small}>
              {budgetCount ? `${budgetCount} ${budgetCount === 1 ? 'category' : 'categories'}, ${fmt(budgetTotal)} a month` : 'No budgets set yet'}
            </Text>
          </View>
          <GhostButton label={budgetCount ? 'Edit' : 'Set up'} onPress={onOpenBudgets} style={{ paddingVertical: 6 }} />
        </View>
      </Card>

      <Card style={{ paddingHorizontal: 0, paddingBottom: 6 }}>
        <View style={{ paddingHorizontal: 16 }}>
          <SectionHeader
            title="Your categories"
            subtitle={`${categoriesFor(data, 'expense').length} expense and ${categoriesFor(data, 'income').length} income categories. Add your own here or while adding an entry.`}
          />
        </View>
        {customCats.length === 0 ? (
          <View style={[s.inline, { paddingHorizontal: 16, paddingBottom: 10 }]}>
            <Tags size={18} color={C.muted} />
            <Text style={[T.small, { flex: 1 }]}>You haven’t added any of your own yet.</Text>
          </View>
        ) : (
          customCats.map((cat, i) => (
            <View key={`${cat.kind}-${cat.name}`} style={[s.repeat, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{cat.name}</Text>
                <View style={{ flexDirection: 'row', marginTop: 3 }}>
                  <Tag label={cat.kind === 'income' ? 'Income' : 'Expense'} />
                </View>
              </View>
              <IconButton onPress={() => confirmRemoveCategory(cat)} label={`Remove ${cat.name}`} size={36}>
                <Trash size={16} color={C.muted} />
              </IconButton>
            </View>
          ))
        )}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
          <GhostButton label="Expense category" icon={<Plus size={15} color={C.ink} />} onPress={() => setNewCategoryKind('expense')} style={{ flex: 1 }} />
          <GhostButton label="Income category" icon={<Plus size={15} color={C.ink} />} onPress={() => setNewCategoryKind('income')} style={{ flex: 1 }} />
        </View>
      </Card>

      <Card style={{ paddingHorizontal: 0, paddingBottom: 6 }}>
        <View style={{ paddingHorizontal: 16 }}>
          <SectionHeader
            title="Monthly repeats"
            subtitle="Confirm payments and receipts as they happen. Existing automatic repeats can be changed to Ask me."
          />
        </View>
        {repeats.length === 0 ? (
          <View style={[s.inline, { paddingHorizontal: 16, paddingBottom: 10 }]}>
            <Repeat size={18} color={C.muted} />
            <Text style={[T.small, { flex: 1 }]}>No repeats yet.</Text>
          </View>
        ) : (
          repeats.map((r, i) => (
            <View key={r.id} style={[s.repeat, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line }]}>
              <View style={{ flex: 1, minWidth: 0, opacity: r.active ? 1 : 0.55 }}>
                <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{repeatName(r)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                  <Tag label={TAB_LABEL[r.tab]} />
                  <Text style={T.small}>{`${fmt(r.template.amount)} on day ${r.day} · ${r.confirmationMode === 'auto' ? 'Auto' : 'Ask me'}${r.active ? '' : ', paused'}`}</Text>
                </View>
              </View>
              <Pressable onPress={() => updateRecurring(r.id, { confirmationMode: r.confirmationMode === 'auto' ? 'ask' : 'auto' })} style={{ paddingHorizontal: 5, paddingVertical: 8 }} accessibilityRole="button" accessibilityLabel={`Change confirmation mode for ${repeatName(r)}`}><Text style={[T.small, { color: C.invest, fontWeight: '700' }]}>{r.confirmationMode === 'auto' ? 'Ask me' : 'Auto'}</Text></Pressable>
              <IconButton onPress={() => setEditingRepeat(r)} label={`Change amount for ${repeatName(r)}`} size={36}>
                <Pencil size={16} color={C.muted} />
              </IconButton>
              <IconButton onPress={() => confirmRemoveRepeat(r)} label={`Delete repeat ${repeatName(r)}`} size={36}>
                <Trash size={16} color={C.muted} />
              </IconButton>
              <Switch
                value={!!r.active}
                onValueChange={(on) => {
                  updateRecurring(r.id, { active: on });
                  onToast(on ? 'Repeat resumed' : 'Repeat paused');
                }}
                {...switchColors(!!r.active)}
                accessibilityLabel={`${repeatName(r)} repeat on`}
              />
            </View>
          ))
        )}
      </Card>

      <View>
        <Text style={[T.h2, { marginTop: 4 }]}>Your data</Text>
        <Text style={[T.body, { color: C.muted, marginTop: 4, lineHeight: 22 }]}>
          Everything stays on this phone. Android’s own Google backup may restore it on a new phone, but that isn’t guaranteed, so save a backup file to Google Drive regularly.
        </Text>
      </View>

      <Card style={{ paddingVertical: 4 }}>
        <Item title="Back up everything" body="Every entry, investment and debt in one file. Save it to Downloads, or share it straight to Google Drive.">
          <GhostButton label="Back up" icon={icon(Download, 'backup')} onPress={backup} disabled={!hasData} />
        </Item>
        <Item title="Restore a backup" body="Choose a backup file. It replaces what’s in the app now.">
          <GhostButton label="Restore" icon={icon(Upload, 'restore')} onPress={restore} />
        </Item>
      </Card>

      <Card style={{ paddingVertical: 4 }}>
        <Item
          title="Import expenses from CSV"
          body="Columns: date, type (expense or income), category, amount, mode, note. Dates as YYYY-MM-DD or DD-MM-YYYY. Export your Excel sheet as CSV first."
        >
          <GhostButton label="Import CSV" icon={icon(Upload, 'import')} onPress={importCsv} />
        </Item>
        <Item title="Export expenses to CSV" body="Open in Excel, Google Sheets or Power BI.">
          <GhostButton label="Export CSV" icon={icon(Download, 'csv')} onPress={exportEntries} disabled={data.entries.length === 0} />
        </Item>
      </Card>

      <Card style={{ paddingVertical: 4 }}>
        <Item title="Delete all data" body="Removes every entry, investment and debt from this phone.">
          <GhostButton label="Delete all" color={C.loss} icon={<Trash size={16} color={C.loss} />} onPress={deleteAll} disabled={!hasData} />
        </Item>
      </Card>

      {versionList && (
        <VersionPicker
          versions={versionList}
          onClose={() => setVersionList(null)}
          onPick={(v) => {
            setVersionList(null);
            doRestore(v.id, describeBackup(v));
          }}
        />
      )}

      {newCategoryKind && (
        <TextPromptDialog
          title={newCategoryKind === 'income' ? 'New income category' : 'New expense category'}
          label="Category name"
          placeholder={newCategoryKind === 'income' ? 'e.g. Rent received' : 'e.g. Insurance'}
          onClose={() => setNewCategoryKind(null)}
          onSave={(name) => {
            const result = addCategory(newCategoryKind, name);
            if (!result) return { error: 'Enter a category name.' };
            onToast(result.existing ? `${result.name} already exists` : `${result.name} added`);
            return null;
          }}
        />
      )}

      {editingRepeat && (
        <AmountDialog
          title={repeatName(editingRepeat)}
          subtitle="Applies from the next time it’s added. Past entries don’t change."
          label="Monthly amount (₹)"
          initial={editingRepeat.template.amount}
          onClose={() => setEditingRepeat(null)}
          onSave={(amount) => {
            updateRecurring(editingRepeat.id, { template: { ...editingRepeat.template, amount } });
            onToast('Repeat amount updated');
          }}
        />
      )}

      {auth.user && (
        <Card style={{ paddingVertical: 12 }}>
          <Text style={T.h3}>Delete your account</Text>
          <Text style={[T.small, { marginTop: 2, lineHeight: 18 }]}>
            Deletes your MoneyLoom cloud backup and backup history, then unlinks your Google sign-in. Entries stored only on this phone are kept unless you delete them separately.
          </Text>
          <View style={{ marginTop: 12, gap: 8 }}>
            <GhostButton label="Delete account" color={C.loss} icon={<Trash size={16} color={C.loss} />} onPress={confirmDeleteAccount} />
            <Text style={s.footerLink} onPress={openAccountDeletionHelp}>Account deletion help</Text>
          </View>
        </Card>
      )}

      <View style={{ alignItems: 'center', gap: 8, marginTop: 4 }}>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Text style={s.footerLink} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>Privacy policy</Text>
          <Text style={s.footerLink} onPress={() => Linking.openURL(TERMS_URL)}>Terms of use</Text>
          <Text style={s.footerLink} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=MoneyLoom ${appVersion}`)}>Contact</Text>
        </View>
        <Text style={T.small}>MoneyLoom {appVersion} by Boss Infotech</Text>
        <Text style={[T.small, { textAlign: 'center', maxWidth: 300 }]}>
          MoneyLoom records the numbers you enter. It doesn’t give investment, tax or financial advice.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E1F0ED', alignItems: 'center', justifyContent: 'center' },
  cloudRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  footerLink: { fontSize: 13, color: C.invest, fontWeight: '700' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  repeat: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 16, paddingRight: 10, paddingVertical: 8 },
  item: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineSoft },
});
