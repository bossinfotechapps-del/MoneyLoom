import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Pressable, StatusBar, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import notifee, { EventType } from '@notifee/react-native';

import { C, T } from './src/theme';
import { AppLockProvider, useAppLock } from './src/security/AppLock';
import PinGate from './src/security/PinGate';
import { DataProvider, useData } from './src/data/DataContext';
import { AdsProvider } from './src/ads/AdsContext';
import { PremiumProvider } from './src/premium/PremiumContext';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import useCloudBackup from './src/auth/useCloudBackup';
import WelcomeScreen from './src/screens/WelcomeScreen';
import { readSettings } from './src/reminders/useSettings';
import { refreshScheduled } from './src/reminders/reminders';
import { makeSampleData } from './src/data/sample';
import { currentFY, currentMonth, currentWeek } from './src/utils/dates';
import TabBar from './src/components/TabBar';
import StatusToast from './src/components/StatusToast';
import AdBanner from './src/components/AdBanner';
import EntrySheet from './src/components/EntrySheet';
import BudgetSheet from './src/components/BudgetSheet';
import OverviewScreen from './src/screens/OverviewScreen';
import FYOverview from './src/screens/FYOverview';
import EntriesScreen from './src/screens/EntriesScreen';
import WealthScreen from './src/screens/WealthScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import DebtSheet from './src/components/DebtSheet';
import DebtDetailSheet from './src/components/DebtDetailSheet';
import MoreScreen from './src/screens/MoreScreen';
import { monthKey, weekStart } from './src/utils/dates';

// Keep in sync with versionName in android/app/build.gradle
const APP_VERSION = '1.0.0';

// Space so the last list item is never hidden behind the Add button
const LIST_BOTTOM_SPACE = 96;

const showToast = (msg) => ToastAndroid.show(msg, ToastAndroid.SHORT);

export default function App() {
  return (
    <SafeAreaProvider>
      <AppLockProvider>
      <AuthProvider>
        <DataProvider>
          <PremiumProvider onMessage={showToast}>
            <AdsProvider>
              <Main />
            </AdsProvider>
          </PremiumProvider>
        </DataProvider>
      </AuthProvider>
      </AppLockProvider>
    </SafeAreaProvider>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const appLock = useAppLock();
  const {
    data, loaded, saveError, autoPosted, byMonth, holdings, saveRecord, saveRecordWithRepeat, removeRecord, replaceAll, setBudgets, saveDebt,
  } = useData();
  const auth = useAuth();
  const cloud = useCloudBackup({ user: auth.user, data, loaded, replaceAll });

  const [tab, setTab] = useState('overview');
  const [month, setMonth] = useState(currentMonth());
  const [fy, setFY] = useState(currentFY());
  const [status, setStatus] = useState(null);
  const statusTimer = useRef(null);
  const [week, setWeek] = useState(currentWeek());
  const [period, setPeriod] = useState('monthly');
  const [sheet, setSheet] = useState(null); // { id, tab, record? }
  const [budgetsOpen, setBudgetsOpen] = useState(false);
  const [wealthSegment, setWealthSegment] = useState('investments');
  const [debtSheet, setDebtSheet] = useState(null); // { group } for a new debt
  const [openDebtId, setOpenDebtId] = useState(null);

  const toast = showToast;

  // A toast that can say "working", then turn into success or failure in place
  const setJobStatus = useCallback((next) => {
    clearTimeout(statusTimer.current);
    setStatus(next);
    if (next && next.kind !== 'working') {
      statusTimer.current = setTimeout(() => setStatus(null), next.kind === 'error' ? 5000 : 2800);
    }
  }, []);

  useEffect(() => () => clearTimeout(statusTimer.current), []);

  // Android back: close to Overview first, then leave the app
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab !== 'overview') {
        setTab('overview');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tab]);

  const openAdd = useCallback((kind) => {
    setSheet({ id: Date.now(), tab: kind });
  }, []);

  const openEdit = useCallback((record) => {
    setSheet({ id: Date.now(), tab: record.kind || 'investment', record });
  }, []);

  const handleSave = useCallback(
    (kind, record, isEdit, repeatMonthly) => {
      if (repeatMonthly) {
        const extra = saveRecordWithRepeat(kind, record);
        toast(extra ? `Added, plus ${extra} earlier month${extra === 1 ? '' : 's'}. Repeats monthly.` : 'Added. Repeats every month.');
        return;
      }
      saveRecord(kind, record, isEdit);
      toast(isEdit ? 'Changes saved' : 'Entry added');
    },
    [saveRecord, saveRecordWithRepeat, toast]
  );

  // Tell the user when monthly repeats were added in the background
  useEffect(() => {
    if (autoPosted?.count) toast(`${autoPosted.count} monthly repeat${autoPosted.count === 1 ? '' : 's'} added`);
  }, [autoPosted, toast]);

  // Notification wording is fixed when it is scheduled, so rewrite it whenever the app closes and
  // on start (after updates or a reinstall). Never prompts for permission here.
  const dataRef = useRef(data);
  dataRef.current = data;
  useEffect(() => {
    if (!loaded) return undefined;
    const rewrite = () => readSettings().then((st) => refreshScheduled(st, dataRef.current)).catch(() => {});
    rewrite();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') rewrite();
    });
    return () => sub.remove();
  }, [loaded]);

  // Each notification opens the screen it is about
  const handlePress = useCallback(
    (action) => {
      if (action === 'add-expense') openAdd('expense');
      else if (action === 'set-budget') setBudgetsOpen(true);
      else if (action === 'open-overview') setTab('overview');
    },
    [openAdd]
  );

  useEffect(() => {
    notifee
      .getInitialNotification()
      .then((initial) => handlePress(initial?.pressAction?.id))
      .catch(() => {});
    return notifee.onForegroundEvent(({ type, detail }) => {
      if (type !== EventType.PRESS) return;
      handlePress(detail?.pressAction?.id);
    });
  }, [handlePress]);

  // Spend per category in the period the budgets are set in, so the sheet compares like with like
  const spentThisPeriod = useMemo(() => {
    const weekly = data.budgetPeriod === 'weekly';
    const cur = weekly ? currentWeek() : currentMonth();
    const out = {};
    data.entries.forEach((e) => {
      if (e.kind !== 'expense') return;
      const k = weekly ? weekStart(e.date) : monthKey(e.date);
      if (k === cur) out[e.category] = (out[e.category] || 0) + e.amount;
    });
    return out;
  }, [data.entries, data.budgetPeriod]);

  // Average monthly income over the months that had any, used by the suggested budget
  const typicalIncome = useMemo(() => {
    const months = Object.keys(byMonth).filter((k) => byMonth[k].earned > 0).sort().slice(-3);
    if (!months.length) return 0;
    return months.reduce((sum, k) => sum + byMonth[k].earned, 0) / months.length;
  }, [byMonth]);

  const handleDelete = useCallback(
    (kind, id) => {
      removeRecord(kind === 'investment' ? 'investments' : 'entries', id);
      toast('Entry deleted');
    },
    [removeRecord, toast]
  );

  const closeSheet = useCallback(() => setSheet(null), []);

  const loadSample = useCallback(() => {
    replaceAll(makeSampleData());
    setMonth(currentMonth());
    toast('Sample data loaded');
  }, [replaceAll, toast]);

  if (!loaded || !auth.loaded || !appLock.ready) {
    return (
      <View style={[st.root, st.center]}>
        <ActivityIndicator color={C.invest} size="large" />
      </View>
    );
  }

  if (appLock.enabled && appLock.locked) return <PinGate />;

  // First launch: choose an account or carry on without one
  if (auth.needsWelcome) {
    return (
      <View style={st.root}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <WelcomeScreen />
      </View>
    );
  }

  const titles = { entries: { title: 'Expenses & income', eyebrow: 'YOUR ACTIVITY', subtitle: 'Find and review your transactions' }, wealth: { title: 'Wealth', eyebrow: 'FINANCIAL POSITION', subtitle: 'Your accounts, investments and commitments' } };

  return (
    <View style={st.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={{ height: insets.top }} />

      {saveError && (
        <View style={st.saveError}>
          <Text style={{ color: C.white, fontWeight: '600', fontSize: 13 }}>
            Your last change couldn’t be saved. Free up phone storage, then back up from Data.
          </Text>
        </View>
      )}

      {titles[tab] && (
        <View style={st.titleBar}>
          <Text style={st.titleEyebrow}>{titles[tab].eyebrow}</Text>
          <Text style={[T.h1, { fontSize: 27 }]}>{titles[tab].title}</Text>
          <Text style={[T.small, { marginTop: 2 }]}>{titles[tab].subtitle}</Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {tab === 'overview' && period === 'fy' && (
          <FYOverview
            fy={fy}
            setFY={setFY}
            period={period}
            setPeriod={setPeriod}
            onOpenMonth={(monthKeyToOpen) => {
              if (monthKeyToOpen) setMonth(monthKeyToOpen);
              setPeriod('monthly');
            }}
            bottomSpace={LIST_BOTTOM_SPACE}
          />
        )}
        {tab === 'overview' && period !== 'fy' && (
          <OverviewScreen
            period={period}
            setPeriod={setPeriod}
            month={month}
            setMonth={setMonth}
            week={week}
            setWeek={setWeek}
            onAdd={openAdd}
            onLoadSample={loadSample}
            onOpenWealth={(segment) => { if (segment) setWealthSegment(segment); setTab('wealth'); }}
            onOpenBudgets={() => setBudgetsOpen(true)}
            bottomSpace={LIST_BOTTOM_SPACE}
          />
        )}
        {tab === 'goals' && <GoalsScreen bottomSpace={LIST_BOTTOM_SPACE} onToast={toast} />}
        {tab === 'entries' && <EntriesScreen onAdd={() => openAdd('expense')} onEdit={openEdit} bottomSpace={LIST_BOTTOM_SPACE} />}
        {tab === 'wealth' && (
          <WealthScreen
            segment={wealthSegment}
            setSegment={setWealthSegment}
            onAddInvestment={() => openAdd('investment')}
            onEditInvestment={openEdit}
            onAddDebt={(group) => setDebtSheet({ group })}
            onOpenDebt={setOpenDebtId}
            onToast={toast}
            bottomSpace={LIST_BOTTOM_SPACE}
          />
        )}
        {tab === 'more' && (
          <MoreScreen
            onToast={toast}
            onStatus={setJobStatus}
            onOpenBudgets={() => setBudgetsOpen(true)}
            cloud={cloud}
            bottomSpace={32}
            appVersion={APP_VERSION}
          />
        )}

        {tab !== 'more' && tab !== 'goals' && !(tab === 'wealth' && wealthSegment === 'accounts') && (
          <Pressable
            onPress={() => {
              if (tab !== 'wealth') openAdd('expense');
              else if (wealthSegment === 'investments') openAdd('investment');
              else setDebtSheet({ group: wealthSegment === 'lent' ? 'lent' : 'owe' });
            }}
            accessibilityRole="button"
            accessibilityLabel="Add entry"
            android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
            style={({ pressed }) => [st.fab, pressed && { backgroundColor: C.investDark }]}
          >
            <Plus size={22} color={C.white} strokeWidth={2.6} />
            <Text style={st.fabText}>Add</Text>
          </Pressable>
        )}
      </View>

      <StatusToast status={status} bottomInset={insets.bottom + 56} />

      <AdBanner />
      <TabBar active={tab} onChange={setTab} bottomInset={insets.bottom} />

      {sheet && (
        <EntrySheet
          key={sheet.id}
          initial={sheet}
          investmentNames={holdings.map((h) => h.name)}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={closeSheet}
        />
      )}

      {debtSheet && (
        <DebtSheet
          initial={debtSheet}
          onClose={() => setDebtSheet(null)}
          onSave={(d) => {
            saveDebt(d);
            toast(`${d.name} added`);
          }}
        />
      )}

      {openDebtId && <DebtDetailSheet debtId={openDebtId} onClose={() => setOpenDebtId(null)} onToast={toast} />}

      {budgetsOpen && (
        <BudgetSheet
          budgets={data.budgets || {}}
          budgetPeriod={data.budgetPeriod}
          spentByCategory={spentThisPeriod}
          typicalIncome={typicalIncome}
          onSave={(b, p, fixed) => {
            setBudgets(b, p, fixed);
            setPeriod(p === 'weekly' ? 'weekly' : 'monthly');
            toast('Budgets saved');
          }}
          onClose={() => setBudgetsOpen(false)}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  center: { alignItems: 'center', justifyContent: 'center' },
  titleBar: { paddingHorizontal: 18, paddingTop: 13, paddingBottom: 11 },
  titleEyebrow: { color: C.invest, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 3 },
  saveError: { backgroundColor: C.loss, paddingHorizontal: 16, paddingVertical: 8 },
  fab: {
    position: 'absolute', right: 16, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.invest, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 18, elevation: 4, overflow: 'hidden',
  },
  fabText: { color: C.white, fontWeight: '800', fontSize: 16 },
});
