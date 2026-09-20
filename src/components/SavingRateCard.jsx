import React, { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { PiggyBank } from 'lucide-react-native';
import { C, T } from '../theme';
import { savingRateChange, savingRateTrend } from '../data/leaks';
import { axisMonth, monthLabel, shortMonthName, thinLabels } from '../utils/dates';
import { fmt, pct } from '../utils/format';
import { Card, SectionHeader } from './ui';

const MONTHS_SHOWN = 6;
const Y_LABEL_W = 42;
const axisText = { color: C.muted, fontSize: 10 };

/**
 * Saving rate is (earned − spent) ÷ earned. It is the number the books agree matters most,
 * and it only means anything across several months, so this shows the last six.
 */
export default function SavingRateCard({ byMonth, month }) {
  const { width } = useWindowDimensions();
  const plotWidth = width - 32 - 32 - Y_LABEL_W - 8;

  const trend = useMemo(() => savingRateTrend(byMonth, month, MONTHS_SHOWN), [byMonth, month]);
  const change = useMemo(() => savingRateChange(trend), [trend]);
  const rated = trend.filter((t) => t.rate !== null);

  // Two months of income is the least that can show a direction
  if (rated.length < 2) return null;

  const latest = rated[rated.length - 1];
  const best = rated.reduce((top, t) => (t.rate > top.rate ? t : top), rated[0]);
  const values = trend.map((t) => (t.rate === null ? 0 : Math.max(0, Math.round(t.rate))));
  const top = Math.max(60, Math.ceil(Math.max(...values) / 10) * 10);
  const labels = thinLabels(trend.map((t) => axisMonth(t.key)), plotWidth / MONTHS_SHOWN, 10);

  const data = trend.map((t, i) => ({
    value: values[i],
    label: labels[i],
    labelTextStyle: axisText,
    hideDataPoint: t.rate === null, // months without income get no dot
  }));

  const rising = change && change.recent > change.older + 1;
  const falling = change && change.recent < change.older - 1;

  return (
    <Card>
      <SectionHeader
        title="Saving rate"
        subtitle="What you keep out of what you earn, by month"
        right={<PiggyBank size={18} color={C.invest} />}
      />

      <View style={s.headline}>
        <Text style={[s.big, T.num]}>{pct(latest.rate)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={T.small}>{monthLabel(latest.key)}</Text>
          <Text style={[T.small, { color: rising ? C.gain : falling ? C.loss : C.muted, fontWeight: rising || falling ? '700' : '400' }]}>
            {change
              ? `Last ${Math.ceil(change.months / 2)} months average ${pct(change.recent)}, against ${pct(change.older)} before`
              : ''}
          </Text>
        </View>
      </View>

      <LineChart
        data={data}
        color={C.invest}
        thickness={2.5}
        dataPointsColor={C.invest}
        dataPointsRadius={3.5}
        curved
        areaChart
        startFillColor={C.invest}
        endFillColor={C.invest}
        startOpacity={0.18}
        endOpacity={0.02}
        spacing={MONTHS_SHOWN > 1 ? plotWidth / (MONTHS_SHOWN - 1) : plotWidth}
        initialSpacing={0}
        endSpacing={0}
        width={plotWidth}
        height={130}
        maxValue={top}
        noOfSections={3}
        formatYLabel={(label) => `${Math.round(Number(label))}%`}
        yAxisLabelWidth={Y_LABEL_W}
        yAxisTextStyle={axisText}
        yAxisThickness={0}
        xAxisColor={C.line}
        rulesColor={C.lineSoft}
        rulesType="solid"
        disableScroll
      />

      <Text style={[T.small, { marginTop: 10 }]}>
        {`Best month so far: ${shortMonthName(best.key)} at ${pct(best.rate)}, keeping ${fmt(best.earned - best.spent)}.`}
      </Text>
    </Card>
  );
}

const s = StyleSheet.create({
  headline: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  big: { fontSize: 34, fontWeight: '800', letterSpacing: -1, color: C.ink },
});
