import { addMonths, addMonthsDate, daysInMonth, monthKey, pad, todayStr } from '../utils/dates';
import { uid } from '../utils/format';
import { computeHoldings } from './compute';

// Eight months of realistic example data so the charts can be explored before real entries exist.
export function makeSampleData() {
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const entries = [];
  const investments = [];
  const today = todayStr();
  const cur = monthKey(today);

  for (let i = 7; i >= 0; i--) {
    const mk = addMonths(cur, -i);
    const lastDay = i === 0 ? Number(today.slice(8, 10)) : daysInMonth(mk);
    const day = (n) => `${mk}-${pad(n)}`;
    const E = (d, category, amount, mode, note, kind = 'expense') => {
      if (d <= lastDay) entries.push({ id: uid(), kind, date: day(d), category, amount: Math.round(amount), mode, note });
    };
    const I = (d, type, name, amount) => {
      if (d <= lastDay) investments.push({ id: uid(), action: 'invest', date: day(d), type, name, amount, note: '' });
    };
    const anyDay = () => 1 + Math.floor(rnd() * 27);

    E(1, 'Salary', 90000, 'Bank transfer', 'Monthly salary', 'income');
    if (rnd() > 0.55) E(20, 'Side business', 4000 + rnd() * 9000, 'UPI', 'Client project', 'income');
    E(3, 'Rent & housing', 12000, 'Bank transfer', 'House rent');
    E(8, 'Bills & utilities', 1800 + rnd() * 900, 'UPI', 'EB bill and internet');
    E(10, 'Subscriptions', 649, 'Card', 'Streaming and cloud storage');
    for (let w = 0; w < 4; w++) E(2 + w * 7, 'Groceries & food', 1800 + rnd() * 2200, 'UPI', 'Weekly groceries');
    for (let k = 0; k < 3; k++) E(anyDay(), 'Fuel & transport', 600 + rnd() * 700, 'UPI', 'Petrol');
    const outs = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < outs; k++) E(anyDay(), 'Eating out', 300 + rnd() * 1200, 'UPI', 'Dinner out');
    if (rnd() > 0.4) E(anyDay(), 'Shopping', 1200 + rnd() * 5000, 'Card', 'Clothes and home');
    if (rnd() > 0.6) E(anyDay(), 'Health', 500 + rnd() * 2500, 'UPI', 'Pharmacy and checkup');
    if (rnd() > 0.5) E(anyDay(), 'Family & gifts', 1000 + rnd() * 4000, 'UPI', 'Family function');

    I(5, 'Mutual fund / SIP', 'Nifty 50 Index Fund', 6000);
    I(5, 'Mutual fund / SIP', 'Flexi Cap Fund', 4000);
    I(10, 'PPF', 'PPF', 3000);
    I(10, 'NPS', 'NPS Tier 1', 2000);
    if (i % 3 === 0) I(15, 'Gold', 'Digital gold', 2500);
    if (i === 7) I(2, 'Emergency fund', 'Savings account', 100000);
  }

  const growth = { 'Savings account': 1.02, 'Nifty 50 Index Fund': 1.08, 'Flexi Cap Fund': 1.11, PPF: 1.04, 'NPS Tier 1': 1.06, 'Digital gold': 1.14 };
  const values = {};
  computeHoldings(investments, {}).forEach((h) => {
    values[h.name] = { value: Math.round(h.invested * (growth[h.name] || 1)), date: today };
  });
  // Debts, lending and a chit so the Wealth tab has something to show.
  // Added 8 months ago with automatic recording, so EMIs appear in expenses; one loan asks for confirmation.
  const addedOn = `${addMonths(cur, -7)}-01`;
  const debts = [
    {
      id: uid(), kind: 'loan', type: 'Vehicle loan', name: 'Bike loan', principal: 180000, rate: 10.5, tenureMonths: 24,
      firstEmiDate: `${addMonths(cur, -12)}-05`, emi: 8347, recordMode: 'auto', createdOn: addedOn, postedThrough: '',
    },
    {
      id: uid(), kind: 'loan', type: 'Personal loan', name: 'Personal loan', principal: 68000, rate: 11.5, tenureMonths: 24,
      firstEmiDate: `${addMonths(cur, -8)}-07`, recordMode: 'ask', createdOn: `${cur}-01`,
    },
    {
      id: uid(), kind: 'gold', type: 'Gold loan', name: 'Gold loan', principal: 50000, rate: 12, grams: 25,
      startDate: addMonthsDate(today, -3), maturityDate: addMonthsDate(today, 3), goldStyle: 'interestMonthly', recordMode: 'none', createdOn: addMonthsDate(today, -3),
    },
    {
      id: uid(), kind: 'card', type: 'Credit card', name: 'Salary account card', rate: 42, billAmount: 12000,
      billDate: today, billDueDate: addMonthsDate(today, 0, 28) >= today ? addMonthsDate(today, 0, 28) : addMonthsDate(today, 1, 28), payments: [], recordMode: 'none', createdOn: today,
    },
    {
      id: uid(), kind: 'hand', type: 'Hand loan (I borrowed)', name: 'Ravi', principal: 10000, ratePerMonth: 0,
      startDate: addMonthsDate(today, -2), promisedDate: addMonthsDate(today, 2), payments: [], recordMode: 'none', createdOn: addMonthsDate(today, -2),
    },
    {
      id: uid(), kind: 'lent', type: 'Money I lent', name: 'Suresh', principal: 15000, ratePerMonth: 0,
      startDate: addMonthsDate(today, -4), promisedDate: addMonthsDate(today, 1), payments: [{ id: uid(), date: addMonthsDate(today, -1), amount: 5000 }], recordMode: 'none', createdOn: addMonthsDate(today, -4),
    },
    {
      id: uid(), kind: 'chit', type: 'Chit fund', name: 'Office chit group', instalment: 5000, months: 20,
      firstDate: `${addMonths(cur, -5)}-10`, taken: false, recordMode: 'auto', createdOn: addedOn,
    },
  ];
  const accounts = [
    { id: uid(), name: 'Salary account', type: 'Salary', last4: '4417', balance: 48500, updatedOn: today, history: [] },
    { id: uid(), name: 'Savings account', type: 'Savings', last4: '', balance: 120000, updatedOn: addMonthsDate(today, 0, Math.max(1, Number(today.slice(8, 10)) - 9)), history: [] },
    { id: uid(), name: 'Cash in hand', type: 'Cash', last4: '', balance: 3500, updatedOn: today, history: [] },
  ];
  return { entries, investments, values, debts, accounts, recurring: [], budgets: {}, netWorthHistory: [] };
}
