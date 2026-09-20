import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarClock, TriangleAlert } from 'lucide-react-native';
import { C, T } from '../theme';
import { useData } from '../data/DataContext';
import { computeUpcoming } from '../data/upcoming';
import { fmtDate, todayStr } from '../utils/dates';
import { fmt } from '../utils/format';
import { Card, SectionHeader } from './ui';

const SHOW_FIRST = 5;

// "Today", "Tomorrow", then "in 4 days" up to a week out, then the date
function whenLabel(date, today) {
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
  if (days <= 0) return 'Due now';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return `In ${days} days`;
  return fmtDate(date);
}

export default function UpcomingCard({ days = 30, onOpenAll }) {
  const { data } = useData();
  const today = todayStr();
  const [expanded, setExpanded] = useState(false);
  const upcoming = useMemo(() => computeUpcoming(data, today, days), [data, today, days]);

  if (!upcoming.items.length) return null;
  const shown = expanded ? upcoming.items : upcoming.items.slice(0, SHOW_FIRST);

  return (
    <Card>
      <SectionHeader
        title={`Next ${days} days`}
        subtitle="Payments from your loans, cards and monthly repeats"
        right={
          onOpenAll ? (
            <Pressable onPress={onOpenAll} hitSlop={8} accessibilityRole="button" accessibilityLabel="See all EMIs and dues">
              <Text style={{ color: C.invest, fontWeight: '700', fontSize: 13 }}>See all</Text>
            </Pressable>
          ) : null
        }
      />

      <View style={s.totals}>
        <View style={s.totalBox}>
          <Text style={T.small}>Going out</Text>
          <Text style={[T.num, s.totalValue, { color: C.spend }]}>{fmt(upcoming.out)}</Text>
        </View>
        <View style={s.totalBox}>
          <Text style={T.small}>Coming in</Text>
          <Text style={[T.num, s.totalValue, { color: C.earn }]}>{fmt(upcoming.in)}</Text>
        </View>
      </View>

      {upcoming.overdue > 0 && (
        <View style={s.overdue}>
          <TriangleAlert size={16} color={C.loss} />
          <Text style={[T.small, { color: C.loss, fontWeight: '700', flex: 1 }]}>
            {`${fmt(upcoming.overdue)} is waiting for you to confirm as paid.`}
          </Text>
        </View>
      )}

      <View style={{ marginTop: 6 }}>
        {shown.map((item) => (
          <View key={item.id} style={s.row}>
            <View style={s.dateCol}>
              <CalendarClock size={15} color={item.overdue ? C.loss : C.muted} />
              <Text style={[T.small, item.overdue && { color: C.loss, fontWeight: '700' }]} numberOfLines={1}>
                {item.overdue ? 'Confirm' : whenLabel(item.date, today)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{item.title}</Text>
              <Text style={T.small} numberOfLines={1}>{item.detail}</Text>
            </View>
            <Text style={[T.body, T.num, { fontWeight: '700', color: item.direction === 'in' ? C.earn : C.ink }]}>
              {item.direction === 'in' ? '+' : ''}{fmt(item.amount)}
            </Text>
          </View>
        ))}
      </View>

      {upcoming.items.length > SHOW_FIRST && (
        <Pressable onPress={() => setExpanded((v) => !v)} style={{ paddingTop: 10 }} accessibilityRole="button">
          <Text style={{ color: C.invest, fontWeight: '700' }}>
            {expanded ? 'Show fewer' : `Show all ${upcoming.items.length}`}
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  totals: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  totalBox: { flex: 1, backgroundColor: C.paper, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  totalValue: { fontSize: 17, fontWeight: '800', marginTop: 2 },
  overdue: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FCEBEB', borderRadius: 10, padding: 10, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft },
  dateCol: { width: 92, flexDirection: 'row', alignItems: 'center', gap: 5 },
});
