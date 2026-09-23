import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react-native';
import { C, T } from '../theme';
import { useData } from '../data/DataContext';
import { averageIncome, canPlanPayoff, computeDebt } from '../data/debts';
import { addMonths, currentMonth, fmtDate, monthYear, todayStr } from '../utils/dates';
import { compact, fmt, fmtSigned, pct } from '../utils/format';
import InvestmentsScreen from './InvestmentsScreen';
import AccountList from '../components/AccountList';
import ConfirmPayments from '../components/ConfirmPayments';
import PayoffPlannerSheet from '../components/PayoffPlannerSheet';
import UpcomingSheet from '../components/UpcomingSheet';
import { Bar, Card, EmptyState, GhostButton, KpiGrid, PrimaryButton, Segmented, Tag } from '../components/ui';

const OWE_KINDS = new Set(['loan', 'gold', 'card', 'paylater', 'hand']);
const LENT_KINDS = new Set(['lent', 'chit']);

// One line under the debt name, per kind
function detailLine(d, r) {
  switch (d.kind) {
    case 'loan':
      if (r.studyPeriod) return `${r.annualRate}% a year, study-period interest ${fmt(r.monthlyOutgo)} a month`;
      return `${r.annualRate}% a year, EMI ${fmt(r.emi)}${r.payoffDate ? `, ends ${monthYear(r.payoffDate)}` : ''}`;
    case 'gold':
      return `${d.grams ? `${d.grams} g pledged, ` : ''}${d.rate}% a year${d.goldStyle === 'interestMonthly' ? `, interest ${fmt(r.emi)} a month` : ''}`;
    case 'card':
      return d.billDueDate && r.owed > 0 ? `Bill ${fmt(d.billAmount)}, due ${fmtDate(d.billDueDate)}` : 'No bill due';
    case 'paylater':
      return `${r.left} of ${r.total} instalments left, ${fmt(d.instalment)} each`;
    case 'hand':
    case 'lent':
      return `${d.ratePerMonth ? `${d.ratePerMonth}% a month` : 'No interest'}${d.promisedDate ? `, ${d.kind === 'lent' ? 'expected' : 'promised'} by ${fmtDate(d.promisedDate)}` : ''}`;
    case 'chit':
      return `${r.paidCount} of ${r.total} paid, ${fmt(d.instalment)} a month${r.taken ? ', taken' : ''}`;
    default:
      return '';
  }
}

function badgeFor(d, r, today) {
  if (d.closed) return { text: 'Closed', bg: C.lineSoft, fg: C.inkSoft };
  if (r.settled) return { text: d.kind === 'lent' ? 'Fully received' : 'Paid off', bg: '#E1F5EE', fg: '#0F6E56' };
  if (r.overdue) return { text: d.kind === 'card' ? 'Overdue' : d.kind === 'gold' ? 'Past maturity' : 'Past due date', bg: '#FCEBEB', fg: '#791F1F' };
  if (r.pending.length) return { text: `${r.pending.length} to confirm`, bg: '#FAEEDA', fg: '#633806' };
  if (d.kind === 'gold' && d.maturityDate && addMonths(currentMonth(), 1) >= d.maturityDate.slice(0, 7)) {
    return { text: `Principal due ${fmtDate(d.maturityDate)}`, bg: '#FAEEDA', fg: '#633806' };
  }
  if (r.neverEnds) return { text: 'EMI below interest', bg: '#FCEBEB', fg: '#791F1F' };
  return null;
}

function DebtCard({ d, r, onPress, today }) {
  const lentLike = d.kind === 'lent' || (d.kind === 'chit' && !r.taken);
  const amount = d.kind === 'lent' ? r.asset : d.kind === 'chit' && !r.taken ? r.paidIn : r.owed;
  const badge = badgeFor(d, r, today);
  const showBar = d.kind !== 'card' && !(d.kind === 'gold' && d.goldStyle !== 'emi');
  return (
    <Pressable onPress={onPress} android_ripple={{ color: C.lineSoft }} style={[s.debtCard, (d.closed || r.settled) && { opacity: 0.65 }]} accessibilityRole="button">
      <View style={s.rowBetween}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[T.body, { fontWeight: '700' }]} numberOfLines={1}>{d.name}</Text>
          <View style={{ flexDirection: 'row', marginTop: 3 }}>
            <Tag label={d.type} />
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[T.body, T.num, { fontWeight: '800', color: lentLike ? C.invest : C.ink }]}>{fmt(amount)}</Text>
          <Text style={T.small}>{d.kind === 'lent' ? 'owed to you' : d.kind === 'chit' && !r.taken ? 'paid in' : 'left to pay'}</Text>
        </View>
      </View>
      <Text style={[T.small, { marginTop: 8 }]} numberOfLines={2}>{detailLine(d, r)}</Text>
      {r.nextDue && !d.closed && !r.settled && (
        <Text style={[T.small, { marginTop: 3, color: C.inkSoft, fontWeight: '600' }]} numberOfLines={1}>
          {`${r.nextDue.label} ${fmt(r.nextDue.amount)} due ${fmtDate(r.nextDue.date)}`}
        </Text>
      )}
      {showBar && (
        <View style={{ marginTop: 6 }}>
          <Bar ratio={r.progress} color={C.invest} />
        </View>
      )}
      {badge && (
        <View style={[s.badge, { backgroundColor: badge.bg }]}>
          <Text style={{ color: badge.fg, fontWeight: '700', fontSize: 12 }}>{badge.text}</Text>
        </View>
      )}
    </Pressable>
  );
}

function DebtList({ kinds, onAddDebt, onOpenDebt, bottomSpace, group }) {
  const { data, byMonth } = useData();
  const [showClosed, setShowClosed] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [duesOpen, setDuesOpen] = useState(false);
  const today = todayStr();

  const items = useMemo(
    () =>
      data.debts
        .filter((d) => kinds.has(d.kind))
        .map((d) => ({ d, r: computeDebt(d, today) }))
        .sort((a, b) => b.r.annualRate - a.r.annualRate || b.r.owed - a.r.owed),
    [data.debts, kinds, today]
  );
  const active = items.filter((x) => x.r.active);
  const done = items.filter((x) => !x.r.active);

  const income = averageIncome(byMonth, today);
  const totals = active.reduce(
    (acc, { d, r }) => ({
      owed: acc.owed + r.owed,
      asset: acc.asset + r.asset,
      outgo: acc.outgo + r.burdenOutgo,
      lent: acc.lent + (d.kind === 'lent' ? r.asset : 0),
      chitIn: acc.chitIn + (d.kind === 'chit' ? r.asset : 0),
    }),
    { owed: 0, asset: 0, outgo: 0, lent: 0, chitIn: 0 }
  );

  if (!items.length) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomSpace }}>
        <EmptyState
          title={group === 'lent' ? 'Nothing lent or in chits' : 'No debts added'}
          body={
            group === 'lent'
              ? 'Track money you lent to friends or family, and chit funds you’re part of.'
              : 'Add a home loan, gold loan, card bill or hand loan to see what you owe and when you’ll be debt-free.'
          }
        >
          <PrimaryButton label={group === 'lent' ? 'Add money lent or chit' : 'Add debt'} icon={<Plus size={18} color={C.white} />} onPress={onAddDebt} />
        </EmptyState>
      </ScrollView>
    );
  }

  const burden = income > 0 ? (totals.outgo / income) * 100 : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomSpace, gap: 12 }}>
      <ConfirmPayments />
      {group === 'owe' ? (
        <KpiGrid
          items={[
            { label: 'Total owed', value: fmt(totals.owed), color: C.loss },
            {
              label: 'EMIs and interest',
              value: `${fmt(totals.outgo)}/mo`,
              note: burden === null ? 'Add income to see the share' : `${pct(burden)} of income`,
              noteColor: burden !== null && burden >= 40 ? C.loss : undefined,
            },
          ]}
        />
      ) : (
        <KpiGrid
          items={[
            { label: 'Owed to you', value: fmt(totals.lent), color: C.invest },
            { label: 'In chits', value: fmt(totals.chitIn), note: totals.owed ? `${fmt(totals.owed)} still to pay` : 'Paid in so far' },
          ]}
        />
      )}
      {group === 'owe' && active.some(({ d, r }) => canPlanPayoff(d, r)) && (
        <GhostButton label="See what paying extra would do" color={C.invest} onPress={() => setPlanning(true)} />
      )}

      {group === 'owe' && (
        <GhostButton label="Upcoming EMIs and dues" color={C.invest} onPress={() => setDuesOpen(true)} />
      )}

      {planning && <PayoffPlannerSheet onClose={() => setPlanning(false)} />}
      {duesOpen && <UpcomingSheet onClose={() => setDuesOpen(false)} />}

      {group === 'owe' && burden !== null && burden >= 40 && (
        <Text style={[T.small, { color: C.loss }]}>EMIs take a large share of income. Many lenders get cautious above about 40–50%.</Text>
      )}

      {active.map(({ d, r }) => (
        <DebtCard key={d.id} d={d} r={r} today={today} onPress={() => onOpenDebt(d.id)} />
      ))}

      {done.length > 0 && (
        <>
          <Pressable onPress={() => setShowClosed((v) => !v)} style={s.closedToggle} accessibilityRole="button">
            <Text style={[T.h3, { flex: 1 }]}>Closed and paid off ({done.length})</Text>
            {showClosed ? <ChevronUp size={18} color={C.muted} /> : <ChevronDown size={18} color={C.muted} />}
          </Pressable>
          {showClosed && done.map(({ d, r }) => <DebtCard key={d.id} d={d} r={r} today={today} onPress={() => onOpenDebt(d.id)} />)}
        </>
      )}
    </ScrollView>
  );
}

export default function WealthScreen({ segment, setSegment, onAddInvestment, onEditInvestment, onAddDebt, onOpenDebt, onToast, bottomSpace }) {
  const { data, netWorth } = useData();

  // Change against last month's snapshot
  const prevSnap = useMemo(() => {
    const cur = currentMonth();
    return [...(data.netWorthHistory || [])].filter((x) => x.month < cur).sort((a, b) => b.month.localeCompare(a.month))[0];
  }, [data.netWorthHistory]);
  const change = prevSnap ? netWorth.netWorth - (prevSnap.assets - prevSnap.liabilities) : null;
  const ownShare = netWorth.assets + netWorth.liabilities > 0 ? netWorth.assets / (netWorth.assets + netWorth.liabilities) : 1;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 6, gap: 10 }}>
        <Card style={{ paddingVertical: 16, backgroundColor: '#F0F8F4', borderColor: '#CFE5D9' }}>
          <View style={s.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={T.label}>Net worth</Text>
              <Text style={[s.netWorth, T.num, { color: netWorth.netWorth < 0 ? C.loss : C.ink }]}>{fmt(netWorth.netWorth)}</Text>
            </View>
            {change !== null && (
              <Text style={[T.small, { color: change >= 0 ? C.gain : C.loss, fontWeight: '700' }]}>{`${fmtSigned(change)} vs last month`}</Text>
            )}
          </View>
          <Text style={T.small}>
            {`You own ${compact(netWorth.assets)}, you owe ${compact(netWorth.liabilities)}`}
            {netWorth.cash > 0 ? `, including ${compact(netWorth.cash)} in accounts` : ''}
          </Text>
          <View style={s.ownBar}>
            <View style={{ flex: ownShare, backgroundColor: C.invest }} />
            <View style={{ flex: 1 - ownShare, backgroundColor: C.loss }} />
          </View>
        </Card>
        <Segmented
          options={[['accounts', 'Accounts'], ['investments', 'Investments'], ['debts', 'Debts'], ['lent', 'Lent & chits']]}
          value={segment}
          onChange={setSegment}
        />
      </View>

      <View style={{ flex: 1, marginTop: 4 }}>
        {segment === 'accounts' && <AccountList onToast={onToast} bottomSpace={bottomSpace} />}
        {segment === 'investments' && (
          <InvestmentsScreen onAdd={onAddInvestment} onEdit={onEditInvestment} onToast={onToast} bottomSpace={bottomSpace} />
        )}
        {segment === 'debts' && <DebtList kinds={OWE_KINDS} group="owe" onAddDebt={() => onAddDebt('owe')} onOpenDebt={onOpenDebt} bottomSpace={bottomSpace} />}
        {segment === 'lent' && <DebtList kinds={LENT_KINDS} group="lent" onAddDebt={() => onAddDebt('lent')} onOpenDebt={onOpenDebt} bottomSpace={bottomSpace} />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  netWorth: { fontSize: 29, fontWeight: '800', letterSpacing: -0.75, marginTop: 2, marginBottom: 2 },
  ownBar: { flexDirection: 'row', height: 7, borderRadius: 9, overflow: 'hidden', marginTop: 8, backgroundColor: C.lineSoft },
  debtCard: { backgroundColor: C.surface, borderRadius: 19, borderWidth: 1, borderColor: C.line, padding: 15, overflow: 'hidden', elevation: 1 },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8 },
  closedToggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
});
