/* eslint-env jest */
import { emiFor, computeDebt, pendingConfirmations, applyDebtAutoPostings, computeNetWorth, entryForEvent, averageIncome } from '../src/data/debts';

const failures = [];
const ok = (c, m, extra = '') => { if (!c) failures.push(`${m} ${extra}`); };

test('debt calculations', () => {
  const T = '2026-09-11';
  // EMI: 68,000 @ 11.5% for 24 months ≈ 3185
  ok(Math.round(emiFor(68000, 11.5, 24)) === 3185, 'emi formula', emiFor(68000,11.5,24));
  ok(Math.round(emiFor(12000, 0, 12)) === 1000, 'zero rate emi');
  // 10 lakh home loan 8.5% 240m ≈ 8678
  ok(Math.round(emiFor(1000000, 8.5, 240)) === 8678, 'home loan emi', emiFor(1000000,8.5,240));
  const personal = { id:'p', kind:'loan', type:'Personal loan', name:'Personal loan', principal:68000, rate:11.5, tenureMonths:24, firstEmiDate:'2026-01-05', recordMode:'auto', createdOn:'2026-01-01' };
  const rp = computeDebt(personal, T);
  ok(rp.paidCount === 9 && rp.owed > 44000 && rp.owed < 44600, 'loan after 9 EMIs', JSON.stringify(rp));
  ok(rp.nextDue.date === '2026-10-05' && rp.payoffDate === '2027-12-05', 'next due and payoff', rp.nextDue.date + ' ' + rp.payoffDate);
  // full schedule interest ≈ 8443
  ok(Math.abs(rp.interestPaid + rp.interestRemaining - 8443) < 5, 'total interest matches schedule', rp.interestPaid + rp.interestRemaining);
  // ask mode: Sep EMI pending
  const ask = { ...personal, recordMode:'ask', createdOn:'2026-09-01' };
  const ra = computeDebt(ask, T);
  ok(ra.pending.length === 1 && ra.pending[0].key === '2026-09' && ra.owed > rp.owed, 'ask mode pending raises balance', JSON.stringify(ra.pending));
  const paid = computeDebt({ ...ask, statuses: { '2026-09': 'paid' } }, T);
  ok(paid.owed === rp.owed && paid.pending.length === 0, 'confirming paid matches auto');
  ok(pendingConfirmations([ask], T).length === 1, 'pending list');
  // prepayment reduces tenure
  const pre = computeDebt({ ...personal, prepayments:[{ date:'2026-06-10', amount:20000 }] }, T);
  ok(pre.owed < rp.owed - 19000 && pre.payoffDate < rp.payoffDate, 'prepayment shortens', pre.payoffDate);
  // override
  const ov = computeDebt({ ...personal, overrides:[{ date:'2026-09-06', value:40000 }] }, T);
  ok(ov.owed === 40000, 'override sets balance', ov.owed);
  // rate change
  const rc = computeDebt({ ...personal, rateChanges:[{ date:'2026-07-01', rate:14 }] }, T);
  ok(rc.owed > rp.owed && rc.annualRate === 14, 'rate change increases balance');
  // paid off loan stops
  const old = computeDebt({ ...personal, firstEmiDate:'2023-01-05', createdOn:'2023-01-01' }, T);
  ok(old.settled && old.owed === 0 && old.paidCount === 24 && old.nextDue === null, 'paid-off loan settles', JSON.stringify(old));
  // gold interest monthly
  const gold = { id:'g', kind:'gold', type:'Gold loan', name:'Gold loan', principal:50000, rate:12, startDate:'2026-06-20', maturityDate:'2026-12-20', goldStyle:'interestMonthly', recordMode:'ask', createdOn:'2026-06-20', statuses:{ '2026-07':'paid' } };
  const rg = computeDebt(gold, T);
  ok(rg.pending.length === 1 && rg.pending[0].date === '2026-08-20' && rg.owed === 50500 && rg.monthlyOutgo === 500, 'gold monthly interest', JSON.stringify(rg));
  const ge = computeDebt({ ...gold, goldStyle:'interestEnd' }, T);
  ok(ge.owed > 50000 && ge.pending.length === 0 && ge.nextDue.label.startsWith('Principal'), 'gold interest at end', ge.owed);
  // card
  const card = { id:'c', kind:'card', type:'Credit card', name:'Card', billAmount:12000, billDate:'2026-09-01', billDueDate:'2026-09-08', rate:42, payments:[{date:'2026-09-05', amount:5000}], createdOn:'2026-09-01' };
  const rcard = computeDebt(card, T);
  ok(rcard.overdue && rcard.owed > 7000 && rcard.estInterest > 0, 'card overdue interest', JSON.stringify(rcard));
  // pay later
  const pl = { id:'pl', kind:'paylater', name:'Phone', instalment:5000, instalments:6, firstDate:'2026-07-15', recordMode:'auto', createdOn:'2026-07-01' };
  const rpl = computeDebt(pl, T);
  ok(rpl.paidCount === 2 && rpl.owed === 20000 && rpl.nextDue.date === '2026-09-15', 'pay later', JSON.stringify(rpl));
  // hand loan 2% per month, repayment clears interest first
  const hand = { id:'h', kind:'hand', name:'Ravi', principal:10000, ratePerMonth:2, startDate:'2026-05-11', payments:[{date:'2026-07-11', amount:3000}], createdOn:'2026-05-11' };
  const rh = computeDebt(hand, T);
  ok(rh.principalLeft > 7300 && rh.principalLeft < 7500 && rh.interestDue > 250, 'hand loan simple interest', JSON.stringify(rh));
  const lent = { ...hand, id:'l', kind:'lent', payments:[] };
  const rl = computeDebt(lent, T);
  ok(rl.asset > 10000 && rl.owed === 0, 'lent is an asset');
  // chit
  const chit = { id:'ch', kind:'chit', name:'Office chit', instalment:5000, months:20, firstDate:'2026-01-10', recordMode:'auto', createdOn:'2026-01-01' };
  const rc1 = computeDebt(chit, T);
  ok(rc1.asset === 45000 && rc1.owed === 0, 'chit before taken is asset', JSON.stringify(rc1));
  const rc2 = computeDebt({ ...chit, taken:true, takenDate:'2026-08-15', receivedAmount:88000 }, T);
  ok(rc2.asset === 0 && rc2.owed === 55000, 'chit after taken is owed');
  // entries
  const eChit = entryForEvent(chit, { key:'2026-09', date:'2026-09-10', amount:5000, label:'Chit instalment' });
  ok(eChit.tab === 'investment' && eChit.record.type === 'Chit fund', 'chit entry before taken is investment');
  const eChit2 = entryForEvent({ ...chit, taken:true, takenDate:'2026-08-15' }, { key:'2026-09', date:'2026-09-10', amount:5000, label:'Chit instalment' });
  ok(eChit2.tab === 'expense' && eChit2.record.category === 'EMI & loans', 'chit entry after taken is expense');
  ok(entryForEvent({ ...personal, recordMode:'none' }, { key:'x', date:T, amount:1, label:'EMI' }) === null, 'none mode posts nothing');
  // auto postings: only on/after createdOn, once
  const base = { entries:[], investments:[], values:{}, recurring:[], budgets:{}, debts:[{ ...personal, createdOn:'2026-08-01' }, pl, chit] };
  const a1 = applyDebtAutoPostings(base, T);
  const loanEntries = a1.data.entries.filter(e=>e.debtId==='p');
  ok(loanEntries.length === 2 && loanEntries[0].date === '2026-08-05', 'auto posts EMIs since added', JSON.stringify(loanEntries.map(e=>e.date)));
  ok(a1.data.investments.filter(i=>i.debtId==='ch').length === 9, 'chit investments posted');
  const a2 = applyDebtAutoPostings(a1.data, T);
  ok(a2.posted === 0, 'no double posting');
  const a3 = applyDebtAutoPostings({ ...base, debts:[{ ...personal, firstEmiDate:'2023-01-05', createdOn:'2024-11-01' }] }, T);
  ok(a3.data.entries.length === 2, 'stops after payoff (Nov and Dec 2024 only)', a3.data.entries.map(e=>e.date).join(','));
  // net worth
  const nw = computeNetWorth([{ current: 100000 }], [personal, lent, chit, card], T);
  ok(nw.assets === 100000 + rl.asset + rc1.asset && nw.liabilities === rp.owed + rcard.owed, 'net worth', JSON.stringify(nw));
  ok(Math.round(averageIncome({ '2026-07':{earned:90000}, '2026-08':{earned:100000}, '2026-09':{earned:0} }, T)) === 95000, 'average income');
  expect(failures).toEqual([]);
});
