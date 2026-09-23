import { addMonths, addWeeks, weekEnd } from '../utils/dates';

/**
 * Finds spending that adds up quietly: the same thing bought over and over, lots of small
 * amounts, or a category running well above its usual level.
 *
 * Everything here describes what the person already logged. No advice, no recommendations.
 */

// Entries below this are the ones people stop noticing
const SMALL = 300;
// How many past periods to average for "usually"
const LOOKBACK = 3;

const cleanNote = (note) =>
  String(note || '')
    .toLowerCase()
    .replace(/[0-9₹,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Title case for showing a note back to the person
const asLabel = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// Rounds to something readable: 4,180 -> 4,200
const roundTo = (n) => (n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10);

const rangeOf = (key, weekly) => (weekly ? { from: key, to: weekEnd(key) } : { from: `${key}-01`, to: `${key}-31` });
const stepBack = (key, n, weekly) => (weekly ? addWeeks(key, -n) : addMonths(key, -n));

const expensesIn = (entries, key, weekly) => {
  const { from, to } = rangeOf(key, weekly);
  return entries.filter((e) => !e.planned && e.kind === 'expense' && e.date >= from && e.date <= to);
};

// Average spend per past period for a category, ignoring periods with nothing logged
function usualFor(entries, category, key, weekly) {
  const totals = [];
  for (let i = 1; i <= LOOKBACK; i++) {
    const past = expensesIn(entries, stepBack(key, i, weekly), weekly).filter((e) => e.category === category);
    if (past.length) totals.push(past.reduce((sum, e) => sum + e.amount, 0));
  }
  if (!totals.length) return null;
  return totals.reduce((sum, t) => sum + t, 0) / totals.length;
}

/**
 * Returns up to `limit` findings, biggest amount first.
 * Each: { id, kind, title, detail, amount, category }
 */
export function findLeaks(data, key, weekly, limit = 3) {
  const entries = data.entries || [];
  const current = expensesIn(entries, key, weekly);
  if (current.length < 4) return [];

  const periodWord = weekly ? 'week' : 'month';
  const found = [];

  // 1. The same note over and over: "Tea, 14 times"
  const byNote = {};
  current.forEach((e) => {
    const note = cleanNote(e.note);
    if (note.length < 3) return;
    if (!byNote[note]) byNote[note] = { count: 0, total: 0, category: e.category };
    byNote[note].count += 1;
    byNote[note].total += e.amount;
  });
  Object.entries(byNote)
    .filter(([, v]) => v.count >= 4 && v.total > 0)
    .forEach(([note, v]) => {
      found.push({
        id: `note-${note}`,
        kind: 'repeat',
        title: asLabel(note),
        detail: `${v.count} times this ${periodWord}`,
        amount: Math.round(v.total),
        category: v.category,
      });
    });

  // 2. Small amounts that add up, per category
  const smallByCat = {};
  current.forEach((e) => {
    if (e.amount > SMALL) return;
    if (!smallByCat[e.category]) smallByCat[e.category] = { count: 0, total: 0 };
    smallByCat[e.category].count += 1;
    smallByCat[e.category].total += e.amount;
  });
  Object.entries(smallByCat)
    .filter(([, v]) => v.count >= 6)
    .forEach(([category, v]) => {
      found.push({
        id: `small-${category}`,
        kind: 'small',
        title: category,
        detail: `${v.count} spends under ₹${SMALL} add up`,
        amount: Math.round(v.total),
        category,
      });
    });

  // 3. A category well above its usual level
  const byCat = {};
  current.forEach((e) => {
    byCat[e.category] = (byCat[e.category] || 0) + e.amount;
  });
  Object.entries(byCat).forEach(([category, total]) => {
    const usual = usualFor(entries, category, key, weekly);
    if (!usual || usual < 200) return;
    if (total < usual * 1.4) return;
    found.push({
      id: `up-${category}`,
      kind: 'above',
      title: category,
      detail: `Usually about ${roundTo(usual)} a ${periodWord}`,
      amount: Math.round(total),
      usual: Math.round(usual),
      category,
    });
  });

  // Keep the biggest, and only one finding per category so the card doesn't repeat itself
  const seen = new Set();
  return found
    .sort((a, b) => b.amount - a.amount)
    .filter((f) => {
      if (seen.has(f.category)) return false;
      seen.add(f.category);
      return true;
    })
    .slice(0, limit);
}

/**
 * Saving rate for each of the last `count` months: (earned - spent) / earned.
 * Months with no income are skipped, since the rate would be meaningless.
 */
export function savingRateTrend(byMonth, upToMonth, count = 6) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const k = addMonths(upToMonth, -i);
    const t = byMonth[k];
    if (!t || t.earned <= 0) {
      out.push({ key: k, rate: null, earned: 0, spent: 0 });
    } else {
      out.push({ key: k, rate: ((t.earned - t.spent) / t.earned) * 100, earned: t.earned, spent: t.spent });
    }
  }
  return out;
}

// Average of the first half against the second, so the trend line has something to say
export function savingRateChange(trend) {
  const rated = trend.filter((t) => t.rate !== null);
  if (rated.length < 2) return null;
  const half = Math.floor(rated.length / 2);
  const older = rated.slice(0, half);
  const recent = rated.slice(half);
  const mean = (list) => list.reduce((sum, t) => sum + t.rate, 0) / list.length;
  return { older: mean(older), recent: mean(recent), months: rated.length };
}
