import { addMonths, daysInMonth, monthKey, pad, todayStr } from '../utils/dates';
import { uid } from '../utils/format';

const cents = n => Math.round((Number(n) || 0) * 100);
const money = n => Math.round(n) / 100;
export const scheduledDate = (rule, month) => `${month}-${pad(Math.min(Math.max(1, Number(rule.day) || 1), daysInMonth(month)))}`;
const recordsFor = (data, rule) => rule.tab === 'investment' ? (data.investments || []) : (data.entries || []);

// The actual payment is ONE transaction. Allocations are merely labels on that
// transaction, so distributing a ₹2,000 deposit across two months cannot double-count it.
export function allocatedCents(data, rule, month) {
  return recordsFor(data, rule).reduce((total, rec) => {
    if (rec.recurringId !== rule.id || rec.planned) return total;
    if (Array.isArray(rec.scheduleAllocations)) {
      return total + rec.scheduleAllocations.filter(x => x.month === month).reduce((s, x) => s + cents(x.amount), 0);
    }
    // Older automatically created / manually linked monthly records are already paid.
    return total + (monthKey(rec.date) === month ? cents(rec.amount) : 0);
  }, 0);
}

export function scheduledRepeatItems(data, today = todayStr(), until = today, includeEarlier = true) {
  const results = [];
  const windowStart = includeEarlier ? addMonths(monthKey(today), -23) : monthKey(today);
  (data.recurring || []).forEach(rule => {
    if (!rule.active) return;
    let month = rule.startMonth > windowStart ? rule.startMonth : windowStart;
    // lastPostedMonth records historic payments only. Legacy posted payments
    // are in the transaction list and must not be solicited a second time.
    if (rule.lastPostedMonth && month <= rule.lastPostedMonth) month = addMonths(rule.lastPostedMonth, 1);
    for (let n = 0; n < 48 && `${month}-01` <= until; n++, month = addMonths(month, 1)) {
      const date = scheduledDate(rule, month);
      if (date > until) continue;
      if (!includeEarlier && date < today) continue;
      const planned = cents(rule.template?.amount);
      if (planned <= 0) continue;
      const allocated = allocatedCents(data, rule, month);
      const remaining = Math.max(0, planned - allocated);
      if (!remaining) continue;
      const marked = rule.confirmationStatuses?.[month];
      results.push({
        id: `repeat-${rule.id}-${month}`, kind: 'repeat', ruleId: rule.id,
        month, date, title: rule.tab === 'investment' ? rule.template?.name || 'Investment' : rule.template?.note || rule.template?.category || 'Monthly repeat',
        detail: rule.tab === 'investment' ? 'Investment' : rule.tab === 'income' ? 'Income' : rule.template?.category || 'Expense',
        direction: rule.tab === 'income' ? 'in' : 'out', budgetCategory: rule.tab === 'expense' ? rule.template?.category : null,
        planned: money(planned), allocated: money(allocated), amount: money(remaining),
        status: marked === 'missed' ? 'missed' : allocated ? 'partial' : marked === 'later' ? 'later' : 'pending',
        overdue: date < today, rule,
      });
    }
  });
  return results.sort((a, b) => a.date.localeCompare(b.date));
}

export function allocationForPayment(data, rule, targetMonth, amount, coverEarlier, today = todayStr()) {
  const remaining = cents(amount);
  if (remaining <= 0) return [];
  const slots = scheduledRepeatItems(data, today, today, true).filter(i => i.ruleId === rule.id && i.month <= targetMonth);
  const current = slots.find(i => i.month === targetMonth);
  if (!current) return [];
  const ordered = coverEarlier ? [...slots.filter(i => i.month < targetMonth), current] : [current];
  let left = remaining;
  const allocated = [];
  ordered.forEach(i => {
    if (!left) return;
    const used = Math.min(left, cents(i.amount));
    if (used) allocated.push({ month: i.month, amount: money(used) });
    left -= used;
  });
  return allocated;
}

export function findExistingPayment(data, rule, amount, date) {
  const records = recordsFor(data, rule);
  // Never silently merge equal amounts: ask the user to explicitly link a
  // pre-existing manual transaction or change the payment details.
  return records.find(r => !r.planned && !r.recurringId && r.date === date && cents(r.amount) === cents(amount) &&
    (rule.tab === 'investment' ? r.name === rule.template?.name && r.action === rule.template?.action
      : r.kind === rule.tab && r.category === rule.template?.category)) || null;
}

export function addRepeatPayment(data, ruleId, targetMonth, payment, coverEarlier = false, existingId = null, today = todayStr()) {
  const rule = (data.recurring || []).find(r => r.id === ruleId && r.active);
  const amount = Number(payment?.amount);
  const date = payment?.date;
  if (!rule || !Number.isFinite(amount) || amount <= 0 || amount > 1e10 || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || date > today) return data;
  const allocations = allocationForPayment(data, rule, targetMonth, amount, coverEarlier, today);
  if (!allocations.length) return data;
  const key = rule.tab === 'investment' ? 'investments' : 'entries';
  // An accidental second tap must not write the same actual payment twice.
  if (!existingId && (data[key] || []).some(r => !r.planned && r.recurringId === rule.id && r.date === date && cents(r.amount) === cents(amount) && r.confirmationKey === `${ruleId}:${targetMonth}`)) return data;
  // Partial payments may require multiple confirmed transactions for one month.
  const existing = existingId ? (data[key] || []).find(r => r.id === existingId && !r.recurringId && !r.planned) : null;
  if (existingId && (!existing || existing.id !== findExistingPayment(data, rule, amount, date)?.id)) return data;
  // A future dated entry already linked to this repeating rule is a plan,
  // not another payment. Convert it to one actual transaction when confirmed.
  const preplanned = !existing && (data[key] || []).find(r => r.recurringId === rule.id && r.planned && monthKey(r.date) === targetMonth);
  const common = {
    recurringId: rule.id, date, amount, planned: false, scheduleAllocations: allocations,
    confirmationKey: `${ruleId}:${targetMonth}`,
  };
  const entry = existing ? { ...existing, ...common } : preplanned ? { ...preplanned, ...common } : {
    ...rule.template, ...common, id: uid(),
    ...(rule.tab === 'investment' ? {} : { kind: rule.tab }),
  };
  const updated = existing || preplanned ? data[key].map(r => r.id === entry.id ? entry : r) : [...data[key], entry];
  return { ...data, [key]: updated };
}

export function markRepeatStatus(data, ruleId, month, status) {
  if (status !== 'missed' && status !== 'later') return data;
  return { ...data, recurring: (data.recurring || []).map(r => r.id !== ruleId ? r : {
    ...r, confirmationStatuses: { ...(r.confirmationStatuses || {}), [month]: status },
  }) };
}
