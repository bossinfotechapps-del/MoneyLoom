import { budgetFor } from './compute';
import { computeUpcoming } from './upcoming';
import { daysBetween, monthKey, todayStr } from '../utils/dates';

/** Cash-flow forecast: manually updated account balances + unreceived scheduled income
 * minus the rest of the expense budget and unpaid scheduled commitments. */
export function computeCashFlow(data, today = todayStr()) {
  const month = monthKey(today);
  const monthSchedule = computeUpcoming(data, today, 30, { thisMonth: true });
  // Older missed payments remain cash commitments, even though the dues screen's
  // This month tab intentionally shows only occurrences dated in this month.
  const priorOverdue = computeUpcoming(data, today, 0).items.filter(i => i.date < `${month}-01`);
  const schedule = { ...monthSchedule, items: [...priorOverdue, ...monthSchedule.items] };
  const monthExpenses = {};
  (data.entries || []).forEach((entry) => {
    if (entry.planned || entry.kind !== 'expense' || monthKey(entry.date) !== month || entry.date > today) return;
    monthExpenses[entry.category] = (monthExpenses[entry.category] || 0) + (Number(entry.amount) || 0);
  });

  const budgetRows = Object.keys(data.budgets || {}).map((category) => {
    const limit = Math.max(0, Number(data.fixedMonthlyCategories?.[category] ? data.budgets[category] : budgetFor(data, category, 'monthly')) || 0);
    const spent = monthExpenses[category] || 0;
    return { category, limit, spent, remaining: Math.max(0, limit - spent) };
  }).filter((row) => row.limit > 0);
  const remainingByCategory = Object.fromEntries(budgetRows.map((r) => [r.category, r.remaining]));
  const remainingBudget = budgetRows.reduce((sum, row) => sum + row.remaining, 0);

  // Only the part of a scheduled due beyond its unspent category budget is
  // extra cash required. Investments have no expense-budget category.
  const dueRows = schedule.items.filter((i) => i.direction === 'out').map((item) => {
    // Last month's overdue amount must not consume this month's remaining budget.
    const covered = item.date < `${month}-01` ? 0 : Math.min(item.amount, Math.max(0, remainingByCategory[item.budgetCategory] || 0));
    if (item.budgetCategory) remainingByCategory[item.budgetCategory] -= covered;
    return { ...item, coveredByBudget: covered, extraRequired: item.amount - covered };
  });
  const additionalDues = dueRows.reduce((sum, i) => sum + i.extraRequired, 0);
  const totalRequired = remainingBudget + additionalDues;

  const accounts = data.accounts || [];
  const available = accounts.length ? Math.max(0, accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0)) : null;
  const staleAccounts = accounts.filter((a) => !a.updatedOn || daysBetween(a.updatedOn, today) > 14);
  const incomingRows = schedule.items.filter((i) => i.direction === 'in');
  const upcomingIncoming = incomingRows.reduce((sum, i) => sum + i.amount, 0);
  const totalFunds = available === null ? null : available + upcomingIncoming;
  const surplus = totalFunds === null ? null : totalFunds - totalRequired;

  // This check deliberately excludes discretionary budget spending, which has
  // no due date. It can reveal an earlier shortfall despite a positive month-end.
  let running = available;
  let firstShortfall = null;
  if (running !== null) {
    schedule.items.forEach((i) => {
      running += i.direction === 'in' ? i.amount : -i.amount;
      if (running < 0 && !firstShortfall) firstShortfall = { date: i.date < today ? today : i.date, balance: running };
    });
  }
  return {
    month, today, schedule, budgetRows, dueRows, incomingRows,
    remainingBudget, additionalDues, totalRequired, available, staleAccounts,
    upcomingIncoming, totalFunds, surplus, firstShortfall,
  };
}
