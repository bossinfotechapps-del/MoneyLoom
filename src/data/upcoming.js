import { addMonthsDate, currentMonth, daysInMonth, monthKey, pad, todayStr } from '../utils/dates';
import { computeDebt } from './debts';

// Amounts leaving the account, so the total answers "what do I need to have ready?"
const OUT = 'out';
const IN = 'in';

const addDays = (dateStr, n) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

// The next date a monthly repeat is due, on or after `from`
function nextRepeatDate(rule, from) {
  const day = Math.max(1, Math.min(31, Number(rule.day) || 1));
  const atMonth = (key) => `${key}-${pad(Math.min(day, daysInMonth(key)))}`;
  let key = monthKey(from);
  // Never suggest a date the rule has already posted
  const posted = rule.lastPostedMonth;
  for (let i = 0; i < 24; i++) {
    const date = atMonth(key);
    if (date >= from && (!posted || key > posted)) return date;
    key = addMonthsDate(`${key}-01`, 1).slice(0, 7);
  }
  return null;
}

/**
 * Everything due between today and `days` ahead: EMIs, gold loan interest, card bills,
 * pay-later instalments, chit instalments, promised repayments, and monthly repeats.
 * Money already recorded is not included, so nothing is counted twice.
 */
export function computeUpcoming(data, today = todayStr(), days = 30) {
  const until = addDays(today, days);
  const items = [];

  (data.debts || []).forEach((debt) => {
    if (debt.closed) return;
    const result = computeDebt(debt, today);

    // Payments the user hasn't confirmed yet are already overdue, not upcoming
    result.pending.forEach((ev) => {
      items.push({
        id: `${debt.id}-${ev.key}`,
        date: ev.date,
        title: debt.name,
        detail: `${ev.label}, waiting for you to confirm`,
        amount: ev.amount,
        direction: OUT,
        overdue: true,
      });
    });

    const due = result.nextDue;
    if (!due || due.date > until || due.date < today) return;
    items.push({
      id: `${debt.id}-next`,
      date: due.date,
      title: debt.name,
      detail: due.label,
      amount: due.amount,
      direction: debt.kind === 'lent' ? IN : OUT,
    });
  });

  (data.recurring || []).forEach((rule) => {
    if (!rule.active) return;
    const date = nextRepeatDate(rule, today);
    if (!date || date > until) return;
    const isIncome = rule.tab === 'income';
    const name = rule.tab === 'investment' ? rule.template?.name : rule.template?.note || rule.template?.category;
    items.push({
      id: `${rule.id}-next`,
      date,
      title: name || 'Monthly repeat',
      detail: rule.tab === 'investment' ? 'Investment' : isIncome ? 'Income' : rule.template?.category || 'Expense',
      amount: Number(rule.template?.amount) || 0,
      direction: isIncome ? IN : OUT,
    });
  });

  items.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);

  const out = items.filter((i) => i.direction === OUT).reduce((sum, i) => sum + i.amount, 0);
  const incoming = items.filter((i) => i.direction === IN).reduce((sum, i) => sum + i.amount, 0);
  const overdue = items.filter((i) => i.overdue).reduce((sum, i) => sum + i.amount, 0);

  return { items, out, in: incoming, overdue, until };
}

// What's left this month after the payments still to come
export function monthOutlook(data, byMonth, today = todayStr()) {
  const cur = currentMonth();
  const m = byMonth[cur] || { earned: 0, spent: 0, invested: 0 };
  const endOfMonth = `${cur}-${pad(daysInMonth(cur))}`;
  const rest = computeUpcoming(data, today, 60).items.filter((i) => i.date <= endOfMonth);
  const stillOut = rest.filter((i) => i.direction === OUT).reduce((sum, i) => sum + i.amount, 0);
  const stillIn = rest.filter((i) => i.direction === IN).reduce((sum, i) => sum + i.amount, 0);
  return {
    stillOut,
    stillIn,
    leftAfterUpcoming: m.earned + stillIn - m.spent - m.invested - stillOut,
  };
}
