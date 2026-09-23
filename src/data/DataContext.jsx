import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_DATA, STORAGE_KEY } from './constants';
import { applyRecurring, categoriesFor, computeByMonth, computeByWeek, computeHoldings, monthsWithData, normalizeData, templateFrom } from './compute';
import { applyDebtAutoPostings, computeDebt, computeNetWorth, entryForEvent, upsertNetWorthSnapshot } from './debts';
import { addMonths, currentMonth, monthKey, todayStr } from '../utils/dates';
import { addRepeatPayment, markRepeatStatus } from './paymentSchedule';
import { uid } from '../utils/format';

const DataContext = createContext(null);

// Everything that happens automatically when the app opens or comes back:
// monthly repeats, auto-recorded debt payments and this month's net worth snapshot
function runAutomations(input) {
  const rec = applyRecurring(input);
  const debt = applyDebtAutoPostings(rec.data);
  const d = debt.data;
  const nw = computeNetWorth(computeHoldings(d.investments, d.values), d.debts, undefined, d.accounts);
  const netWorthHistory = d.debts.length || d.investments.length ? upsertNetWorthSnapshot(d.netWorthHistory, nw) : d.netWorthHistory;
  return { data: { ...d, netWorthHistory }, posted: rec.posted + debt.posted };
}

export function DataProvider({ children }) {
  const [data, setData] = useState(EMPTY_DATA);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // { count, at } whenever monthly repeats add entries automatically
  const [autoPosted, setAutoPosted] = useState(null);

  const latest = useRef(data);
  const dirty = useRef(false);
  const timer = useRef(null);
  const skipFirstSave = useRef(true);
  const writeQueue = useRef(Promise.resolve());

  // Load once on start, then post any monthly repeats that became due
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let initial = EMPTY_DATA;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) initial = normalizeData(JSON.parse(raw));
      } catch (e) {
        // First launch or unreadable data: start empty
      }
      if (cancelled) return;
      const result = runAutomations(initial);
      setData(result.data);
      setLoaded(true);
      dirty.current = true;
      if (result.posted) {
        // Save straight away so repeats are never posted twice
        dirty.current = true;
        setAutoPosted({ count: result.posted, at: Date.now() });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(() => {
    if (!dirty.current) return writeQueue.current;
    const snapshot = JSON.stringify(latest.current);
    dirty.current = false;
    writeQueue.current = writeQueue.current.catch(() => {}).then(async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, snapshot);
        if (JSON.stringify(latest.current) === snapshot && !dirty.current) setSaveError(false);
      } catch (e) {
        dirty.current = true;
        setSaveError(true);
      }
    });
    return writeQueue.current;
  }, []);

  // Debounced save after every change
  useEffect(() => {
    latest.current = data;
    if (!loaded) return;
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      if (!dirty.current) return;
    }
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(persist, 400);
  }, [data, loaded, persist]);

  // Save when leaving the app; check repeats again when coming back (e.g. the next morning)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        clearTimeout(timer.current);
        persist();
        return;
      }
      if (!loaded) return;
      const result = runAutomations(latest.current);
      setData(result.data);
      if (result.posted) setAutoPosted({ count: result.posted, at: Date.now() });
    });
    return () => {
      sub.remove();
      clearTimeout(timer.current);
    };
  }, [persist, loaded]);

  const saveRecord = useCallback((tab, record, isEdit) => {
    const key = tab === 'investment' ? 'investments' : 'entries';
    setData((d) => ({
      ...d,
      [key]: isEdit ? d[key].map((x) => (x.id === record.id ? { ...record, planned: record.date > todayStr() ? true : record.planned === true ? true : false } : x)) : [...d[key], { ...record, planned: record.date > todayStr() }],
    }));
  }, []);

  // Saves a new entry and starts repeating it every month from its date.
  // Returns how many extra past months were added (when the date is in an earlier month).
  const saveRecordWithRepeat = useCallback((tab, record) => {
    const key = tab === 'investment' ? 'investments' : 'entries';
    const rule = {
      id: uid(),
      tab,
      template: templateFrom(tab, record),
      day: Number(record.date.slice(8, 10)),
      startMonth: monthKey(record.date),
      lastPostedMonth: record.date > todayStr() ? addMonths(monthKey(record.date), -1) : monthKey(record.date),
      confirmationMode: 'ask',
      active: true,
      createdOn: todayStr(),
    };
    const linked = { ...record, recurringId: rule.id, planned: record.date > todayStr() };
    setData((d) => ({ ...d, [key]: [...d[key], linked], recurring: [...d.recurring, rule] }));
    return 0;
  }, []);

  const confirmOneOffPlan = useCallback((key, id, payment) => {
    setData(d => {
      if (key !== 'entries' && key !== 'investments') return d;
      const record = d[key].find(x => x.id === id && x.planned && !x.recurringId);
      if (!record || !Number.isFinite(Number(payment.amount)) || Number(payment.amount) <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(payment.date || '') || payment.date > todayStr()) return d;
      const amount = Number(payment.amount);
      const rest = Math.round((Number(record.amount) - amount) * 100) / 100;
      const actual = { ...record, amount, date: payment.date, planned: false, planStatus: 'paid' };
      const remaining = rest > 0 ? [{ ...record, id: uid(), amount: rest, planStatus: 'partial', note: record.note || '' }] : [];
      return { ...d, [key]: [...d[key].map(r => r.id === id ? actual : r), ...remaining] };
    });
  }, []);

  const markOneOffPlan = useCallback((key, id, status) => {
    if (status !== 'missed' && status !== 'later') return;
    setData(d => ({ ...d, [key]: d[key].map(r => r.id === id && r.planned ? { ...r, planStatus: status } : r) }));
  }, []);

  const updateRecurring = useCallback((id, patch) => {
    setData((d) => {
      const next = {
        ...d,
        recurring: d.recurring.map((r) => {
          if (r.id !== id) return r;
          const updated = { ...r, ...patch };
          // Resuming never back-fills the months it was paused: it continues from this month
          if (patch.active === true && !r.active) {
            const prevMonth = addMonths(currentMonth(), -1);
            if (!updated.lastPostedMonth || updated.lastPostedMonth < prevMonth) updated.lastPostedMonth = prevMonth;
          }
          return updated;
        }),
      };
      return patch.active ? applyRecurring(next).data : next;
    });
  }, []);

  const confirmRepeatPayment = useCallback((ruleId, month, payment, coverEarlier, existingId) => {
    setData(d => addRepeatPayment(d, ruleId, month, payment, coverEarlier, existingId));
  }, []);

  const markScheduledRepeat = useCallback((ruleId, month, status) => {
    setData(d => markRepeatStatus(d, ruleId, month, status));
  }, []);

  const removeRecurring = useCallback((id) => {
    setData((d) => ({ ...d, recurring: d.recurring.filter((r) => r.id !== id) }));
  }, []);

  // ---------- Debts ----------
  const saveDebt = useCallback((debt) => {
    setData((d) => {
      const exists = d.debts.some((x) => x.id === debt.id);
      const next = { ...d, debts: exists ? d.debts.map((x) => (x.id === debt.id ? debt : x)) : [...d.debts, debt] };
      return applyDebtAutoPostings(next).data;
    });
  }, []);

  const updateDebt = useCallback((id, fn) => {
    setData((d) => ({ ...d, debts: d.debts.map((x) => (x.id === id ? fn(x) : x)) }));
  }, []);

  const removeDebt = useCallback((id) => {
    setData((d) => ({ ...d, debts: d.debts.filter((x) => x.id !== id) }));
  }, []);

  // Actual payment amount and date are confirmed by the user, never inferred
  // from the due date. A partially paid instalment remains on the due list.
  const confirmDebtEvent = useCallback((debtId, ev, answer) => {
    setData(d => {
      const debt = d.debts.find(x => x.id === debtId);
      if (!debt || !ev || !ev.key) return d;
      const response = typeof answer === 'boolean' ? { status: answer ? 'paid' : 'missed', amount: ev.amount, date: todayStr() } : answer;
      const status = response?.status;
      if (status === 'missed' || status === 'later') {
        return { ...d, debts: d.debts.map(x => x.id === debtId ? { ...x, statuses: { ...(x.statuses || {}), [ev.key]: status } } : x) };
      }
      if (status !== 'paid') return d;
      const amount = Number(response?.amount);
      const date = response?.date;
      const alreadyPaid = Number(debt.paymentAmounts?.[ev.key]) || 0;
      if (!Number.isFinite(amount) || amount <= 0 || date > todayStr() || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return d;
      const due = Number(ev.originalAmount) || Number(ev.amount) + alreadyPaid;
      const extra = Math.max(0, alreadyPaid + amount - due);
      if (extra > 0 && !(debt.kind === 'loan' || (debt.kind === 'gold' && debt.goldStyle === 'emi'))) return d;
      const paidTotal = Math.min(due, alreadyPaid + amount);
      if (alreadyPaid >= due - 0.01) return d;
      const nextStatus = paidTotal >= due - 0.01 ? 'paid' : 'partial';
      const debts = d.debts.map(x => x.id !== debtId ? x : {
        ...x, statuses: { ...(x.statuses || {}), [ev.key]: nextStatus },
        paymentAmounts: { ...(x.paymentAmounts || {}), [ev.key]: paidTotal },
        ...(extra ? { prepayments: [...(x.prepayments || []), { id: uid(), date, amount: extra, fromScheduledPayment: ev.key }] } : {}),
      });
      // The full cash amount is saved as one record. Extra debt payment is
      // also modelled as principal reduction, not another expense entry.
      const entry = entryForEvent({ ...debt, recordMode: 'ask' }, { ...ev, amount, date });
      if (!entry) return { ...d, debts };
      const key = entry.tab === 'investment' ? 'investments' : 'entries';
      return { ...d, debts, [key]: [...d[key], entry.record] };
    });
  }, []);

  // One-off card bills and informal debt due dates use their existing payment
  // history. Card repayment is not a second expense; money lent returned is
  // not new income. Hand-loan repayments retain the existing expense behaviour.
  const confirmManualDebtDue = useCallback((debtId, answer) => {
    setData(d => {
      const debt = d.debts.find(x => x.id === debtId);
      if (!debt || !['card', 'hand', 'lent'].includes(debt.kind)) return d;
      const due = computeDebt(debt, todayStr()).nextDue;
      if (!due || due.date > todayStr()) return d;
      const status = answer?.status;
      if (status === 'missed' || status === 'later') {
        return { ...d, debts: d.debts.map(x => x.id !== debtId ? x : {
          ...x, manualDueStatuses: { ...(x.manualDueStatuses || {}), [due.date]: status },
        }) };
      }
      if (status !== 'paid') return d;
      const amount = Number(answer.amount);
      const date = answer.date;
      if (!Number.isFinite(amount) || amount <= 0 || amount > due.amount + 0.01 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || date > todayStr()) return d;
      // Avoid an accidental second confirmation of the same recorded payment.
      if ((debt.payments || []).some(p => p.manualDueKey === due.date && p.date === date && Math.abs(Number(p.amount) - amount) < 0.01)) return d;
      const payment = { id: uid(), amount, date, manualDueKey: due.date };
      const nextDebt = { ...debt,
        payments: [...(debt.payments || []), payment],
        manualDueStatuses: { ...(debt.manualDueStatuses || {}), [due.date]: amount + 0.01 >= due.amount ? 'paid' : 'partial' },
      };
      const next = { ...d, debts: d.debts.map(x => x.id === debtId ? nextDebt : x) };
      if (debt.kind !== 'hand') return next;
      const entry = { id: uid(), kind: 'expense', date, amount, category: 'EMI & loans',
        mode: 'UPI', note: `${debt.name} repayment`, debtId, manualDueKey: due.date };
      return { ...next, entries: [...d.entries, entry] };
    });
  }, []);

  // Manual payment on a hand loan (optionally added to expenses)
  const recordDebtPayment = useCallback((debtId, payment, addExpense) => {
    setData((d) => {
      const debt = d.debts.find((x) => x.id === debtId);
      if (!debt) return d;
      const debts = d.debts.map((x) => (x.id === debtId ? { ...x, payments: [...(x.payments || []), payment] } : x));
      if (!addExpense) return { ...d, debts };
      const entry = {
        id: uid(), kind: 'expense', date: payment.date, amount: payment.amount, category: 'EMI & loans',
        mode: 'UPI', note: `${debt.name} repayment`, debtId,
      };
      return { ...d, debts, entries: [...d.entries, entry] };
    });
  }, []);

  // ---------- Categories ----------
  // Returns the saved name, or null when it already exists (matched without case)
  const addCategory = useCallback((kind, rawName) => {
    const name = rawName.trim().replace(/\s+/g, ' ');
    if (!name) return null;
    let added = null;
    setData((d) => {
      const existing = categoriesFor(d, kind).find((c) => c.toLowerCase() === name.toLowerCase());
      if (existing) {
        added = null;
        return d;
      }
      added = name;
      return { ...d, customCategories: { ...d.customCategories, [kind]: [...(d.customCategories[kind] || []), name] } };
    });
    return { name, existing: !added };
  }, []);

  const removeCategory = useCallback((kind, name) => {
    setData((d) => {
      const budgets = { ...d.budgets };
      delete budgets[name];
      return {
        ...d,
        budgets,
        customCategories: { ...d.customCategories, [kind]: (d.customCategories[kind] || []).filter((c) => c !== name) },
      };
    });
  }, []);

  // period is 'monthly' or 'weekly' and applies to every budget amount
  // ---------- Bank and cash accounts ----------
  const saveAccount = useCallback((account) => {
    setData((d) => {
      const exists = (d.accounts || []).some((a) => a.id === account.id);
      return { ...d, accounts: exists ? d.accounts.map((a) => (a.id === account.id ? account : a)) : [...(d.accounts || []), account] };
    });
  }, []);

  // Typing today's balance from the banking app, keeping the last few for history
  const updateAccountBalance = useCallback((id, balance) => {
    const on = todayStr();
    setData((d) => ({
      ...d,
      accounts: (d.accounts || []).map((a) =>
        a.id === id
          ? {
              ...a,
              balance,
              updatedOn: on,
              history: [...(a.history || []).filter((h) => h.date !== on), { date: on, balance }].slice(-12),
            }
          : a
      ),
    }));
  }, []);

  const removeAccount = useCallback((id) => {
    setData((d) => ({ ...d, accounts: (d.accounts || []).filter((a) => a.id !== id) }));
  }, []);

  const setBudgets = useCallback((budgets, period, fixedMonthlyCategories) => {
    setData((d) => ({ ...d, budgets, budgetPeriod: period === 'weekly' ? 'weekly' : 'monthly',
      fixedMonthlyCategories: fixedMonthlyCategories || d.fixedMonthlyCategories || {} }));
  }, []);

  const removeRecord = useCallback((key, id) => {
    setData((d) => ({ ...d, [key]: d[key].filter((x) => x.id !== id) }));
  }, []);

  const setHoldingValue = useCallback((name, value) => {
    setData((d) => ({ ...d, values: { ...d.values, [name]: { value, date: todayStr() } } }));
  }, []);

  const appendEntries = useCallback((rows) => {
    setData((d) => ({ ...d, entries: [...d.entries, ...rows.map(r => ({ ...r, planned: r.date > todayStr() }))] }));
  }, []);

  // Manual goal balances are independent records, not additional bank assets or expenses.
  const saveGoal = useCallback((goal) => setData(d => ({ ...d,
    goals: goal.id && (d.goals || []).some(g => g.id === goal.id)
      ? (d.goals || []).map(g => g.id === goal.id ? { ...g, ...goal } : g)
      : [...(d.goals || []), { ...goal, id: goal.id || uid(), transactions: [] }],
  })), []);
  const removeGoal = useCallback(id => setData(d => ({ ...d, goals: (d.goals || []).filter(g => g.id !== id) })), []);
  const moveGoalMoney = useCallback((id, amount, note) => setData(d => ({ ...d,
    goals: (d.goals || []).map(g => {
      if (g.id !== id) return g;
      const balance = (g.transactions || []).reduce((sum, t) => sum + t.amount, 0);
      if (!Number.isFinite(amount) || !amount || balance + amount < 0) return g;
      return { ...g, transactions: [...(g.transactions || []), { id: uid(), amount, note: note || '', date: new Date().toISOString() }] };
    }),
  })), []);

  // Correct an individual pot transaction without changing bank balances or expense totals.
  const updateGoalTransaction = useCallback((goalId, transactionId, patch) => setData(d => ({ ...d,
    goals: (d.goals || []).map(g => {
      if (g.id !== goalId) return g;
      const transactions = (g.transactions || []).map(t => t.id === transactionId ? { ...t, ...patch, id: t.id } : t);
      if (transactions.reduce((sum, t) => sum + t.amount, 0) < 0) return g;
      return { ...g, transactions };
    }),
  })), []);
  const removeGoalTransaction = useCallback((goalId, transactionId) => setData(d => ({ ...d,
    goals: (d.goals || []).map(g => {
      if (g.id !== goalId) return g;
      const transactions = (g.transactions || []).filter(t => t.id !== transactionId);
      if (transactions.reduce((sum, t) => sum + t.amount, 0) < 0) return g;
      return { ...g, transactions };
    }),
  })), []);

  const replaceAll = useCallback((next) => setData(runAutomations(normalizeData(next)).data), []);
  const clearAll = useCallback(() => setData(EMPTY_DATA), []);

  const byMonth = useMemo(() => computeByMonth(data), [data]);
  const byWeek = useMemo(() => computeByWeek(data), [data]);
  const holdings = useMemo(() => computeHoldings(data.investments, data.values), [data]);
  const netWorth = useMemo(() => computeNetWorth(holdings, data.debts, undefined, data.accounts), [holdings, data.debts, data.accounts]);
  const months = useMemo(() => monthsWithData(data), [data]);

  const value = useMemo(
    () => ({
      data, loaded, saveError, autoPosted, byMonth, byWeek, holdings, months, netWorth,
      saveRecord, saveRecordWithRepeat, updateRecurring, removeRecurring, confirmRepeatPayment, markScheduledRepeat, confirmOneOffPlan, markOneOffPlan, setBudgets,
      removeRecord, setHoldingValue, appendEntries, replaceAll, clearAll,
      saveDebt, updateDebt, removeDebt, confirmDebtEvent, confirmManualDebtDue, recordDebtPayment,
      addCategory, removeCategory,
      saveAccount, updateAccountBalance, removeAccount, saveGoal, removeGoal, moveGoalMoney, updateGoalTransaction, removeGoalTransaction,
    }),
    [
      data, loaded, saveError, autoPosted, byMonth, byWeek, holdings, months, netWorth,
      saveRecord, saveRecordWithRepeat, updateRecurring, removeRecurring, confirmRepeatPayment, markScheduledRepeat, confirmOneOffPlan, markOneOffPlan, setBudgets,
      removeRecord, setHoldingValue, appendEntries, replaceAll, clearAll,
      saveDebt, updateDebt, removeDebt, confirmDebtEvent, confirmManualDebtDue, recordDebtPayment,
      addCategory, removeCategory,
      saveAccount, updateAccountBalance, removeAccount, saveGoal, removeGoal, moveGoalMoney, updateGoalTransaction, removeGoalTransaction,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
};
