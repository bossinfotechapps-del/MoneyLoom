import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { C, T, categoryColor, faded } from '../theme';
import { useData } from '../data/DataContext';
import { ZERO_MONTH } from '../data/constants';
import {
  addFY, axisMonth, currentFY, currentMonth, fyEnd, fyFirstDay, fyLabel, fyMonths, thinLabels, todayStr,
} from '../utils/dates';
import { compact, fmt, fmtSigned, niceMax, pct } from '../utils/format';
import { Bar, Card, Dot, KpiGrid, SectionHeader, Segmented } from '../components/ui';

const SCREEN_PAD = 16;
const CARD_PAD = 16;
const Y_LABEL_W = 46;
const axisText = { color: C.muted, fontSize: 10 };

/**
 * The Indian financial year, 1 April to 31 March: the window people actually file against.
 * Tapping a month opens that month in the monthly view.
 */
export default function FYOverview({ fy, setFY, period, setPeriod, onOpenMonth, bottomSpace }) {
  const { data, byMonth } = useData();
  const { width } = useWindowDimensions();
  const plotWidth = width - SCREEN_PAD * 2 - CARD_PAD * 2 - Y_LABEL_W - 8;

  const cur = currentFY();
  const thisMonth = currentMonth();
  const months = useMemo(() => fyMonths(fy), [fy]);

  const totals = useMemo(() => {
    const sum = (list) =>
      list.reduce(
        (acc, k) => {
          const t = byMonth[k] || ZERO_MONTH;
          return { earned: acc.earned + t.earned, spent: acc.spent + t.spent, invested: acc.invested + t.invested };
        },
        { earned: 0, spent: 0, invested: 0 }
      );
    const elapsed = months.filter((k) => k <= thisMonth);
    const thisFY = sum(fy === cur ? elapsed : months);
    const lastFY = sum(fyMonths(addFY(fy, -1)).slice(0, fy === cur ? elapsed.length : 12));
    return { thisFY, lastFY, monthsCounted: fy === cur ? elapsed.length : 12 };
  }, [byMonth, months, fy, cur, thisMonth]);

  const cats = useMemo(() => {
    const from = fyFirstDay(fy);
    const to = fyEnd(fy);
    const prevFrom = fyFirstDay(addFY(fy, -1));
    const prevTo = fyEnd(addFY(fy, -1));
    const t = {};
    const p = {};
    data.entries.forEach((e) => {
      if (e.planned || e.date > todayStr() || e.kind !== 'expense') return;
      if (e.date >= from && e.date <= to) t[e.category] = (t[e.category] || 0) + e.amount;
      else if (e.date >= prevFrom && e.date <= prevTo) p[e.category] = (p[e.category] || 0) + e.amount;
    });
    return Object.entries(t)
      .map(([name, amt]) => ({ name, amt, prev: p[name] || 0 }))
      .sort((a, b) => b.amt - a.amt)
      .slice(0, 8);
  }, [data.entries, fy]);

  const { thisFY, lastFY, monthsCounted } = totals;
  const left = thisFY.earned - thisFY.spent - thisFY.invested;
  const spendChange = lastFY.spent > 0 ? ((thisFY.spent - lastFY.spent) / lastFY.spent) * 100 : null;
  const saveRate = thisFY.earned > 0 ? ((thisFY.earned - thisFY.spent) / thisFY.earned) * 100 : null;

  // Twelve months, April first
  const barWidth = 13;
  const initialSpacing = 8;
  const spacing = Math.max(5, (plotWidth - initialSpacing - 12 * barWidth) / 12);
  const labels = thinLabels(months.map((k) => axisMonth(k)), barWidth + spacing, 10);
  const maxValue = niceMax(Math.max(...months.map((k) => {
    const t = byMonth[k] || ZERO_MONTH;
    return Math.max(t.earned, t.spent + Math.max(t.invested, 0));
  })));

  const stackData = months.map((k, i) => {
    const t = byMonth[k] || ZERO_MONTH;
    const isNow = k === thisMonth;
    const open = () => onOpenMonth(k);
    return {
      label: labels[i],
      labelTextStyle: { ...axisText, color: isNow ? C.ink : C.muted, fontWeight: isNow ? '700' : '400' },
      labelWidth: barWidth + spacing,
      onPress: open,
      topLabelComponent: () => (t.spent + Math.max(t.invested, 0) > 0 ? (
        <Text style={{ color: C.ink, fontSize: 9, fontWeight: '700', textAlign: 'center', minWidth: 30 }} numberOfLines={1}>
          {compact(t.spent + Math.max(t.invested, 0))}
        </Text>
      ) : null),
      stacks: [
        { value: Math.max(t.spent, 0), color: isNow ? C.spend : faded(C.spend), onPress: open },
        { value: Math.max(t.invested, 0), color: isNow ? C.invest : faded(C.invest), onPress: open, marginBottom: 1 },
      ],
    };
  });

  const biggestCat = cats[0];

  return (
    <ScrollView contentContainerStyle={{ padding: SCREEN_PAD, paddingBottom: bottomSpace, gap: 16 }}>
      <Text style={{ color: C.invest, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, paddingHorizontal: 2 }}>YOUR OVERVIEW</Text>
      <Segmented options={[['weekly', 'Week'], ['monthly', 'Month'], ['fy', 'FY']]} value={period} onChange={setPeriod} />

      <View>
        <View style={s.headRow}>
          <Pressable onPress={() => setFY(addFY(fy, -1))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous financial year">
            <ChevronLeft size={26} color={C.ink} />
          </Pressable>
          <Text style={[T.h1, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>{fyLabel(fy)}</Text>
          <Pressable
            onPress={() => fy < cur && setFY(addFY(fy, 1))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Next financial year"
            style={{ opacity: fy < cur ? 1 : 0.25 }}
          >
            <ChevronRight size={26} color={C.ink} />
          </Pressable>
        </View>
        <Text style={[T.small, { textAlign: 'center' }]}>
          {`1 April ${fy.slice(0, 4)} to 31 March ${Number(fy.slice(0, 4)) + 1}${fy === cur ? `, ${monthsCounted} ${monthsCounted === 1 ? 'month' : 'months'} so far` : ''}`}
        </Text>
      </View>

      <KpiGrid
        items={[
          { label: 'Earned', value: compact(thisFY.earned), color: C.earn, note: lastFY.earned ? `${compact(lastFY.earned)} last FY` : '' },
          {
            label: 'Spent',
            value: compact(thisFY.spent),
            color: C.spend,
            note: spendChange === null ? 'No last-FY figure' : `${pct(Math.abs(spendChange))} ${spendChange > 0 ? 'more' : 'less'} than last FY`,
            noteColor: spendChange === null ? C.muted : spendChange > 0 ? C.loss : C.gain,
          },
          { label: 'Invested', value: compact(thisFY.invested), color: C.invest, note: thisFY.earned > 0 ? `${pct((thisFY.invested / thisFY.earned) * 100)} of income` : '' },
          { label: 'Left over', value: compact(left), color: left < 0 ? C.loss : C.ink, note: saveRate === null ? '' : `Saving rate ${pct(saveRate)}` },
        ]}
      />

      <Card>
        <SectionHeader title="Month by month" subtitle="April to March. Tap a month to open it." />
        <View style={s.legend}>
          <View style={s.legendItem}><Dot color={C.spend} /><Text style={T.small}>Spent</Text></View>
          <View style={s.legendItem}><Dot color={C.invest} /><Text style={T.small}>Invested</Text></View>
        </View>
        <BarChart
          stackData={stackData}
          barWidth={barWidth}
          spacing={spacing}
          initialSpacing={initialSpacing}
          endSpacing={4}
          width={plotWidth}
          height={180}
          maxValue={maxValue * 1.18}
          noOfSections={4}
          formatYLabel={(label) => compact(Number(label))}
          yAxisLabelWidth={Y_LABEL_W}
          yAxisTextStyle={axisText}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={C.line}
          rulesColor={C.lineSoft}
          rulesType="solid"
          disableScroll
        />
      </Card>

      <Card>
        <SectionHeader title="Where the year went" subtitle="Top categories, against the same point last FY" />
        {cats.length === 0 ? (
          <Text style={T.small}>Nothing logged in this financial year.</Text>
        ) : (
          <View style={{ gap: 14 }}>
            {cats.map((c) => {
              const diff = c.amt - c.prev;
              return (
                <Pressable key={c.name} onPress={() => onOpenMonth(null, c.name)} accessibilityRole="button" accessibilityLabel={`${c.name}, ${fmt(c.amt)}`}>
                  <View style={s.rowBetween}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Dot color={categoryColor(c.name)} />
                      <Text style={[T.body, { fontWeight: '600', flex: 1 }]} numberOfLines={1}>{c.name}</Text>
                    </View>
                    <Text style={[T.body, T.num, { fontWeight: '700' }]}>{fmt(c.amt)}</Text>
                  </View>
                  <View style={{ marginVertical: 5 }}>
                    <Bar ratio={biggestCat.amt ? c.amt / biggestCat.amt : 0} color={C.spend} />
                  </View>
                  <View style={s.rowBetween}>
                    <Text style={T.small}>{thisFY.spent > 0 ? `${pct((c.amt / thisFY.spent) * 100)} of the year` : ''}</Text>
                    <Text style={[T.small, { color: c.prev === 0 ? C.muted : diff > 0 ? C.loss : C.gain }]}>
                      {c.prev === 0 ? 'New this FY' : `${fmtSigned(diff)} vs last FY`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      <Card>
        <SectionHeader title="Invested this financial year" />
        <Text style={[s.big, T.num]}>{fmt(thisFY.invested)}</Text>
        <Text style={[T.small, { marginTop: 4, lineHeight: 19 }]}>
          Everything logged under investments between 1 April and 31 March, including SIPs, PPF, NPS and chits.
          Useful when you gather papers at tax time. MoneyLoom doesn’t give tax advice.
        </Text>
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legend: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  big: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, color: C.invest, marginTop: 2 },
});
