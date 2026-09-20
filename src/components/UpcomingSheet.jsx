import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CalendarClock, TriangleAlert } from 'lucide-react-native';
import { C, T } from '../theme';
import { useData } from '../data/DataContext';
import { computeUpcoming } from '../data/upcoming';
import { fmtDate, monthKey, monthLabel, todayStr } from '../utils/dates';
import { fmt } from '../utils/format';
import ConfirmPayments from './ConfirmPayments';
import SheetScreen from './SheetScreen';
import { Card, KpiGrid, SectionHeader, Segmented } from './ui';

const RANGES = [
  ['30', 'Next 30 days'],
  ['60', 'Next 60 days'],
  ['90', 'Next 90 days'],
];

const daysFrom = (date, today) => Math.round((Date.parse(date) - Date.parse(today)) / 86400000);

const whenLabel = (date, today) => {
  const days = daysFrom(date, today);
  if (days <= 0) return 'Due now';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return `In ${days} days`;
  return fmtDate(date);
};

/** Everything due ahead: EMIs, gold loan interest, card bills, instalments, chits and repeats. */
export default function UpcomingSheet({ onClose }) {
  const { data } = useData();
  const today = todayStr();
  const [range, setRange] = useState('30');
  const days = Number(range);

  const upcoming = useMemo(() => computeUpcoming(data, today, days), [data, today, days]);

  // Grouped by month, so a 90-day view reads as three lists rather than one long one
  const groups = useMemo(() => {
    const out = [];
    upcoming.items.forEach((item) => {
      const key = monthKey(item.date);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(item);
      else out.push({ key, items: [item] });
    });
    return out.map((g) => ({
      ...g,
      out: g.items.filter((i) => i.direction === 'out').reduce((sum, i) => sum + i.amount, 0),
    }));
  }, [upcoming.items]);

  return (
    <SheetScreen title="EMIs and dues" subtitle="What's coming, and when" onClose={onClose}>
          <Segmented options={RANGES} value={range} onChange={setRange} />

          <ConfirmPayments />

          <KpiGrid
            items={[
              { label: 'Going out', value: fmt(upcoming.out), color: C.spend, note: `${upcoming.items.filter((i) => i.direction === 'out').length} payments` },
              { label: 'Coming in', value: fmt(upcoming.in), color: C.earn },
            ]}
          />

          {upcoming.overdue > 0 && (
            <View style={s.alert}>
              <TriangleAlert size={18} color={C.loss} />
              <Text style={[T.body, { flex: 1, color: C.loss, fontWeight: '600' }]}>
                {`${fmt(upcoming.overdue)} is already past its date.`}
              </Text>
            </View>
          )}

          {groups.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
              <CalendarClock size={26} color={C.muted} />
              <Text style={[T.body, { color: C.muted, marginTop: 10, textAlign: 'center' }]}>
                {`Nothing due in the next ${days} days. Loans, cards and monthly repeats show up here.`}
              </Text>
            </Card>
          ) : (
            groups.map((group) => (
              <Card key={group.key} style={{ paddingHorizontal: 0, paddingVertical: 6 }}>
                <View style={{ paddingHorizontal: 16 }}>
                  <SectionHeader title={monthLabel(group.key)} subtitle={`${fmt(group.out)} going out`} />
                </View>
                {group.items.map((item) => {
                  const overdue = daysFrom(item.date, today) < 0;
                  const incoming = item.direction === 'in';
                  return (
                    <View key={item.id} style={s.row}>
                      <View style={s.when}>
                        <Text style={[T.small, overdue && { color: C.loss, fontWeight: '700' }]}>{whenLabel(item.date, today)}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{item.title}</Text>
                        <Text style={T.small} numberOfLines={1}>{item.detail}</Text>
                      </View>
                      <Text style={[T.body, T.num, { fontWeight: '700', color: incoming ? C.earn : C.ink }]}>
                        {incoming ? '+' : ''}{fmt(item.amount)}
                      </Text>
                    </View>
                  );
                })}
              </Card>
            ))
          )}

          <Text style={[T.small, { textAlign: 'center' }]}>
            Dates come from your loans, card due dates and monthly repeats. Payments you've already recorded aren't listed again.
          </Text>
    </SheetScreen>
  );
}

const s = StyleSheet.create({
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FCEBEB', borderRadius: 14, padding: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft,
  },
  when: { width: 76 },
});
