import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarCheck } from 'lucide-react-native';
import { C, T } from '../theme';
import { useData } from '../data/DataContext';
import { computeDebt } from '../data/debts';
import { findExistingPayment, scheduledRepeatItems } from '../data/paymentSchedule';
import { fmtDate, todayStr } from '../utils/dates';
import { fmt } from '../utils/format';
import AmountDateDialog from './AmountDateDialog';

// Shows both recurring income and outgoing payments. No scheduled amount is
// added to the real ledger until the user confirms an actual amount and date.
export default function ConfirmPayments({ debtId, style, max = 3 }) {
  const { data, confirmDebtEvent, confirmManualDebtDue, confirmRepeatPayment, markScheduledRepeat, confirmOneOffPlan, markOneOffPlan } = useData();
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(null);
  const [coverEarlier, setCoverEarlier] = useState(false);
  const today = todayStr();
  const all = useMemo(() => {
    const dues = [];
    (data.debts || []).forEach(debt => {
      const oneOffDebt = ['card', 'hand', 'lent'].includes(debt.kind);
      if (debt.closed || (debtId && debt.id !== debtId) || (!oneOffDebt && debt.recordMode !== 'ask')) return;
      const result = computeDebt(debt, today);
      if (oneOffDebt && result.nextDue && result.nextDue.date <= today) {
        const ev = result.nextDue;
        dues.push({ id: `manual:${debt.id}:${ev.date}`, kind: 'manualDebt', title: debt.name,
          date: ev.date, detail: ev.label, direction: debt.kind === 'lent' ? 'in' : 'out',
          amount: ev.amount, debt, ev, overdue: ev.date < today,
          status: debt.manualDueStatuses?.[ev.date] || 'pending',
        });
      }
      if (debt.recordMode === 'ask') [...(result.pending || []), ...(result.missed || [])].forEach(ev => dues.push({
        id: `debt:${debt.id}:${ev.key}`, kind: 'debt', title: debt.name, date: ev.date,
        detail: ev.label, amount: ev.amount, debt, ev, overdue: ev.date < today,
        status: (result.missed || []).includes(ev) ? 'missed' : debt.statuses?.[ev.key] || 'pending',
      }));
    });
    if (!debtId) {
      scheduledRepeatItems(data, today, today, true).forEach(item => dues.push(item));
      ['entries', 'investments'].forEach(key => (data[key] || []).forEach(record => {
        if (!record.planned || record.recurringId || record.date > today) return;
        dues.push({ id: `plan:${record.id}`, kind: 'planned', recordId: record.id, recordKey: key,
          title: record.name || record.note || record.category || 'Scheduled payment', date: record.date,
          detail: key === 'investments' ? 'Investment' : record.kind === 'income' ? 'Income' : 'Expense',
          direction: key === 'entries' && record.kind === 'income' || key === 'investments' && record.action === 'withdraw' ? 'in' : 'out',
          amount: record.amount, status: record.planStatus || 'pending', overdue: record.date < today,
        });
      }));
    }
    return dues.sort((a, b) => a.date.localeCompare(b.date));
  }, [data, debtId, today]);
  if (!all.length && !selected) return null;
  const shown = expanded ? all : all.slice(0, max);

  const mark = (item, status) => {
    if (item.kind === 'repeat') markScheduledRepeat(item.ruleId, item.month, status);
    else if (item.kind === 'planned') markOneOffPlan(item.recordKey, item.recordId, status);
    else if (item.kind === 'manualDebt') confirmManualDebtDue(item.debt.id, { status });
    else confirmDebtEvent(item.debt.id, item.ev, { status });
  };

  const save = ({ amount, date }) => {
    if (date > today) {
      Alert.alert('Choose an actual payment date', 'You can confirm a payment or receipt only after it happened.');
      return false;
    }
    if (selected.kind === 'planned') {
      confirmOneOffPlan(selected.recordKey, selected.recordId, { amount, date });
      return true;
    }
    if (selected.kind === 'repeat') {
      const match = findExistingPayment(data, selected.rule, amount, date);
      if (match) {
        Alert.alert('Possible duplicate', 'An identical manual transaction already exists. Link it to this schedule rather than add the amount again?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Link existing', onPress: () => confirmRepeatPayment(selected.ruleId, selected.month, { amount, date }, coverEarlier, match.id) },
        ]);
        return true;
      }
      confirmRepeatPayment(selected.ruleId, selected.month, { amount, date }, coverEarlier);
      return true;
    }
    if (selected.kind === 'manualDebt') {
      if (amount > selected.amount + 0.009) {
        Alert.alert('Amount exceeds this due', 'Record this payment up to the unpaid amount.');
        return false;
      }
      confirmManualDebtDue(selected.debt.id, { status: 'paid', amount, date });
      return true;
    }
    const isExtraSupported = selected.debt.kind === 'loan' || (selected.debt.kind === 'gold' && selected.debt.goldStyle === 'emi');
    if (amount > selected.amount + 0.009 && !isExtraSupported) {
      Alert.alert('Amount exceeds this due', 'Record this instalment up to the unpaid amount. For a separate payment, use the debt detail screen.');
      return false;
    }
    const linked = [...(data.entries || []), ...(data.investments || [])].some(r => r.debtId === selected.debt.id && r.debtEventKey === selected.ev.key && r.date === date && Number(r.amount) === amount);
    if (linked) {
      Alert.alert('Possible duplicate', 'This payment appears to have been recorded already. Review the existing transaction before confirming it again.');
      return false;
    }
    confirmDebtEvent(selected.debt.id, selected.ev, { status: 'paid', amount, date });
    return true;
  };

  return (
    <View style={[s.card, style]}>
      {all.length > 0 && (
        <View style={s.header}>
          <CalendarCheck size={18} color={C.warn} />
          <Text style={[T.h3, { flex: 1 }]}>{all.length === 1 ? 'Payment to confirm' : `${all.length} payments to confirm`}</Text>
        </View>
      )}
      {shown.map(item => (
        <View key={item.id} style={s.row}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[T.body, { fontWeight: '700' }]} numberOfLines={1}>{item.title}</Text>
            <Text style={T.small}>{`${item.detail} · ${fmtDate(item.date)} · ${fmt(item.amount)} remaining`}</Text>
            {item.status === 'missed' && <Text style={[T.small, { color: C.loss }]}>Marked not paid · you can record it later</Text>}
            {item.status === 'partial' && <Text style={T.small}>{`${fmt(item.allocated)} already allocated · partial payment`}</Text>}
            {item.status === 'later' && <Text style={T.small}>Awaiting your confirmation</Text>}
            <Pressable accessibilityRole="button" onPress={() => mark(item, 'later')} style={{ paddingTop: 3, alignSelf: 'flex-start' }}><Text style={[T.small, { color: C.invest, fontWeight: '700' }]}>Remind me later</Text></Pressable>
          </View>
          <Pressable onPress={() => mark(item, 'missed')} style={[s.btn, s.ghost]} accessibilityRole="button" accessibilityLabel={`${item.title} not paid`}>
            <Text style={s.ghostText}>Not paid</Text>
          </Pressable>
          <Pressable onPress={() => { setSelected(item); setCoverEarlier(false); }} style={[s.btn, s.paid]} accessibilityRole="button" accessibilityLabel={`${item.title} confirm payment`}>
            <Text style={s.paidText}>{item.direction === 'in' ? 'Received' : 'Paid'}</Text>
          </Pressable>
        </View>
      ))}
      {all.length > max && (
        <Pressable onPress={() => setExpanded(x => !x)} style={{ paddingTop: 12 }} accessibilityRole="button">
          <Text style={{ color: C.invest, fontWeight: '700' }}>{expanded ? 'Show fewer' : `Show all ${all.length}`}</Text>
        </Pressable>
      )}
      {selected && (
        <AmountDateDialog
          title={selected.direction === 'in' ? 'Confirm money received' : 'Confirm payment'}
          subtitle={`${selected.title} · ${fmtDate(selected.date)} · ${fmt(selected.amount)} outstanding. Only the amount actually paid or received will be recorded.`}
          initialAmount={selected.amount}
          initialDate={today}
          maximumDate={new Date()}
          dateLabel="Actual payment date"
          saveLabel="Confirm amount"
          switchLabel={selected.kind === 'repeat' && scheduledRepeatItems(data, today, today, true).some(i => i.ruleId === selected.ruleId && i.month < selected.month) ? 'Cover earlier unpaid months first' : undefined}
          switchInitial={coverEarlier}
          onSave={({ amount, date, switchOn }) => {
            setCoverEarlier(switchOn);
            return saveWithAllocation(amount, date, switchOn);
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </View>
  );

  function saveWithAllocation(amount, date, checked) {
    if (selected.kind === 'repeat') {
      // The latest switch value is provided directly by the dialog.
      const rule = selected.rule;
      const key = rule.tab === 'investment' ? 'investments' : 'entries';
      if ((data[key] || []).some(r => !r.planned && r.recurringId === rule.id && r.date === date && Number(r.amount) === amount && r.confirmationKey === `${rule.id}:${selected.month}`)) {
        Alert.alert('Already recorded', 'This amount on this date is already linked to the same monthly payment.');
        return false;
      }
      if (date > today) return save({ amount, date });
      const match = findExistingPayment(data, rule, amount, date);
      if (match) {
        Alert.alert('Possible duplicate', 'An identical manual transaction already exists. Link it instead of creating another?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Link existing', onPress: () => confirmRepeatPayment(selected.ruleId, selected.month, { amount, date }, checked, match.id) },
        ]);
        return true;
      }
      confirmRepeatPayment(selected.ruleId, selected.month, { amount, date }, checked);
      return true;
    }
    return save({ amount, date });
  }
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FFFAF1', borderWidth: 1, borderColor: '#EBD7AE', borderRadius: 19, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 13, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EBD7AE' },
  btn: { minHeight: 38, justifyContent: 'center', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 11 },
  ghost: { borderWidth: 1, borderColor: '#D9C9A5', backgroundColor: C.surface },
  paid: { backgroundColor: C.invest }, ghostText: { fontWeight: '700', fontSize: 12, color: C.inkSoft },
  paidText: { fontWeight: '700', fontSize: 12, color: C.white },
});
