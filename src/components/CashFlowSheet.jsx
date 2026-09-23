import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react-native';
import { C, T } from '../theme';
import { useData } from '../data/DataContext';
import { computeCashFlow } from '../data/cashFlow';
import { fmtDate, monthLabel, todayStr } from '../utils/dates';
import { fmt, fmtSigned } from '../utils/format';
import SheetScreen from './SheetScreen';
import { Card, SectionHeader } from './ui';

function AmountRow({ title, amount, note, color, strong }) {
  return (
    <View style={s.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[T.body, strong && { fontWeight: '800' }]}>{title}</Text>
        {note ? <Text style={[T.small, { marginTop: 2 }]}>{note}</Text> : null}
      </View>
      <Text style={[T.num, { fontSize: 15, fontWeight: strong ? '800' : '700', color: color || C.ink }]} numberOfLines={1} adjustsFontSizeToFit>{amount}</Text>
    </View>
  );
}

export default function CashFlowSheet({ onClose, onOpenDues, onOpenAccounts }) {
  const { data } = useData();
  const today = todayStr();
  const plan = useMemo(() => computeCashFlow(data, today), [data, today]);
  const hasAccounts = plan.available !== null;
  return (
    <SheetScreen title="Cash Flow Plan" subtitle={`${monthLabel(plan.month)} · From today to month end`} onClose={onClose}>
      <View style={s.hero}>
        <Text style={s.heroLabel}>Projected surplus / shortfall</Text>
        <Text style={[s.heroValue, T.num]} numberOfLines={1} adjustsFontSizeToFit>
          {hasAccounts ? fmtSigned(plan.surplus) : 'Balance needed'}
        </Text>
        <Text style={s.heroCaption}>
          {hasAccounts ? 'Available now + expected income − remaining required' : 'Enter your available bank and cash balances to calculate your position.'}
        </Text>
      </View>

      <Card>
        <SectionHeader title="Your monthly position" subtitle="Remaining commitments, not amounts already paid" />
        <AmountRow title="Total required" amount={fmt(plan.totalRequired)} color={C.spend} strong />
        <AmountRow title="Available money now" amount={hasAccounts ? fmt(plan.available) : 'Not set'} note="Balances you entered in Accounts" color={C.invest} />
        <AmountRow title="Upcoming incoming" amount={`+${fmt(plan.upcomingIncoming)}`} note="Scheduled income not yet recorded" color={C.earn} />
        {hasAccounts && <AmountRow title="Expected surplus / shortfall" amount={fmtSigned(plan.surplus)} color={plan.surplus < 0 ? C.loss : C.gain} strong />}
        {!hasAccounts && <Pressable onPress={onOpenAccounts} accessibilityRole="button" style={s.cta}><Wallet size={16} color={C.invest} /><Text style={s.ctaText}>Update bank and cash balances →</Text></Pressable>}
      </Card>

      {plan.staleAccounts.length > 0 && (
        <View style={s.warning}>
          <AlertTriangle size={17} color={C.warn} />
          <Text style={[T.small, { flex: 1, color: C.inkSoft }]}>
            {`${plan.staleAccounts.length} account balance${plan.staleAccounts.length > 1 ? 's are' : ' is'} over 14 days old or undated. Refresh balances to improve this estimate.`}
          </Text>
        </View>
      )}

      {plan.firstShortfall && (
        <View style={s.warning}>
          <AlertTriangle size={17} color={C.loss} />
          <Text style={[T.small, { flex: 1, color: C.loss }]}>
            {`Your scheduled dues could put you ${fmt(Math.abs(plan.firstShortfall.balance))} short by ${fmtDate(plan.firstShortfall.date)}, even before unplanned spending.`}
          </Text>
        </View>
      )}

      <Card>
        <SectionHeader title="1 · Total required" subtitle="Remaining budget plus dues outside that budget" />
        <AmountRow title="Remaining expense budget" amount={fmt(plan.remainingBudget)} strong />
        {plan.budgetRows.map((r) => <AmountRow key={r.category} title={r.category} amount={fmt(r.remaining)} note={`${fmt(r.spent)} spent of ${fmt(r.limit)} monthly budget`} />)}
        <AmountRow title="Extra unpaid dues and investments" amount={fmt(plan.additionalDues)} strong />
        {plan.dueRows.map((r) => (
          <AmountRow key={r.id} title={r.title} amount={fmt(r.extraRequired)} note={`${fmtDate(r.date)} · ${fmt(r.amount)} scheduled${r.coveredByBudget ? ` · ${fmt(r.coveredByBudget)} already covered by budget` : ''}`} />
        ))}
        {!plan.dueRows.length && <Text style={T.small}>No unpaid scheduled dues or older unpaid commitments.</Text>}
        <AmountRow title="Total required" amount={fmt(plan.totalRequired)} color={C.spend} strong />
        <Pressable onPress={onOpenDues} accessibilityRole="button" style={s.cta}><ArrowUpRight size={16} color={C.invest} /><Text style={s.ctaText}>See all EMIs and dues →</Text></Pressable>
      </Card>

      <Card>
        <SectionHeader title="2 · Money available" subtitle="Manually updated bank and cash balances" />
        {(data.accounts || []).map((a) => <AmountRow key={a.id} title={a.name} amount={fmt(Number(a.balance) || 0)} note={a.updatedOn ? `Updated ${fmtDate(a.updatedOn)}` : 'Balance date not provided'} />)}
        <AmountRow title="Available now" amount={hasAccounts ? fmt(plan.available) : 'Not set'} color={C.invest} strong />
        <Pressable onPress={onOpenAccounts} accessibilityRole="button" style={s.cta}><Wallet size={16} color={C.invest} /><Text style={s.ctaText}>Review account balances →</Text></Pressable>
      </Card>

      <Card>
        <SectionHeader title="3 · Upcoming incoming" subtitle="Salary, lending interest, repeats and other planned receipts" />
        {plan.incomingRows.length ? plan.incomingRows.map((r) => (
          <AmountRow key={r.id} title={r.title} amount={`+${fmt(r.amount)}`} note={`${fmtDate(r.date)} · ${r.detail}`} color={C.earn} />
        )) : <Text style={T.small}>No future receipts are scheduled this month. Add a monthly income repeat to include an expected salary or interest payment.</Text>}
        <AmountRow title="Upcoming incoming" amount={`+${fmt(plan.upcomingIncoming)}`} color={C.earn} strong />
      </Card>

      <View style={s.note}>
        <ArrowDownLeft size={18} color={C.invest} />
        <Text style={[T.small, { flex: 1, lineHeight: 19 }]}>
          This is a planning estimate, not a bank balance or confirmation of payment. Upcoming income may arrive after a due date. Future transactions recorded as actual are not added again as expected income. Keep your account balances updated.
        </Text>
      </View>
    </SheetScreen>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: C.investDark, padding: 22, borderRadius: 21, gap: 7 },
  heroLabel: { color: '#CBE5DD', fontSize: 13 },
  heroValue: { color: C.white, fontSize: 30, fontWeight: '800', letterSpacing: -0.7 },
  heroCaption: { color: '#E3F0EC', fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineSoft },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: '#EAF4EF' },
  ctaText: { color: C.invest, fontWeight: '700', fontSize: 13 },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#FFF4E4', borderWidth: 1, borderColor: '#F0E0C5' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 8, paddingBottom: 12 },
});
