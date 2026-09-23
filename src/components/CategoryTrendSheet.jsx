import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { Target, TrendingDown, TrendingUp } from 'lucide-react-native';
import { C, T, categoryColor, faded } from '../theme';
import { useData } from '../data/DataContext';
import { budgetFor } from '../data/compute';
import {
  addMonths, addWeeks, axisMonthShort, axisWeekStart, currentMonth, currentWeek, fmtDate, monthKey, monthLabel,
  thinLabels, todayStr, weekLabel, weekStart,
} from '../utils/dates';
import { compact, fmt, niceMax, pct } from '../utils/format';
import SheetScreen from './SheetScreen';
import { Card, GhostButton, KpiGrid, SectionHeader, Segmented } from './ui';

const PERIODS_SHOWN = 6;
const Y_LABEL_W = 46;
const axisText = { color: C.muted, fontSize: 10 };
const axisLabel = { color: C.muted, fontSize: 11, fontWeight: '500' };

/**
 * Everything about one spending category: how it has moved over the last year,
 * how it compares with its own average, and what made up any given month.
 */
export default function CategoryTrendSheet({ category, onClose, onOpenBudgets }) {
  const { data } = useData();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState('monthly');
  const weekly = period === 'weekly';
  const cur = weekly ? currentWeek() : currentMonth();
  const [selected, setSelected] = useState(cur);
  const periodWord = weekly ? 'week' : 'month';

  // Switching between weeks and months moves the selection to the matching current period
  const changePeriod = (next) => {
    setPeriod(next);
    setSelected(next === 'weekly' ? currentWeek() : currentMonth());
  };

  const plotWidth = width - 32 - 32 - Y_LABEL_W - 8;
  const color = categoryColor(category);

  const months = useMemo(() => {
    const totals = {};
    data.entries.forEach((e) => {
      if (e.planned || e.date > todayStr() || e.kind !== 'expense' || e.category !== category) return;
      const k = weekly ? weekStart(e.date) : monthKey(e.date);
      totals[k] = (totals[k] || 0) + e.amount;
    });
    return Array.from({ length: PERIODS_SHOWN }, (_, i) => {
      const step = i - (PERIODS_SHOWN - 1);
      const k = weekly ? addWeeks(cur, step) : addMonths(cur, step);
      return { key: k, total: Math.round(totals[k] || 0) };
    });
  }, [data.entries, category, cur, weekly]);

  const stats = useMemo(() => {
    const spent = months.filter((m) => m.total > 0);
    const total = months.reduce((sum, m) => sum + m.total, 0);
    const average = spent.length ? total / spent.length : 0;
    const highest = months.reduce((top, m) => (m.total > top.total ? m : top), months[0]);
    // The recent half against the older half, so "rising" means something
    const recent = months.slice(-3).reduce((sum, m) => sum + m.total, 0) / 3;
    const older = months.slice(0, 3).reduce((sum, m) => sum + m.total, 0) / 3;
    const direction = older > 0 ? ((recent - older) / older) * 100 : null;
    return { total, average, highest, recent, older, direction, monthsWithSpend: spent.length };
  }, [months]);

  const entries = useMemo(
    () =>
      data.entries
        .filter((e) => !e.planned && e.date <= todayStr() && e.kind === 'expense' && e.category === category && (weekly ? weekStart(e.date) : monthKey(e.date)) === selected)
        .sort((a, b) => b.amount - a.amount),
    [data.entries, category, selected, weekly]
  );

  const budget = budgetFor(data, category, period);

  // Six wide bars, each with its own label and its value printed above
  const slot = plotWidth / PERIODS_SHOWN;
  const barWidth = Math.min(30, Math.max(18, Math.round(slot * 0.52)));
  const initialSpacing = Math.round((slot - barWidth) / 2);
  const spacing = Math.max(8, slot - barWidth);
  const withYear = slot >= 62;
  const labels = thinLabels(
    months.map((m) => (weekly ? axisWeekStart(m.key, withYear) : axisMonthShort(m.key))),
    slot,
    11
  );
  const maxValue = niceMax(Math.max(budget || 0, ...months.map((m) => m.total)) * 1.18);

  const bars = months.map((m, i) => {
    const on = m.key === selected;
    return {
      value: m.total,
      label: labels[i],
      labelTextStyle: { ...axisLabel, color: on ? C.ink : C.muted, fontWeight: on ? '700' : '500' },
      labelWidth: Math.round(slot),
      frontColor: on ? color : faded(color),
      onPress: () => setSelected(m.key),
      // eslint-disable-next-line react/no-unstable-nested-components
      topLabelComponent: () => <BarValue amount={m.total} selected={on} />,
    };
  });

  const selectedTotal = months.find((m) => m.key === selected)?.total || 0;
  const vsAverage = stats.average > 0 ? ((selectedTotal - stats.average) / stats.average) * 100 : null;
  const Direction = stats.direction !== null && stats.direction < 0 ? TrendingDown : TrendingUp;

  return (
    <SheetScreen title={category} subtitle={weekly ? 'Last 6 weeks' : 'Last 6 months'} onClose={onClose} keyboardAware={false}>
          <Segmented options={[['weekly', 'Week'], ['monthly', 'Month']]} value={period} onChange={changePeriod} />

          <KpiGrid
            items={[
              { label: `Average a ${periodWord}`, value: fmt(stats.average), note: `Across ${stats.monthsWithSpend} ${stats.monthsWithSpend === 1 ? periodWord : `${periodWord}s`} with spending` },
              { label: 'Total shown', value: compact(stats.total) },
              {
                label: 'Highest',
                value: compact(stats.highest.total),
                note: stats.highest.total > 0 ? (weekly ? weekLabel(stats.highest.key) : monthLabel(stats.highest.key)) : '',
              },
            ]}
          />

          <Card>
            <SectionHeader title={weekly ? 'Week by week' : 'Month by month'} subtitle="Tap a bar to see what made it up" />
            <BarChart
              data={bars}
              barWidth={barWidth}
              spacing={spacing}
              initialSpacing={initialSpacing}
              endSpacing={4}
              width={plotWidth}
              height={186}
              maxValue={maxValue}
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
              showReferenceLine1={budget > 0}
              referenceLine1Position={budget || 0}
              referenceLine1Config={{ color: C.warn, dashWidth: 4, dashGap: 4, thickness: 1 }}
            />
            {budget > 0 ? (
              <Text style={[T.small, { marginTop: 8 }]}>{`Dashed line: your ${periodWord}ly limit of ${fmt(budget)}`}</Text>
            ) : (
              onOpenBudgets && (
                <GhostButton
                  label={`Set a ${periodWord}ly limit`}
                  color={C.invest}
                  icon={<Target size={15} color={C.invest} />}
                  onPress={onOpenBudgets}
                  style={{ marginTop: 12 }}
                />
              )
            )}
          </Card>

          {stats.direction !== null && Math.abs(stats.direction) >= 10 && (
            <View style={s.trendNote}>
              <Direction size={18} color={stats.direction > 0 ? C.loss : C.gain} />
              <Text style={[T.body, { flex: 1 }]}>
                {`Last 3 ${periodWord}s average ${fmt(stats.recent)} a ${periodWord}, against ${fmt(stats.older)} in the 3 before.`}
              </Text>
            </View>
          )}

          <Card>
            <SectionHeader
              title={weekly ? weekLabel(selected) : monthLabel(selected)}
              subtitle={
                selectedTotal === 0
                  ? 'Nothing logged in this category'
                  : vsAverage === null
                    ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
                    : `${fmt(selectedTotal)} across ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}, ${
                        Math.abs(vsAverage) < 5 ? 'about average' : `${pct(Math.abs(vsAverage))} ${vsAverage > 0 ? 'above' : 'below'} average`
                      }`
              }
            />
            {entries.map((e) => (
              <View key={e.id} style={s.row}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{e.note || e.category}</Text>
                  <Text style={T.small}>{`${fmtDate(e.date)} · ${e.mode}`}</Text>
                </View>
                <Text style={[T.body, T.num, { fontWeight: '700' }]}>{fmt(e.amount)}</Text>
              </View>
            ))}
          </Card>
    </SheetScreen>
  );
}

// The amount printed above each bar
function BarValue({ amount, selected }) {
  if (!amount) return null;
  return (
    <Text style={[s.barValue, selected && { color: C.ink, fontWeight: '800' }]} numberOfLines={1}>
      {compact(amount)}
    </Text>
  );
}

const s = StyleSheet.create({
  barValue: { fontSize: 10, fontWeight: '700', color: C.muted, marginBottom: 3, textAlign: 'center', width: 52 },
  trendNote: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft },
});
