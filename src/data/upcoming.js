import { daysInMonth, monthKey, pad, todayStr } from '../utils/dates';
import { computeDebt } from './debts';
import { scheduledRepeatItems } from './paymentSchedule';

const OUT = 'out';
const IN = 'in';

const addDays = (dateStr, n) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

/**
 * Dues and expected receipts from debts and active monthly repeats.
 * The standard view keeps older debt confirmations visible. The calendar-month
 * view only includes occurrences dated in the current month (including past dues).
 * A scheduled item is not an actual income, expense or investment transaction.
 */
export function computeUpcoming(data, today = todayStr(), days = 30, options = {}) {
  const thisMonth = options.thisMonth === true;
  const key = monthKey(today);
  const start = thisMonth ? `${key}-01` : today;
  const until = thisMonth ? `${key}-${pad(daysInMonth(key))}` : addDays(today, days);
  const items = [];

  (data.debts || []).forEach((debt) => {
    if (debt.closed) return;
    const result = computeDebt(debt, today);
    [...(result.pending || []), ...(result.missed || [])].forEach((ev) => {
      if (thisMonth && (ev.date < start || ev.date > until)) return;
      items.push({
        kind: 'debt', debtId: debt.id, ev, status: result.missed?.includes(ev) ? 'missed' : 'pending',
        id: `${debt.id}-${ev.key}-unpaid`, date: ev.date, title: debt.name,
        detail: `${ev.label}, ${result.missed?.includes(ev) ? 'marked not paid' : 'awaiting confirmation'}`,
        amount: ev.amount, direction: debt.kind === 'lent' ? IN : OUT,
        budgetCategory: debt.kind === 'loan' || debt.kind === 'paylater' || debt.kind === 'gold' || debt.kind === 'hand' ? 'EMI & loans' : null,
        overdue: true,
      });
    });

    // Re-evaluate each next occurrence as the planning date advances. This keeps
    // the 60/90-day views from silently omitting later instalments for one debt.
    let due = result.nextDue;
    // Credit-card bills and informal loans can remain due after their promised
    // date; keep them visible in rolling dues and current cash-flow planning.
    if (due && due.date < today && due.date <= until && (!thisMonth || due.date >= start) &&
        !(result.pending || []).some(ev => ev.date === due.date)) {
      items.push({
        id: `${debt.id}-${due.date}-overdue`, kind: 'debt', debtId: debt.id,
        date: due.date, title: debt.name, detail: `${due.label} · ${debt.manualDueStatuses?.[due.date] || 'unpaid'}`,
        amount: due.amount, direction: debt.kind === 'lent' ? IN : OUT,
        budgetCategory: ['loan', 'paylater', 'gold', 'hand'].includes(debt.kind) ? 'EMI & loans' : null,
        status: debt.manualDueStatuses?.[due.date] || 'pending', overdue: true,
      });
      due = null;
    }
    let cursor = today;
    for (let n = 0; due && n < 18; n++) {
      if (due.date > until || due.date < today || due.date < start) break;
      items.push({
        kind: 'debt', debtId: debt.id, ev: { ...due, key: monthKey(due.date) }, status: 'upcoming',
        id: `${debt.id}-${due.date}-next`, date: due.date, title: debt.name,
        detail: due.label, amount: due.amount,
        direction: debt.kind === 'lent' ? IN : OUT,
        budgetCategory: debt.kind === 'loan' || debt.kind === 'paylater' || debt.kind === 'gold' || debt.kind === 'hand' ? 'EMI & loans' : null,
      });
      cursor = addDays(due.date, 1);
      const following = computeDebt(debt, cursor).nextDue;
      if (!following || following.date <= due.date) break;
      due = following;
    }
  });

  scheduledRepeatItems(data, today, until, true).forEach(i => {
    // The rolling 30/60/90-day list also shows historical unpaid dues, so
    // missed contributions do not vanish when the calendar moves forward.
    if (thisMonth && (i.date < start || i.date > until)) return;
    items.push({ ...i, detail: `${i.detail} · ${i.status === 'missed' ? 'Not paid' : i.status === 'partial' ? `${i.allocated} paid, rest due` : i.status === 'later' ? 'Awaiting confirmation' : 'Awaiting confirmation'}` });
  });

  // Future-dated manual records are plans until their dated occurrence is reached;
  // include them in dues even when they aren't configured as monthly repeats.
  // A linked recurring record replaces, rather than duplicates, its rule occurrence.
  (data.entries || []).forEach((entry) => {
    if ((entry.date <= today && !entry.planned) || (thisMonth && entry.date < start) || entry.date > until || (entry.date < today && !entry.planned)) return;
    if (entry.recurringId) return; // The monthly schedule already lists this occurrence.
    items.push({
      id: `entry-${entry.id}`, kind: 'planned', recordId: entry.id, recordKey: 'entries', status: entry.planStatus || 'pending', overdue: entry.date < today, date: entry.date,
      title: entry.note || entry.category || 'Scheduled entry',
      detail: entry.planStatus === 'missed' ? 'Marked not received / paid' : entry.planned && entry.date <= today ? 'Awaiting confirmation' : entry.kind === 'income' ? 'Future-dated income' : 'Future-dated expense',
      amount: Number(entry.amount) || 0,
      direction: entry.kind === 'income' ? IN : OUT,
      budgetCategory: entry.kind === 'expense' ? entry.category : null,
    });
  });
  (data.investments || []).forEach((investment) => {
    if ((investment.date <= today && !investment.planned) || (thisMonth && investment.date < start) || investment.date > until || (investment.date < today && !investment.planned)) return;
    if (investment.recurringId) return;
    // A withdrawal is expected money in, a contribution is expected money out.
    items.push({
      id: `investment-${investment.id}`, kind: 'planned', recordId: investment.id, recordKey: 'investments', status: investment.planStatus || 'pending', overdue: investment.date < today, date: investment.date,
      title: investment.name || 'Scheduled investment',
      detail: investment.planStatus === 'missed' ? 'Marked not paid / received' : investment.planned && investment.date <= today ? 'Awaiting confirmation' : investment.action === 'withdraw' ? 'Future-dated withdrawal' : 'Future-dated investment',
      amount: Number(investment.amount) || 0,
      direction: investment.action === 'withdraw' ? IN : OUT,
      budgetCategory: null,
    });
  });

  items.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
  const out = items.filter((i) => i.direction === OUT).reduce((sum, i) => sum + i.amount, 0);
  const incoming = items.filter((i) => i.direction === IN).reduce((sum, i) => sum + i.amount, 0);
  const overdue = items.filter((i) => i.overdue && i.direction === OUT).reduce((sum, i) => sum + i.amount, 0);
  return { items, out, in: incoming, overdue, until, start };
}

export function monthOutlook(data, byMonth, today = todayStr()) {
  const cur = monthKey(today);
  const m = byMonth[cur] || { earned: 0, spent: 0, invested: 0 };
  const rest = computeUpcoming(data, today, 30, { thisMonth: true });
  return {
    stillOut: rest.out,
    stillIn: rest.in,
    leftAfterUpcoming: m.earned + rest.in - m.spent - m.invested - rest.out,
  };
}
