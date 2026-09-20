import { addMonthsDate, daysBetween, monthKey, monthlyDates, monthsBetween, todayStr } from '../utils/dates';
import { uid } from '../utils/format';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
// kind decides the calculation; type is the label the user picked.
export const DEBT_TYPES = [
  { type: 'Home loan', kind: 'loan', icon: 'House' },
  { type: 'Vehicle loan', kind: 'loan', icon: 'Car' },
  { type: 'Personal loan', kind: 'loan', icon: 'Wallet' },
  { type: 'Education loan', kind: 'loan', icon: 'GraduationCap' },
  { type: 'Gold loan', kind: 'gold', icon: 'Gem' },
  { type: 'Credit card', kind: 'card', icon: 'CreditCard' },
  { type: 'No-cost EMI / pay later', kind: 'paylater', icon: 'ShoppingBag' },
  { type: 'Loan against property', kind: 'loan', icon: 'Building' },
  { type: 'Other bank loan', kind: 'loan', icon: 'Landmark' },
  { type: 'Hand loan (I borrowed)', kind: 'hand', icon: 'HandCoins' },
  { type: 'Money I lent', kind: 'lent', icon: 'HandHeart' },
  { type: 'Chit fund', kind: 'chit', icon: 'Users' },
];

export const kindOf = (type) => DEBT_TYPES.find((t) => t.type === type)?.kind || 'loan';

// Kinds with a monthly schedule that can be confirmed / auto-recorded
const SCHEDULED = new Set(['loan', 'paylater', 'chit']);
export const hasSchedule = (d) => SCHEDULED.has(d.kind) || (d.kind === 'gold' && d.goldStyle !== 'interestEnd');

export const RECORD_MODES = [
  ['ask', 'Ask me'],
  ['auto', 'Add automatically'],
  ['none', 'Don’t add'],
];

const round = (n) => Math.round(n);
const clamp01 = (n) => Math.max(0, Math.min(1, n));

// ------------------------------------------------------------------
// EMI
// ------------------------------------------------------------------
export function emiFor(principal, annualRate, months) {
  const P = Number(principal) || 0;
  const n = Math.max(1, Math.round(Number(months) || 0));
  const r = (Number(annualRate) || 0) / 1200;
  if (P <= 0) return 0;
  if (r === 0) return P / n;
  const f = Math.pow(1 + r, n);
  return (P * r * f) / (f - 1);
}

// Status of a scheduled payment: 'paid' | 'missed' | 'pending'
const statusOf = (debt, ev) => {
  if (ev.date < debt.createdOn) return 'paid'; // history before the debt was added is assumed paid
  if (debt.recordMode !== 'ask') return 'paid';
  return debt.statuses?.[ev.key] || 'pending';
};

const rateAt = (debt, date) => {
  let rate = Number(debt.rate) || 0;
  (debt.rateChanges || [])
    .filter((c) => c.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((c) => {
      rate = Number(c.rate);
    });
  return rate;
};

// ------------------------------------------------------------------
// Bank loans (reducing balance)
// ------------------------------------------------------------------
function simulateLoan(loan, today) {
  const principal = Number(loan.principal) || 0;
  const tenure = Math.max(1, Number(loan.tenureMonths) || 1);
  const first = loan.firstEmiDate;
  const start = loan.startDate || addMonthsDate(first, -1);
  let emi = Number(loan.emi) || emiFor(principal, loan.rate, tenure);

  let balance = principal;
  let interestPaid = 0;
  let paidCount = 0;
  const pending = [];
  const missed = [];

  // Education loan: study-period interest added to the loan (simple interest)
  if (loan.type === 'Education loan' && loan.studyInterest === 'add') {
    const months = Math.max(0, monthsBetween(start, first < today ? first : today));
    balance += principal * (rateAt(loan, start) / 1200) * months;
  }

  const extras = [
    ...(loan.prepayments || []).map((p) => ({ date: p.date, t: 'prepay', amount: Number(p.amount) || 0 })),
    ...(loan.overrides || []).map((o) => ({ date: o.date, t: 'override', value: Number(o.value) || 0 })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  let xi = 0;

  const applyExtrasUpTo = (date, eventIndex) => {
    while (xi < extras.length && extras[xi].date <= date) {
      const x = extras[xi];
      if (x.t === 'prepay') {
        balance = Math.max(0, balance - x.amount);
        if (loan.prepayMode === 'emi') {
          const left = Math.max(1, tenure - eventIndex);
          emi = emiFor(balance, rateAt(loan, x.date), left);
        }
      } else {
        balance = x.value;
      }
      xi += 1;
    }
  };

  const events = monthlyDates(first, today, 1200);
  let lastIndex = -1;
  for (const ev of events) {
    applyExtrasUpTo(ev.date, ev.index);
    if (balance <= 0.5) break;
    const r = rateAt(loan, ev.date) / 1200;
    const interest = balance * r;
    const amount = Math.min(emi, balance + interest);
    const status = statusOf(loan, ev);
    if (status === 'paid') {
      balance = balance + interest - amount;
      interestPaid += interest;
      paidCount += 1;
    } else {
      balance += interest;
      (status === 'missed' ? missed : pending).push({ ...ev, amount: round(amount), label: 'EMI' });
    }
    lastIndex = ev.index;
  }
  applyExtrasUpTo(today, lastIndex + 1);
  balance = Math.max(0, balance);

  // Project the remaining schedule
  let proj = balance;
  let interestRemaining = 0;
  let payoffDate = null;
  let nextDue = null;
  let neverEnds = false;
  if (proj > 0.5) {
    const startIndex = lastIndex + 1;
    for (let i = 0; i < 1200; i++) {
      const date = addMonthsDate(first, startIndex + i);
      if (date <= today) continue;
      const r = rateAt(loan, date) / 1200;
      const interest = proj * r;
      if (i === 0 && emi <= interest) {
        neverEnds = true;
        break;
      }
      const amount = Math.min(emi, proj + interest);
      if (!nextDue) nextDue = { date, amount: round(amount), label: 'EMI' };
      proj = proj + interest - amount;
      interestRemaining += interest;
      if (proj <= 0.5) {
        payoffDate = date;
        break;
      }
    }
  }

  // Education loan before EMIs start with study-period interest paid monthly
  if (loan.type === 'Education loan' && loan.studyInterest === 'monthly' && today < first) {
    const monthlyInterest = principal * (rateAt(loan, today) / 1200);
    let nextInterest = addMonthsDate(start, 1);
    for (let i = 1; nextInterest <= today && i < 600; i++) nextInterest = addMonthsDate(start, i + 1);
    nextDue = { date: nextInterest < first ? nextInterest : first, amount: round(nextInterest < first ? monthlyInterest : emi), label: nextInterest < first ? 'Study-period interest' : 'EMI' };
    return {
      owed: round(balance), asset: 0, monthlyOutgo: round(monthlyInterest), emi: round(emi), paidCount: 0,
      interestPaid: 0, interestRemaining: round(interestRemaining), payoffDate, neverEnds, nextDue, pending, missed,
      progress: 0, settled: false, annualRate: rateAt(loan, today), studyPeriod: true,
    };
  }

  const settled = balance <= 0.5;
  return {
    owed: round(balance),
    asset: 0,
    monthlyOutgo: settled ? 0 : round(emi),
    emi: round(emi),
    paidCount,
    interestPaid: round(interestPaid),
    interestRemaining: round(interestRemaining),
    payoffDate,
    neverEnds,
    nextDue: settled ? null : nextDue,
    pending,
    missed,
    progress: principal > 0 ? clamp01((principal - balance) / principal) : 0,
    settled,
    annualRate: rateAt(loan, today),
  };
}

// ------------------------------------------------------------------
// Gold loan
// ------------------------------------------------------------------
function simulateGold(g, today) {
  const principal = Number(g.principal) || 0;
  const rate = rateAt(g, today);
  if (g.goldStyle === 'emi') {
    const tenure = Math.max(1, monthsBetween(g.startDate, g.maturityDate));
    return simulateLoan(
      { ...g, tenureMonths: tenure, firstEmiDate: addMonthsDate(g.startDate, 1), emi: g.emi || emiFor(principal, g.rate, tenure) },
      today
    );
  }
  const maturity = g.maturityDate;
  const overdue = maturity < today;
  if (g.goldStyle === 'interestEnd') {
    const end = today < maturity ? today : maturity;
    const days = Math.max(0, daysBetween(g.startDate, end));
    const accrued = principal * (rate / 100) * (days / 365);
    const atMaturity = principal * (1 + (rate / 100) * (Math.max(0, daysBetween(g.startDate, maturity)) / 365));
    return {
      owed: round(principal + accrued),
      asset: 0,
      monthlyOutgo: 0,
      interestPaid: 0,
      accruedInterest: round(accrued),
      nextDue: { date: maturity, amount: round(atMaturity), label: 'Principal and interest due' },
      pending: [],
      missed: [],
      progress: 0,
      settled: false,
      overdue,
      annualRate: rate,
    };
  }
  // Interest paid monthly, principal at maturity
  const monthlyInterest = principal * (rate / 1200);
  const firstInterest = addMonthsDate(g.startDate, 1);
  const lastInterestDay = today < maturity ? today : maturity;
  const events = monthlyDates(firstInterest, lastInterestDay, 600);
  const pending = [];
  const missed = [];
  let unpaid = 0;
  let paidCount = 0;
  events.forEach((ev) => {
    const status = statusOf(g, ev);
    if (status === 'paid') paidCount += 1;
    else {
      unpaid += monthlyInterest;
      (status === 'missed' ? missed : pending).push({ ...ev, amount: round(monthlyInterest), label: 'Interest' });
    }
  });
  const nextInterest = addMonthsDate(firstInterest, events.length);
  const nextDue =
    nextInterest <= maturity
      ? { date: nextInterest, amount: round(monthlyInterest), label: 'Interest' }
      : { date: maturity, amount: round(principal), label: 'Principal due' };
  return {
    owed: round(principal + unpaid),
    asset: 0,
    monthlyOutgo: overdue ? 0 : round(monthlyInterest),
    emi: round(monthlyInterest),
    paidCount,
    interestPaid: round(paidCount * monthlyInterest),
    nextDue,
    pending,
    missed,
    progress: 0,
    settled: false,
    overdue,
    annualRate: rate,
  };
}

// ------------------------------------------------------------------
// Credit card
// ------------------------------------------------------------------
function simulateCard(c, today) {
  const bill = Number(c.billAmount) || 0;
  const paid = (c.payments || []).filter((p) => !c.billDate || p.date >= c.billDate).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const unpaid = Math.max(0, bill - paid);
  const overdue = !!c.billDueDate && c.billDueDate < today && unpaid > 0;
  const daysLate = overdue ? daysBetween(c.billDueDate, today) : 0;
  const estInterest = overdue ? unpaid * ((Number(c.rate) || 0) / 100) * (daysLate / 365) : 0;
  return {
    owed: round(unpaid + estInterest),
    asset: 0,
    monthlyOutgo: 0,
    billPaid: round(Math.min(paid, bill)),
    estInterest: round(estInterest),
    nextDue: unpaid > 0 && c.billDueDate ? { date: c.billDueDate, amount: round(unpaid), label: 'Card bill' } : null,
    pending: [],
    missed: [],
    progress: bill > 0 ? clamp01(paid / bill) : 0,
    settled: unpaid <= 0,
    overdue,
    annualRate: Number(c.rate) || 0,
  };
}

// ------------------------------------------------------------------
// No-cost EMI / pay later
// ------------------------------------------------------------------
function simulatePayLater(p, today) {
  const amount = Number(p.instalment) || 0;
  const total = Math.max(1, Number(p.instalments) || 1);
  const events = monthlyDates(p.firstDate, today, total);
  const pending = [];
  const missed = [];
  let paidCount = 0;
  events.forEach((ev) => {
    const status = statusOf(p, ev);
    if (status === 'paid') paidCount += 1;
    else (status === 'missed' ? missed : pending).push({ ...ev, amount: round(amount), label: 'Instalment' });
  });
  const left = total - paidCount;
  const nextDate = events.length < total ? addMonthsDate(p.firstDate, events.length) : null;
  return {
    owed: round(left * amount),
    asset: 0,
    monthlyOutgo: left > 0 ? round(amount) : 0,
    emi: round(amount),
    paidCount,
    left,
    total,
    nextDue: nextDate ? { date: nextDate, amount: round(amount), label: 'Instalment' } : null,
    pending,
    missed,
    progress: clamp01(paidCount / total),
    settled: left <= 0,
    annualRate: 0,
  };
}

// ------------------------------------------------------------------
// Hand loans and money lent: simple interest on unpaid principal,
// each repayment clears interest due first, then principal
// ------------------------------------------------------------------
const DAYS_PER_MONTH = 30.4375;

function simulateSimple(h, today) {
  let p = Number(h.principal) || 0;
  const rate = Number(h.ratePerMonth) || 0;
  let interestDue = 0;
  let last = h.startDate;
  let repaid = 0;
  const repayments = (h.payments || []).filter((x) => x.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  repayments.forEach((rp) => {
    interestDue += p * (rate / 100) * (Math.max(0, daysBetween(last, rp.date)) / DAYS_PER_MONTH);
    last = rp.date > last ? rp.date : last;
    const pay = Number(rp.amount) || 0;
    repaid += pay;
    const toInterest = Math.min(pay, interestDue);
    interestDue -= toInterest;
    p = Math.max(0, p - (pay - toInterest));
  });
  interestDue += p * (rate / 100) * (Math.max(0, daysBetween(last, today)) / DAYS_PER_MONTH);
  const owedTotal = p + interestDue;
  const principal0 = Number(h.principal) || 0;
  const overdue = !!h.promisedDate && h.promisedDate < today && owedTotal > 0.5;
  const out = {
    principalLeft: round(p),
    interestDue: round(interestDue),
    repaid: round(repaid),
    nextDue: owedTotal > 0.5 && h.promisedDate ? { date: h.promisedDate, amount: round(owedTotal), label: h.kind === 'lent' ? 'Expected back' : 'Promised repayment' } : null,
    pending: [],
    missed: [],
    progress: principal0 > 0 ? clamp01((principal0 - p) / principal0) : 0,
    settled: owedTotal <= 0.5,
    overdue,
    monthlyOutgo: 0,
    annualRate: rate * 12,
  };
  if (h.kind === 'lent') return { ...out, owed: 0, asset: round(owedTotal), owedToYou: round(owedTotal) };
  return { ...out, owed: round(owedTotal), asset: 0 };
}

// ------------------------------------------------------------------
// Chit fund
// ------------------------------------------------------------------
function simulateChit(c, today) {
  const amount = Number(c.instalment) || 0;
  const months = Math.max(1, Number(c.months) || 1);
  const events = monthlyDates(c.firstDate, today, months);
  const pending = [];
  const missed = [];
  let paidCount = 0;
  events.forEach((ev) => {
    const status = statusOf(c, ev);
    if (status === 'paid') paidCount += 1;
    else (status === 'missed' ? missed : pending).push({ ...ev, amount: round(amount), label: 'Chit instalment' });
  });
  const taken = !!c.taken && !!c.takenDate && c.takenDate <= today;
  const left = months - paidCount;
  const paidIn = paidCount * amount;
  const nextDate = events.length < months ? addMonthsDate(c.firstDate, events.length) : null;
  return {
    owed: taken ? round(left * amount) : 0,
    asset: taken ? 0 : round(paidIn),
    paidIn: round(paidIn),
    monthlyOutgo: left > 0 ? round(amount) : 0,
    emi: round(amount),
    paidCount,
    left,
    total: months,
    taken,
    nextDue: nextDate ? { date: nextDate, amount: round(amount), label: 'Chit instalment' } : null,
    pending,
    missed,
    progress: clamp01(paidCount / months),
    settled: left <= 0 && taken,
    annualRate: -1,
  };
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------
export function computeDebt(debt, today = todayStr()) {
  let r;
  switch (debt.kind) {
    case 'gold':
      r = simulateGold(debt, today);
      break;
    case 'card':
      r = simulateCard(debt, today);
      break;
    case 'paylater':
      r = simulatePayLater(debt, today);
      break;
    case 'hand':
    case 'lent':
      r = simulateSimple(debt, today);
      break;
    case 'chit':
      r = simulateChit(debt, today);
      break;
    default:
      r = simulateLoan(debt, today);
  }
  const closed = !!debt.closed;
  return {
    ...r,
    closed,
    active: !closed && !r.settled,
    // Money flowing out regularly for loan-type obligations (cards and informal loans excluded)
    burdenOutgo: closed || r.settled ? 0 : debt.kind === 'chit' ? (r.taken ? r.monthlyOutgo : 0) : r.monthlyOutgo,
  };
}

// The expense or investment entry created when a scheduled payment is recorded
export function entryForEvent(debt, ev, today = todayStr()) {
  if (debt.recordMode === 'none') return null;
  const base = { id: uid(), date: ev.date, amount: ev.amount, debtId: debt.id, debtEventKey: ev.key };
  if (debt.kind === 'chit') {
    const takenBefore = debt.taken && debt.takenDate && debt.takenDate <= ev.date;
    if (!takenBefore) {
      return { tab: 'investment', record: { ...base, action: 'invest', type: 'Chit fund', name: debt.name, note: 'Chit instalment' } };
    }
  }
  const label = ev.label === 'Interest' ? 'interest' : ev.label === 'Instalment' ? 'instalment' : ev.label === 'Chit instalment' ? 'chit instalment' : 'EMI';
  return {
    tab: 'expense',
    record: { ...base, kind: 'expense', category: 'EMI & loans', mode: 'Auto-debit', note: `${debt.name} ${label}` },
  };
}

// Payments waiting for the user to confirm (recordMode 'ask'), oldest first
export function pendingConfirmations(debts, today = todayStr()) {
  const out = [];
  (debts || []).forEach((d) => {
    if (d.closed || d.recordMode !== 'ask' || !hasSchedule(d)) return;
    computeDebt(d, today).pending.forEach((ev) => out.push({ debt: d, ev }));
  });
  return out.sort((a, b) => a.ev.date.localeCompare(b.ev.date));
}

// Records scheduled payments for 'auto' debts. Pure: returns { data, posted }.
export function applyDebtAutoPostings(data, today = todayStr()) {
  const debts = data.debts || [];
  if (!debts.length) return { data, posted: 0 };
  const newEntries = [];
  const newInvestments = [];
  let posted = 0;
  const nextDebts = debts.map((d) => {
    if (d.closed || d.recordMode !== 'auto' || !hasSchedule(d)) return d;
    const from = d.postedThrough || '';
    const scheduleStart = d.kind === 'loan' ? d.firstEmiDate : d.kind === 'gold' ? addMonthsDate(d.startDate, 1) : d.firstDate;
    const result = computeDebt(d, today);
    // Loans stop once paid off: only as many EMIs as the schedule actually needed
    const limit = d.kind === 'paylater' ? Number(d.instalments) : d.kind === 'chit' ? Number(d.months) : result.paidCount ?? 1200;
    const until = d.kind === 'gold' && d.maturityDate < today ? d.maturityDate : today;
    let last = from;
    monthlyDates(scheduleStart, until, limit).forEach((ev) => {
      if (ev.date < d.createdOn || ev.date <= from) return;
      const e = entryForEvent(d, { ...ev, amount: result.emi, label: d.kind === 'gold' && d.goldStyle !== 'emi' ? 'Interest' : d.kind === 'paylater' ? 'Instalment' : d.kind === 'chit' ? 'Chit instalment' : 'EMI' }, today);
      if (e) {
        if (e.tab === 'investment') newInvestments.push(e.record);
        else newEntries.push(e.record);
        posted += 1;
      }
      last = ev.date;
    });
    return last !== from ? { ...d, postedThrough: last } : d;
  });
  if (!posted) return { data: { ...data, debts: nextDebts }, posted: 0 };
  return {
    data: { ...data, debts: nextDebts, entries: [...data.entries, ...newEntries], investments: [...data.investments, ...newInvestments] },
    posted,
  };
}

// Net worth = what you own − what you owe
export function computeNetWorth(holdings, debts, today = todayStr(), accounts = []) {
  const investments = holdings.reduce((s, h) => s + Math.max(0, h.current), 0);
  const cash = (accounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  let lent = 0;
  let chitAssets = 0;
  let owed = 0;
  (debts || []).forEach((d) => {
    if (d.closed) return;
    const r = computeDebt(d, today);
    if (d.kind === 'lent') lent += r.asset;
    else if (d.kind === 'chit') {
      chitAssets += r.asset;
      owed += r.owed;
    } else owed += r.owed;
  });
  const assets = investments + lent + chitAssets + cash;
  return {
    assets: round(assets), liabilities: round(owed), netWorth: round(assets - owed),
    investments: round(investments), lent: round(lent), chitAssets: round(chitAssets), cash: round(cash),
  };
}

// Keeps one snapshot per month (latest value wins) for the trend
export function upsertNetWorthSnapshot(history, nw, today = todayStr()) {
  const month = monthKey(today);
  const list = (history || []).filter((s) => s.month !== month);
  list.push({ month, assets: nw.assets, liabilities: nw.liabilities });
  return list.sort((a, b) => a.month.localeCompare(b.month)).slice(-120);
}

// Average monthly income over the last 3 months that had income (for EMI burden)
export function averageIncome(byMonth, today = todayStr()) {
  const cur = monthKey(today);
  const months = Object.keys(byMonth)
    .filter((k) => k <= cur && byMonth[k].earned > 0)
    .sort()
    .slice(-3);
  if (!months.length) return 0;
  return months.reduce((s, k) => s + byMonth[k].earned, 0) / months.length;
}

// ------------------------------------------------------------------
// Payoff planner
// ------------------------------------------------------------------

// Debts where paying extra actually shortens anything
const PAYABLE = new Set(['loan', 'gold', 'paylater', 'hand']);

export const canPlanPayoff = (debt, result) =>
  !debt.closed && !result.settled && PAYABLE.has(debt.kind) && result.owed > 0 && (result.emi > 0 || debt.kind === 'hand');

/**
 * What happens to one debt if you pay `extra` more every month.
 * Keeps the instalment the same and shortens the term, which is how prepayment usually works.
 * Returns months, interest, and what the extra saves.
 */
export function payoffWithExtra(debt, extra = 0, today = todayStr()) {
  const base = computeDebt(debt, today);
  const rate = () => (base.annualRate > 0 ? base.annualRate / 1200 : 0);
  const monthly = debt.kind === 'hand' ? Math.max(extra, 0) : Math.max(base.emi, 0) + Math.max(extra, 0);

  let balance = base.owed;
  if (balance <= 0 || monthly <= 0) return { months: null, interest: 0, monthly, neverEnds: monthly <= 0 && balance > 0 };

  let interest = 0;
  const r = rate();
  for (let month = 1; month <= 1200; month++) {
    const due = balance * r;
    if (monthly <= due) return { months: null, interest: null, monthly, neverEnds: true };
    interest += due;
    balance = balance + due - monthly;
    if (balance <= 0.5) return { months: month, interest: Math.round(interest), monthly, neverEnds: false };
  }
  return { months: null, interest: null, monthly, neverEnds: true };
}

/** The current plan against paying `extra` more: months and interest saved. */
export function payoffComparison(debt, extra, today = todayStr()) {
  const now = payoffWithExtra(debt, 0, today);
  const faster = payoffWithExtra(debt, extra, today);
  const monthsSaved = now.months !== null && faster.months !== null ? now.months - faster.months : null;
  const interestSaved = now.interest !== null && faster.interest !== null ? now.interest - faster.interest : null;
  return { now, faster, monthsSaved, interestSaved };
}

/**
 * Where a spare amount each month does the most good, across every debt.
 * 'interest' clears the costliest debt first and saves the most money.
 * 'balance' clears the smallest debt first, so one is gone sooner.
 * Both keep paying the minimum on everything else.
 */
export function payoffOrder(debts, method = 'interest', today = todayStr()) {
  const list = (debts || [])
    .map((d) => ({ debt: d, result: computeDebt(d, today) }))
    .filter(({ debt, result }) => canPlanPayoff(debt, result));

  const sorted = [...list].sort((a, b) =>
    method === 'balance' ? a.result.owed - b.result.owed : b.result.annualRate - a.result.annualRate || a.result.owed - b.result.owed
  );

  return sorted.map(({ debt, result }, i) => ({
    id: debt.id,
    name: debt.name,
    type: debt.type,
    owed: result.owed,
    rate: result.annualRate,
    emi: result.emi,
    monthlyInterest: Math.round((result.owed * (result.annualRate || 0)) / 1200),
    position: i + 1,
  }));
}

/** Total interest paid across all debts under each order, using a single extra amount a month. */
export function compareMethods(debts, extra, today = todayStr()) {
  const run = (method) => {
    const order = payoffOrder(debts, method, today);
    if (!order.length) return null;
    // Only the debt at the front gets the extra; the rest keep paying their instalment
    const head = (debts || []).find((d) => d.id === order[0].id);
    const plan = payoffComparison(head, extra, today);
    return { method, first: order[0], monthsSaved: plan.monthsSaved, interestSaved: plan.interestSaved };
  };
  return { interest: run('interest'), balance: run('balance') };
}
