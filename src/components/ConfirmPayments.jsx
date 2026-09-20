import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarCheck } from 'lucide-react-native';
import { C, T } from '../theme';
import { useData } from '../data/DataContext';
import { pendingConfirmations } from '../data/debts';
import { fmtDate } from '../utils/dates';
import { fmt } from '../utils/format';

// "Payments to confirm" card. Paid adds the expense (or chit investment); Not paid keeps it owed.
export default function ConfirmPayments({ debtId, style, max = 3 }) {
  const { data, confirmDebtEvent } = useData();
  const [expanded, setExpanded] = useState(false);
  const all = pendingConfirmations(data.debts).filter((p) => !debtId || p.debt.id === debtId);
  if (!all.length) return null;
  const shown = expanded ? all : all.slice(0, max);

  return (
    <View style={[s.card, style]}>
      <View style={s.header}>
        <CalendarCheck size={18} color={C.warn} />
        <Text style={[T.h3, { flex: 1 }]}>{all.length === 1 ? 'Payment to confirm' : `${all.length} payments to confirm`}</Text>
      </View>
      {shown.map(({ debt, ev }) => (
        <View key={`${debt.id}-${ev.key}`} style={s.row}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{debt.name}</Text>
            <Text style={T.small}>{`${ev.label}, ${fmtDate(ev.date)}, ${fmt(ev.amount)}`}</Text>
          </View>
          <Pressable
            onPress={() => confirmDebtEvent(debt.id, ev, false)}
            style={[s.btn, s.btnGhost]}
            accessibilityRole="button"
            accessibilityLabel={`${debt.name} ${ev.label} not paid`}
          >
            <Text style={{ fontWeight: '700', color: C.inkSoft }}>Not paid</Text>
          </Pressable>
          <Pressable
            onPress={() => confirmDebtEvent(debt.id, ev, true)}
            style={[s.btn, { backgroundColor: C.invest }]}
            accessibilityRole="button"
            accessibilityLabel={`${debt.name} ${ev.label} paid`}
          >
            <Text style={{ fontWeight: '700', color: C.white }}>Paid</Text>
          </Pressable>
        </View>
      ))}
      {all.length > max && (
        <Pressable onPress={() => setExpanded((e) => !e)} style={{ paddingTop: 10 }} accessibilityRole="button">
          <Text style={{ color: C.invest, fontWeight: '700' }}>{expanded ? 'Show fewer' : `Show all ${all.length}`}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FBF4E6', borderWidth: 1, borderColor: '#EBD7AE', borderRadius: 16, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EBD7AE' },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  btnGhost: { borderWidth: 1, borderColor: '#D9C9A5', backgroundColor: C.surface },
});
