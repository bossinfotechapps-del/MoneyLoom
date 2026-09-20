import { budgetFor } from '../data/compute';
import { MONTHS_LONG, currentMonth, currentWeek, daysInMonth, isInWeek, monthKey, todayStr } from '../utils/dates';
import { fmt } from '../utils/format';

/**
 * The words that go into the notifications. Android decides a scheduled notification's text when
 * it is scheduled, not when it fires, so these are written whenever the app closes and reflect
 * the data as of that moment.
 */

// A malformed date can never throw inside a notification
const safeMonth = (date) => {
  try {
    return monthKey(date);
  } catch (e) {
    return '';
  }
};

const spentBetween = (entries, match) =>
  entries.filter((e) => e.kind === 'expense' && match(e.date)).reduce((sum, e) => sum + e.amount, 0);

const budgetTotal = (data, period) => {
  const cats = Object.keys(data.budgets || {});
  return cats.reduce((sum, c) => sum + (budgetFor(data, c, period) || 0), 0);
};

/** Tonight's line: what went out today, and what is left of the budget. */
export function nightlySummary(data, today = todayStr()) {
  const entries = data.entries || [];
  const todaySpent = spentBetween(entries, (d) => d === today);
  const weekly = data.budgetPeriod === 'weekly';
  const period = weekly ? 'weekly' : 'monthly';
  const budget = budgetTotal(data, period);

  const inPeriod = weekly
    ? spentBetween(entries, (d) => isInWeek(d, currentWeek()))
    : spentBetween(entries, (d) => safeMonth(d) === monthKey(today));

  const title = todaySpent > 0 ? `Today: ${fmt(todaySpent)}` : 'Nothing logged today';
  let body;
  if (budget > 0) {
    const left = budget - inPeriod;
    body =
      left >= 0
        ? `${fmt(left)} left of your ${weekly ? 'weekly' : 'monthly'} budget.`
        : `${fmt(-left)} over your ${weekly ? 'weekly' : 'monthly'} budget.`;
  } else if (inPeriod > 0) {
    body = `${fmt(inPeriod)} this ${weekly ? 'week' : 'month'} so far.`;
  } else {
    body = 'Add anything you spent today, it takes a few seconds.';
  }
  return { title, body };
}

// Kept separate so a malformed date can never throw inside a notification
/** The month-end nudge, sent on the last day of the month. */
export function monthEndSummary(data, today = todayStr()) {
  const month = monthKey(today);
  const name = MONTHS_LONG[Number(month.slice(5, 7)) - 1];
  const spent = spentBetween(data.entries || [], (d) => safeMonth(d) === month);
  const budget = budgetTotal(data, 'monthly');
  const title = `${name} is ending`;
  if (budget > 0) {
    const diff = spent - budget;
    return {
      title,
      body:
        diff > 0
          ? `You spent ${fmt(spent)}, ${fmt(diff)} over budget. Set next month's limits.`
          : `You spent ${fmt(spent)}, ${fmt(-diff)} under budget. Set next month's limits.`,
    };
  }
  return { title, body: spent > 0 ? `You spent ${fmt(spent)}. Set a budget for next month.` : 'Set a budget for next month.' };
}

/** The first-of-month review of the month just finished. */
export function monthStartSummary(data, today = todayStr()) {
  const thisMonth = monthKey(today);
  const [y, m] = thisMonth.split('-').map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const name = MONTHS_LONG[Number(prev.slice(5, 7)) - 1];
  const entries = data.entries || [];
  const spent = spentBetween(entries, (d) => safeMonth(d) === prev);
  const earned = entries
    .filter((e) => e.kind === 'income' && safeMonth(e.date) === prev)
    .reduce((sum, e) => sum + e.amount, 0);
  const kept = earned - spent;
  if (earned > 0) {
    return {
      title: `${name} in one line`,
      body:
        kept >= 0
          ? `Earned ${fmt(earned)}, spent ${fmt(spent)}, kept ${fmt(kept)}.`
          : `Earned ${fmt(earned)}, spent ${fmt(spent)}, ${fmt(-kept)} more than you earned.`,
    };
  }
  return { title: `${name} in one line`, body: spent > 0 ? `You spent ${fmt(spent)} last month.` : 'Nothing was logged last month.' };
}

/** True on the last day of the month, which is when the month-end nudge belongs. */
export const isLastDayOfMonth = (today = todayStr()) => Number(today.slice(8, 10)) === daysInMonth(monthKey(today));

export const isCurrentMonth = (key) => key === currentMonth();
