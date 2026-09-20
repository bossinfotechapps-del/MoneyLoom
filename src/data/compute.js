import Papa from 'papaparse';
import { addMonths, daysInMonth, monthKey, monthlyToWeekly, pad, parseFlexibleDate, todayStr, weekStart, weeklyToMonthly } from '../utils/dates';
import { EXPENSE_CATS, INCOME_CATS } from './constants';
import { toNumber, uid } from '../utils/format';

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export const normalizeData = (raw) => ({
  entries: Array.isArray(raw?.entries) ? raw.entries : [],
  investments: Array.isArray(raw?.investments) ? raw.investments : [],
  values: isObject(raw?.values) ? raw.values : {},
  recurring: Array.isArray(raw?.recurring) ? raw.recurring : [],
  budgets: isObject(raw?.budgets) ? raw.budgets : {},
  fixedMonthlyCategories: isObject(raw?.fixedMonthlyCategories) ? raw.fixedMonthlyCategories : {},
  debts: Array.isArray(raw?.debts) ? raw.debts : [],
  netWorthHistory: Array.isArray(raw?.netWorthHistory) ? raw.netWorthHistory : [],
  accounts: Array.isArray(raw?.accounts) ? raw.accounts : [],
  goals: Array.isArray(raw?.goals) ? raw.goals : [],
  customCategories: {
    expense: Array.isArray(raw?.customCategories?.expense) ? raw.customCategories.expense : [],
    income: Array.isArray(raw?.customCategories?.income) ? raw.customCategories.income : [],
  },
  budgetPeriod: raw?.budgetPeriod === 'weekly' ? 'weekly' : 'monthly',
});

// Totals per week, keyed by the week's Monday
export function computeByWeek(data) {
  const w = {};
  const get = (k) => {
    if (!w[k]) w[k] = { spent: 0, earned: 0, invested: 0 };
    return w[k];
  };
  data.entries.forEach((e) => {
    const g = get(weekStart(e.date));
    if (e.kind === 'income') g.earned += e.amount;
    else g.spent += e.amount;
  });
  data.investments.forEach((t) => {
    get(weekStart(t.date)).invested += netAmount(t);
  });
  return w;
}

// The budget for one category, converted when the view period differs from the set period
export function budgetFor(data, category, viewPeriod) {
  const amount = data.budgets?.[category] || 0;
  if (!amount) return 0;
  const setPeriod = data.budgetPeriod === 'weekly' ? 'weekly' : 'monthly';
  if (setPeriod === viewPeriod) return amount;
  return viewPeriod === 'weekly' ? monthlyToWeekly(amount) : weeklyToMonthly(amount);
}

// Built-in categories, then the user's own, then any category only found in old entries
export function categoriesFor(data, kind) {
  const builtIn = kind === 'income' ? INCOME_CATS : EXPENSE_CATS;
  const out = [...builtIn, ...(data.customCategories?.[kind] || []).filter((c) => !builtIn.includes(c))];
  const seen = new Set(out.map((c) => c.toLowerCase()));
  data.entries.forEach((e) => {
    if (e.kind !== kind || seen.has(e.category.toLowerCase())) return;
    seen.add(e.category.toLowerCase());
    out.push(e.category);
  });
  return out;
}

// Only a category the user created and isn't using anywhere can be removed cleanly
export function categoryUsage(data, name) {
  const entries = data.entries.filter((e) => e.category === name).length;
  const inRepeats = (data.recurring || []).some((r) => r.template?.category === name);
  return { entries, inRepeats, budget: !!data.budgets?.[name] };
}

// ---------------- Monthly repeats ----------------
// Rule: { id, tab: 'expense'|'income'|'investment', template, day (1-31), startMonth, lastPostedMonth, active }
// template holds the entry fields except id and date.

export const templateFrom = (tab, record) => {
  const { id, date, recurringId, ...rest } = record;
  return tab === 'investment' ? rest : { ...rest, kind: tab };
};

// Posts every monthly entry that is due up to today. Pure: returns { data, posted }.
export function applyRecurring(data, today = todayStr()) {
  const rules = data.recurring || [];
  if (!rules.length) return { data, posted: 0 };
  const cur = monthKey(today);
  const todayDay = Number(today.slice(8, 10));
  let posted = 0;
  const newEntries = [];
  const newInvestments = [];

  const nextRules = rules.map((r) => {
    if (!r.active) return r;
    let k = r.lastPostedMonth ? addMonths(r.lastPostedMonth, 1) : r.startMonth;
    let last = r.lastPostedMonth || null;
    let guard = 0;
    while (k <= cur && guard < 240) {
      guard += 1;
      const day = Math.min(r.day, daysInMonth(k));
      if (k === cur && todayDay < day) break;
      const rec = { ...r.template, id: uid(), date: `${k}-${pad(day)}`, recurringId: r.id };
      if (r.tab === 'investment') newInvestments.push(rec);
      else newEntries.push({ ...rec, kind: r.tab });
      posted += 1;
      last = k;
      k = addMonths(k, 1);
    }
    return last === (r.lastPostedMonth || null) ? r : { ...r, lastPostedMonth: last };
  });

  if (!posted) return { data, posted: 0 };
  return {
    data: {
      ...data,
      entries: [...data.entries, ...newEntries],
      investments: [...data.investments, ...newInvestments],
      recurring: nextRules,
    },
    posted,
  };
}

// ---------------- Budgets ----------------
export function budgetStatus(spent, budget) {
  if (!budget || budget <= 0) return null;
  const ratio = spent / budget;
  return { ratio, left: budget - spent, level: ratio > 1 ? 'over' : ratio >= 0.85 ? 'near' : 'ok' };
}

export const isValidBackup = (raw) => Array.isArray(raw?.entries) && Array.isArray(raw?.investments);

export const netAmount = (t) => (t.action === 'withdraw' ? -t.amount : t.amount);

// { 'YYYY-MM': { spent, earned, invested } }
export function computeByMonth(data) {
  const m = {};
  const get = (k) => {
    if (!m[k]) m[k] = { spent: 0, earned: 0, invested: 0 };
    return m[k];
  };
  data.entries.forEach((e) => {
    const g = get(monthKey(e.date));
    if (e.kind === 'income') g.earned += e.amount;
    else g.spent += e.amount;
  });
  data.investments.forEach((t) => {
    get(monthKey(t.date)).invested += netAmount(t);
  });
  return m;
}

// Holdings grouped by investment name. A saved current value is treated as correct on its date;
// contributions dated after it are added on top so gains don't look wrong between updates.
export function computeHoldings(investments, values) {
  const map = {};
  // Chit instalments are counted as invested each month, but their value lives in the chit itself (debts.js)
  investments
    .filter((t) => !t.debtId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((t) => {
      if (!map[t.name]) map[t.name] = { name: t.name, type: t.type, invested: 0, txns: [] };
      const h = map[t.name];
      h.invested += netAmount(t);
      h.type = t.type;
      h.txns.push({ date: t.date, net: netAmount(t) });
    });

  return Object.values(map)
    .map((h) => {
      const v = values[h.name];
      const current = v
        ? v.value + h.txns.filter((x) => x.date > v.date).reduce((s, x) => s + x.net, 0)
        : h.invested;
      const gain = current - h.invested;
      return {
        name: h.name,
        type: h.type,
        invested: h.invested,
        current,
        gain,
        gainPct: h.invested > 0 ? (gain / h.invested) * 100 : 0,
        valueDate: v ? v.date : null,
      };
    })
    .sort((a, b) => b.current - a.current);
}

export function monthsWithData(data) {
  const s = new Set([monthKey(todayStr())]);
  data.entries.forEach((e) => s.add(monthKey(e.date)));
  data.investments.forEach((t) => s.add(monthKey(t.date)));
  return [...s].sort().reverse();
}

export function entriesToCsv(entries) {
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ date: e.date, type: e.kind, category: e.category, amount: e.amount, mode: e.mode, note: e.note || '' }));
  return Papa.unparse(rows, { columns: ['date', 'type', 'category', 'amount', 'mode', 'note'] });
}

// Columns: date, type (expense/income), category, amount, mode, note. Header names are case-insensitive.
export function parseEntriesCsv(text) {
  const res = Papa.parse(String(text || '').replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: true });
  const rows = [];
  let skipped = 0;
  res.data.forEach((r) => {
    const get = (...keys) => {
      for (const k of Object.keys(r)) {
        if (keys.includes(k.trim().toLowerCase())) return String(r[k] ?? '').trim();
      }
      return '';
    };
    const date = parseFlexibleDate(get('date'));
    const amount = toNumber(get('amount'));
    if (!date || !amount || Number.isNaN(amount)) {
      skipped += 1;
      return;
    }
    const kind = get('type', 'kind').toLowerCase().startsWith('inc') ? 'income' : 'expense';
    rows.push({
      id: uid(),
      kind,
      date,
      category: get('category') || (kind === 'income' ? 'Other income' : 'Other'),
      amount: Math.abs(amount),
      mode: get('mode', 'payment mode', 'paid by', 'payment') || 'UPI',
      note: get('note', 'notes', 'description'),
    });
  });
  return { rows, skipped, hadHeader: res.meta?.fields?.some((f) => f.trim().toLowerCase() === 'date') };
}
