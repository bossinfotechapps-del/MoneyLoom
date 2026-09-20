import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, T } from '../theme';
import { useData } from '../data/DataContext';
import { canPlanPayoff, computeDebt, payoffComparison, payoffOrder } from '../data/debts';
import { addMonthsDate, monthYear, todayStr } from '../utils/dates';
import { fmt, pct } from '../utils/format';
import SheetScreen from './SheetScreen';
import { Card, GhostButton, KpiGrid, SectionHeader, Segmented } from './ui';

// Round amounts people actually pay
const STEPS = [500, 1000, 2000, 5000, 10000];

const monthsText = (months) => {
  if (months === null || months === undefined) return '—';
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years}y ${rest}m` : `${years} ${years === 1 ? 'year' : 'years'}`;
};

/**
 * What paying a bit more each month would do. Everything shown is arithmetic on the
 * person's own loan: no recommendation about whether to prepay.
 */
export default function PayoffPlannerSheet({ debtId, onClose }) {
  const { data } = useData();
  const today = todayStr();
  const [extra, setExtra] = useState(STEPS[1]);
  const [method, setMethod] = useState('interest');
  const [focusId, setFocusId] = useState(debtId || null);

  const planable = useMemo(
    () => (data.debts || []).map((d) => ({ debt: d, result: computeDebt(d, today) })).filter(({ debt, result }) => canPlanPayoff(debt, result)),
    [data.debts, today]
  );

  const order = useMemo(() => payoffOrder(data.debts, method, today), [data.debts, method, today]);
  const focus = planable.find(({ debt }) => debt.id === (focusId || order[0]?.id)) || planable[0];
  const plan = useMemo(() => (focus ? payoffComparison(focus.debt, extra, today) : null), [focus, extra, today]);

  if (!planable.length || !plan) {
    return (
      <SheetScreen title="Pay off sooner" onClose={onClose}>
        <Text style={T.body}>No loans to plan with. Add a loan under Wealth and this shows what paying extra would do.</Text>
      </SheetScreen>
    );
  }

  const { now, faster, monthsSaved, interestSaved } = plan;
  const endNow = now.months ? addMonthsDate(today, now.months) : null;
  const endFaster = faster.months ? addMonthsDate(today, faster.months) : null;

  return (
    <SheetScreen title="Pay off sooner" subtitle={focus.debt.name} onClose={onClose}>
      {planable.length > 1 && (
        <Card>
          <SectionHeader title="Which loan" subtitle="Pick the one you'd put extra into" />
          <View style={s.chips}>
            {planable.map(({ debt, result }) => {
              const on = debt.id === focus.debt.id;
              return (
                <Pressable
                  key={debt.id}
                  onPress={() => setFocusId(debt.id)}
                  style={[s.chip, on && s.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[s.chipText, on && { color: C.white }]} numberOfLines={1}>
                    {`${debt.name} · ${fmt(result.owed)}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      )}

      <Card>
        <SectionHeader
          title="Extra each month"
          subtitle={`On top of ${focus.result.emi > 0 ? `the ${fmt(focus.result.emi)} instalment` : 'what you pay now'}`}
        />
        <View style={s.chips}>
          {STEPS.map((amount) => {
            const on = amount === extra;
            return (
              <Pressable
                key={amount}
                onPress={() => setExtra(amount)}
                style={[s.chip, on && s.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[s.chipText, on && { color: C.white }]}>{fmt(amount)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: 16 }}>
          <KpiGrid
            items={[
              { label: 'Debt-free', value: endFaster ? monthYear(endFaster) : '—', color: C.gain, note: endNow ? `instead of ${monthYear(endNow)}` : '' },
              { label: 'Sooner by', value: monthsText(monthsSaved), color: C.gain },
              { label: 'Interest saved', value: interestSaved !== null ? fmt(interestSaved) : '—', color: C.gain },
            ]}
          />
        </View>

        <Text style={[T.small, { marginTop: 12, lineHeight: 19 }]}>
          {faster.neverEnds
            ? 'At this rate the payment doesn’t cover the monthly interest, so the balance never clears.'
            : `Paying ${fmt(faster.monthly)} a month clears ${fmt(focus.result.owed)} in ${monthsText(faster.months)}, against ${monthsText(now.months)} at ${fmt(now.monthly)}.`}
        </Text>
        <Text style={[T.small, { marginTop: 8 }]}>Check with your lender first. Some loans charge a fee for paying early.</Text>
      </Card>

      {planable.length > 1 && (
        <Card>
          <SectionHeader title="Which one first" subtitle="Two common orders, both keeping minimums on the rest" />
          <Segmented
            options={[['interest', 'Costliest first'], ['balance', 'Smallest first']]}
            value={method}
            onChange={setMethod}
          />
          <View style={{ marginTop: 12 }}>
            {order.map((item) => (
              <View key={item.id} style={s.row}>
                <View style={s.position}>
                  <Text style={{ fontWeight: '800', color: C.invest }}>{item.position}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={T.small}>
                    {item.rate > 0 ? `${pct(item.rate, 1)} a year · about ${fmt(item.monthlyInterest)} interest a month` : 'No interest'}
                  </Text>
                </View>
                <Text style={[T.body, T.num, { fontWeight: '700' }]}>{fmt(item.owed)}</Text>
              </View>
            ))}
          </View>
          <Text style={[T.small, { marginTop: 12, lineHeight: 19 }]}>
            {method === 'interest'
              ? 'Costliest first pays the least interest overall.'
              : 'Smallest first clears one debt sooner, which some people find easier to keep up.'}
          </Text>
          {order[0] && order[0].id !== focus.debt.id && (
            <GhostButton label={`Plan for ${order[0].name}`} color={C.invest} onPress={() => setFocusId(order[0].id)} style={{ marginTop: 12 }} />
          )}
        </Card>
      )}
    </SheetScreen>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.chip, borderWidth: 1, borderColor: C.chip, maxWidth: '100%' },
  chipOn: { backgroundColor: C.invest, borderColor: C.invest },
  chipText: { fontSize: 13, fontWeight: '600', color: C.inkSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft },
  position: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E1F0ED', alignItems: 'center', justifyContent: 'center' },
});
