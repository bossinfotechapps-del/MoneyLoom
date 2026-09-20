import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { ChevronLeft, ChevronRight, Landmark, Plus, Target } from 'lucide-react-native';
import { C, OTHER_SLICE_COLOR, T, categoryColor, faded } from '../theme';
import { ZERO_MONTH } from '../data/constants';
import { budgetFor, budgetStatus } from '../data/compute';
import { findLeaks } from '../data/leaks';
import { useData } from '../data/DataContext';
import {
  MONTHS_LONG, addMonths, addWeeks, axisMonthShort, axisWeekStart, currentMonth, currentWeek, daysInMonth, fmtDate, monthKey, thinLabels,
  monthLabel, shortMonthName, todayStr, weekEnd, weekLabel, weekStart,
} from '../utils/dates';
import { compact, fmt, fmtSigned, niceMax, pct } from '../utils/format';
import { Bar, Card, Dot, EmptyState, GhostButton, IconButton, KpiGrid, PrimaryButton, SectionHeader, Segmented } from '../components/ui';
import ConfirmPayments from '../components/ConfirmPayments';
import LeaksCard from '../components/LeaksCard';
import CategoryTrendSheet from '../components/CategoryTrendSheet';
import SavingRateCard from '../components/SavingRateCard';
import UpcomingCard from '../components/UpcomingCard';
import UpcomingSheet from '../components/UpcomingSheet';

const SCREEN_PAD = 16;
const CARD_PAD = 16;
const Y_LABEL_W = 46;

const axisText = { color: C.muted, fontSize: 10 };
const axisLabel = { color: C.muted, fontSize: 11, fontWeight: '500' };
const yLabel = (label) => compact(Number(label));

export default function OverviewScreen({
  period, setPeriod, month, setMonth, week, setWeek, onAdd, onLoadSample, onOpenWealth, onOpenBudgets, bottomSpace,
}) {
  const { data, byMonth, byWeek, netWorth } = useData();
  const { width } = useWindowDimensions();
  const weekly = period === 'weekly';

  // One set of names for whichever period is on screen, so the rest of the screen doesn't branch
  const cur = weekly ? currentWeek() : currentMonth();
  const key = weekly ? week : month;
  const prevKey = weekly ? addWeeks(key, -1) : addMonths(key, -1);
  const setKey = weekly ? setWeek : setMonth;
  const step = (n) => (weekly ? addWeeks(key, n) : addMonths(key, n));
  const totals = weekly ? byWeek : byMonth;
  const inPeriod = (date, k) => (weekly ? date >= k && date <= weekEnd(k) : monthKey(date) === k);
  const periodOf = (date) => (weekly ? weekStart(date) : monthKey(date));
  const heading = weekly ? weekLabel(key) : monthLabel(key);
  const prevName = weekly ? 'last week' : shortMonthName(prevKey);
  const periodWord = weekly ? 'week' : 'month';

  const m = totals[key] || ZERO_MONTH;
  const prev = totals[prevKey] || ZERO_MONTH;
  const empty = data.entries.length === 0 && data.investments.length === 0 && (data.debts || []).length === 0;

  // Width available for chart plots inside a card
  const plotWidth = width - SCREEN_PAD * 2 - CARD_PAD * 2 - Y_LABEL_W - 8;

  // Last 6 periods, ending at the current one unless the user has scrolled far back
  const TREND_LEN = 6;
  const trendEnd = key >= step(-(TREND_LEN - 1)) ? cur : (weekly ? addWeeks(key, 3) : addMonths(key, 3));
  const trend = useMemo(
    () =>
      Array.from({ length: TREND_LEN }, (_, i) => {
        const k = weekly ? addWeeks(trendEnd, i - (TREND_LEN - 1)) : addMonths(trendEnd, i - (TREND_LEN - 1));
        return { key: k, ...(totals[k] || ZERO_MONTH) };
      }),
    [totals, trendEnd, weekly]
  );

  const cats = useMemo(() => {
    const t = {};
    const p = {};
    data.entries.forEach((e) => {
      if (e.kind !== 'expense') return;
      const k = periodOf(e.date);
      if (k === key) t[e.category] = (t[e.category] || 0) + e.amount;
      else if (k === prevKey) p[e.category] = (p[e.category] || 0) + e.amount;
    });
    // Budgeted categories are listed even before anything is spent in them
    Object.keys(data.budgets || {}).forEach((name) => {
      if (!(name in t)) t[name] = 0;
    });
    return Object.entries(t)
      .map(([name, amt]) => ({ name, amt, prev: p[name] || 0, budget: budgetFor(data, name, weekly ? 'weekly' : 'monthly') }))
      .sort((a, b) => b.amt - a.amt || b.budget - a.budget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, key, prevKey, weekly]);

  // Donut: top 5 categories plus "Everything else" so slices stay readable on a phone
  const [selectedSlice, setSelectedSlice] = useState(null);
  const [trendCategory, setTrendCategory] = useState(null);
  const [duesOpen, setDuesOpen] = useState(false);
  useEffect(() => setSelectedSlice(null), [key]);
  const donut = useMemo(() => {
    const spentCats = cats.filter((c) => c.amt > 0);
    const total = spentCats.reduce((sum, c) => sum + c.amt, 0);
    const top = spentCats.slice(0, 5).map((c) => ({ name: c.name, value: c.amt, color: categoryColor(c.name) }));
    const rest = spentCats.slice(5).reduce((sum, c) => sum + c.amt, 0);
    if (rest > 0) top.push({ name: 'Everything else', value: rest, color: OTHER_SLICE_COLOR });
    return { slices: top, total };
  }, [cats, data.fixedMonthlyCategories, weekly]);
  const selectedIndex = donut.slices.findIndex((sl) => sl.name === selectedSlice);
  const toggleSlice = (name) => setSelectedSlice((current) => (current === name ? null : name));

  const budgetTotals = useMemo(() => {
    const budget = cats.reduce((sum, c) => sum + (weekly && data.fixedMonthlyCategories?.[c.name] ? 0 : c.budget), 0);
    const used = cats.reduce((sum, c) => sum + (c.budget && !(weekly && data.fixedMonthlyCategories?.[c.name]) ? c.amt : 0), 0);
    return { budget, used };
  }, [cats]);

  // Repeats and small amounts that add up, for the period on screen
  const leaks = useMemo(() => findLeaks(data, key, weekly), [data, key, weekly]);

  // Spending so far, against the same point in the previous period (a sentence instead of a chart)
  const pace = useMemo(() => {
    if (key !== cur) return null;
    const today = todayStr();
    const elapsed = weekly
      ? Math.floor((Date.parse(today) - Date.parse(key)) / 86400000) + 1
      : Number(today.slice(8, 10));
    const prevLimit = weekly ? elapsed : Math.min(elapsed, daysInMonth(prevKey));
    const dayIndex = (date, k) => (weekly ? Math.floor((Date.parse(date) - Date.parse(k)) / 86400000) + 1 : Number(date.slice(8, 10)));
    let now = 0;
    let before = 0;
    data.entries.forEach((e) => {
      if (e.kind !== 'expense') return;
      const k = periodOf(e.date);
      if (k === key && dayIndex(e.date, key) <= elapsed) now += e.amount;
      else if (k === prevKey && dayIndex(e.date, prevKey) <= prevLimit) before += e.amount;
    });
    return { now, before, diff: now - before };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.entries, key, prevKey, cur, weekly]);

  const biggest = useMemo(
    () =>
      data.entries
        .filter((e) => e.kind === 'expense' && inPeriod(e.date, key))
        .sort((x, y) => y.amount - x.amount)
        .slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.entries, key, weekly]
  );


  if (empty) {
    return (
      <ScrollView contentContainerStyle={{ padding: SCREEN_PAD, paddingBottom: bottomSpace }}>
        <EmptyState
          title="Start your money log"
          body="Add an expense, income or investment and this page fills in with your monthly trends. Want to see how it looks first? Load sample data, and remove it anytime with More > Delete all data."
        >
          <PrimaryButton label="Add first expense" icon={<Plus size={18} color={C.white} />} onPress={() => onAdd('expense')} />
          <GhostButton label="Load sample data" onPress={onLoadSample} />
        </EmptyState>
      </ScrollView>
    );
  }

  const left = m.earned - m.spent - m.invested;
  const spendChange = prev.spent > 0 ? ((m.spent - prev.spent) / prev.spent) * 100 : null;
  const saveRate = m.earned > 0 ? ((m.earned - m.spent) / m.earned) * 100 : null;
  const hasAnything = m.earned || m.spent || m.invested;

  // ---- 6-period chart: stacked spent + invested bars, earned as a line ----
  // Six bars leave room for wider bars, a value above each one, and a full label under each
  const slot = plotWidth / TREND_LEN;
  const barWidth = Math.min(30, Math.max(18, Math.round(slot * 0.52)));
  const initialSpacing = Math.round((slot - barWidth) / 2);
  const barSpacing = Math.max(8, slot - barWidth);
  const trendMax = niceMax(Math.max(...trend.map((t) => Math.max(t.earned, t.spent + Math.max(t.invested, 0)))) * 1.18);
  // Week labels carry the year when there is room; months read as Apr-26
  const withYear = slot >= 62;
  const rawLabels = trend.map((t) => (weekly ? axisWeekStart(t.key, withYear) : axisMonthShort(t.key)));
  const trendLabels = thinLabels(rawLabels, slot, 11);

  const stackData = trend.map((t, i) => {
    const selected = t.key === key;
    const pick = () => {
      if (t.key <= cur) setKey(t.key);
    };
    const outgoing = Math.max(t.spent, 0) + Math.max(t.invested, 0);
    return {
      label: trendLabels[i],
      labelTextStyle: { ...axisLabel, color: selected ? C.ink : C.muted, fontWeight: selected ? '700' : '500' },
      labelWidth: Math.round(slot),
      onPress: pick,
      // The total above each bar, so the numbers can be read without tapping
      // eslint-disable-next-line react/no-unstable-nested-components
      topLabelComponent: () => <BarValue amount={outgoing} selected={selected} />,
      stacks: [
        { value: Math.max(t.spent, 0), color: selected ? C.spend : faded(C.spend), onPress: pick },
        { value: Math.max(t.invested, 0), color: selected ? C.invest : faded(C.invest), onPress: pick, marginBottom: 1 },
      ],
    };
  });
  const earnedLine = trend.map((t) => ({ value: Math.max(t.earned, 0) }));

  return (
    <ScrollView contentContainerStyle={{ padding: SCREEN_PAD, paddingBottom: bottomSpace, gap: 14 }}>
      <Segmented options={[['weekly', 'Week'], ['monthly', 'Month'], ['fy', 'FY']]} value={weekly ? 'weekly' : 'monthly'} onChange={setPeriod} />

      {/* Period hero */}
      <View>
        <View style={s.monthRow}>
          <IconButton onPress={() => setKey(prevKey)} label={weekly ? 'Previous week' : 'Previous month'}>
            <ChevronLeft size={26} color={C.ink} />
          </IconButton>
          <Text style={[T.h1, weekly && { fontSize: 26 }, { flex: 1 }]} numberOfLines={1} adjustsFontSizeToFit>
            {heading}
          </Text>
          <IconButton onPress={() => setKey(step(1))} label={weekly ? 'Next week' : 'Next month'} disabled={key >= cur}>
            <ChevronRight size={26} color={C.ink} />
          </IconButton>
        </View>
        <Text style={s.heroLine}>
          {hasAnything ? (
            <>
              You earned <Text style={[s.heroNum, { color: C.earn }]}>{fmt(m.earned)}</Text>, spent{' '}
              <Text style={[s.heroNum, { color: C.spend }]}>{fmt(m.spent)}</Text> and invested{' '}
              <Text style={[s.heroNum, { color: C.invest }]}>{fmt(m.invested)}</Text>.
            </>
          ) : (
            `Nothing logged for this ${periodWord} yet.`
          )}
        </Text>
      </View>

      <ConfirmPayments />

      <KpiGrid
        items={[
          { label: 'Earned', value: fmt(m.earned), color: C.earn, note: `${fmt(prev.earned)} ${weekly ? prevName : `in ${prevName}`}` },
          {
            label: 'Spent',
            value: fmt(m.spent),
            color: C.spend,
            note:
              spendChange === null
                ? `Nothing logged ${weekly ? prevName : `in ${prevName}`}`
                : `${pct(Math.abs(spendChange))} ${spendChange > 0 ? 'more' : 'less'} than ${prevName}`,
            noteColor: spendChange === null ? C.muted : spendChange > 0 ? C.loss : C.gain,
          },
          { label: 'Invested', value: fmt(m.invested), color: C.invest, note: m.earned > 0 ? `${pct((m.invested / m.earned) * 100)} of income` : 'No income logged' },
          { label: 'Left over', value: fmt(left), color: left < 0 ? C.loss : C.ink, note: saveRate === null ? 'Add income to see saving rate' : `Saving rate ${pct(saveRate)}` },
        ]}
      />

      <UpcomingCard onOpenAll={() => setDuesOpen(true)} />

      {(netWorth.assets > 0 || netWorth.liabilities > 0) && (
        <Pressable onPress={onOpenWealth} style={s.netWorthRow} android_ripple={{ color: C.lineSoft }} accessibilityRole="button" accessibilityLabel={`Net worth ${fmt(netWorth.netWorth)}. Open Wealth`}>
          <Landmark size={20} color={C.invest} />
          <View style={{ flex: 1 }}>
            <Text style={T.label}>Net worth</Text>
            <Text style={T.small}>{`You own ${compact(netWorth.assets)}, you owe ${compact(netWorth.liabilities)}`}</Text>
          </View>
          <Text style={[T.num, { fontSize: 18, fontWeight: '800', color: netWorth.netWorth < 0 ? C.loss : C.ink }]}>{fmt(netWorth.netWorth)}</Text>
          <ChevronRight size={18} color={C.muted} />
        </Pressable>
      )}

      <Card>
        <SectionHeader
          title={weekly ? 'Last 6 weeks' : 'Last 6 months'}
          subtitle={`Tap a ${periodWord} to open it. The gap above a bar is what you kept.`}
        />
        <View style={s.legend}>
          <View style={s.legendItem}><Dot color={C.spend} /><Text style={T.small}>Spent</Text></View>
          <View style={s.legendItem}><Dot color={C.invest} /><Text style={T.small}>Invested</Text></View>
          <View style={s.legendItem}><Dot color={C.earn} height={3} /><Text style={T.small}>Earned</Text></View>
        </View>
        <BarChart
          stackData={stackData}
          barWidth={barWidth}
          spacing={barSpacing}
          initialSpacing={initialSpacing}
          endSpacing={4}
          width={plotWidth}
          height={186}
          maxValue={trendMax}
          noOfSections={4}
          formatYLabel={yLabel}
          yAxisLabelWidth={Y_LABEL_W}
          yAxisTextStyle={axisText}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={C.line}
          rulesColor={C.lineSoft}
          rulesType="solid"
          disableScroll
          showLine
          lineData={earnedLine}
          lineConfig={{ color: C.earn, thickness: 2, dataPointsColor: C.earn, dataPointsRadius: 3.5, curved: false }}
        />
        <View style={s.chartDetail}>
          <Text style={[T.small, { fontWeight: '700', color: C.ink }]}>{heading}</Text>
          <View style={s.detailRow}>
            <Text style={T.small}>Spent <Text style={[s.detailNum, { color: C.spend }]}>{fmt(m.spent)}</Text></Text>
            <Text style={T.small}>Invested <Text style={[s.detailNum, { color: C.invest }]}>{fmt(m.invested)}</Text></Text>
            <Text style={T.small}>Earned <Text style={[s.detailNum, { color: C.earn }]}>{fmt(m.earned)}</Text></Text>
          </View>
        </View>
      </Card>

      <Card>
        <SectionHeader
          title="Where the money went"
          subtitle={weekly ? 'By category, compared with last week' : `By category, compared with ${MONTHS_LONG[Number(prevKey.slice(5)) - 1]}`}
          right={<GhostButton label="Budgets" icon={<Target size={15} color={C.invest} />} color={C.invest} onPress={onOpenBudgets} style={{ paddingVertical: 6, paddingHorizontal: 10 }} />}
        />
        {budgetTotals.budget > 0 && (
          <View style={s.budgetSummary}>
            <Text style={[T.body, { fontWeight: '600' }]}>
              {budgetTotals.used > budgetTotals.budget
                ? `${fmt(budgetTotals.used - budgetTotals.budget)} over your ${periodWord}'s budget`
                : `${fmt(budgetTotals.budget - budgetTotals.used)} left of ${fmt(budgetTotals.budget)} this ${periodWord}`}
            </Text>
            <View style={{ marginTop: 6 }}>
              <Bar ratio={budgetTotals.used / budgetTotals.budget} color={budgetTotals.used > budgetTotals.budget ? C.loss : C.invest} />
            </View>
          </View>
        )}
        {donut.total > 0 && (
          <View style={s.donutRow}>
            <PieChart
              data={donut.slices.map((sl) => ({ value: sl.value, color: sl.color }))}
              donut
              radius={66}
              innerRadius={44}
              innerCircleColor={C.surface}
              strokeWidth={2}
              strokeColor={C.surface}
              focusOnPress
              focusedPieIndex={selectedIndex}
              extraRadius={6}
              onPress={(_item, index) => toggleSlice(donut.slices[index].name)}
              // gifted-charts takes a render function here
              // eslint-disable-next-line react/no-unstable-nested-components
              centerLabelComponent={() => <DonutCenter slice={donut.slices[selectedIndex]} total={donut.total} />}
            />
            <View style={{ flex: 1, gap: 2 }}>
              {donut.slices.map((sl) => {
                const on = sl.name === selectedSlice;
                return (
                  <Pressable
                    key={sl.name}
                    onPress={() => toggleSlice(sl.name)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onLongPress={() => sl.name !== 'Everything else' && setTrendCategory(sl.name)}
                    accessibilityLabel={`${sl.name}, ${fmt(sl.value)}, ${pct((sl.value / donut.total) * 100)} of spending. Long press for the monthly trend`}
                    style={[s.legendRow, on && { backgroundColor: C.paper }]}
                  >
                    <Dot color={sl.color} />
                    <Text style={[T.body, { flex: 1, fontSize: 13, fontWeight: on ? '700' : '400' }]} numberOfLines={1}>{sl.name}</Text>
                    <Text style={[T.small, T.num, on && { color: C.ink, fontWeight: '700' }]}>{pct((sl.value / donut.total) * 100)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {cats.length === 0 ? (
          <Text style={T.small}>No expenses logged in {heading}. Tap Budgets to set limits.</Text>
        ) : (
          <View style={{ gap: 14 }}>
            {cats.map((c) => {
              const diff = c.amt - c.prev;
              // Weekly spending and a monthly commitment are different time windows.
              // Show the monthly payment status as well so a paid bill never appears unpaid.
              const fixedMonthly = !!data.fixedMonthlyCategories?.[c.name];
              const monthlyLimit = weekly && (fixedMonthly || data.budgetPeriod === 'monthly') ? Number(data.budgets?.[c.name] || 0) : 0;
              const monthlyPaid = monthlyLimit ? data.entries.reduce((sum, e) =>
                sum + (e.kind === 'expense' && e.category === c.name && monthKey(e.date) === monthKey(key) ? Number(e.amount) || 0 : 0), 0) : 0;
              const displayAmount = fixedMonthly ? data.entries.reduce((sum, e) =>
                sum + (e.kind === 'expense' && e.category === c.name && monthKey(e.date) === monthKey(key) ? Number(e.amount) || 0 : 0), 0) : c.amt;
              const displayBudget = fixedMonthly ? Number(data.budgets?.[c.name] || 0) : c.budget;
              const status = budgetStatus(displayAmount, displayBudget);
              const barColor = status ? (status.level === 'over' ? C.loss : status.level === 'near' ? C.warn : C.invest) : C.spend;
              const maxAmt = Math.max(cats[0].amt, 1);
              return (
                <Pressable
                  key={c.name}
                  onPress={() => setTrendCategory(c.name)}
                  android_ripple={{ color: C.lineSoft }}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name}, ${fmt(c.amt)}. See the monthly trend`}
                >
                  <View style={s.rowBetween}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Dot color={categoryColor(c.name)} />
                      <Text style={[T.body, { fontWeight: '600', flex: 1 }]} numberOfLines={1}>{c.name}</Text>
                      <ChevronRight size={15} color={C.muted} />
                    </View>
                    <Text style={[T.body, T.num, { fontWeight: '700' }]}>
                      {fmt(displayAmount)}
                      {status ? <Text style={T.small}> / {fmt(displayBudget)}</Text> : null}
                    </Text>
                  </View>
                  <View style={{ marginVertical: 5 }}>
                    <Bar ratio={status ? status.ratio : c.amt / maxAmt} color={barColor} />
                  </View>
                  <View style={s.rowBetween}>
                    {status ? (
                      <Text style={[T.small, { color: status.level === 'over' ? C.loss : status.level === 'near' ? C.warn : C.muted, fontWeight: status.level === 'ok' ? '400' : '700' }]}>
                        {status.level === 'over' ? `${fmt(-status.left)} over budget` : `${fmt(status.left)} left`}
                      </Text>
                    ) : (
                      <Text style={T.small}>{m.spent > 0 ? pct((c.amt / m.spent) * 100) : pct(0)} of spending</Text>
                    )}
                    <Text style={[T.small, { color: c.prev === 0 ? C.muted : diff > 0 ? C.loss : C.gain }]}>
                      {c.prev === 0 ? (c.amt > 0 ? `New this ${periodWord}` : '') : `${fmtSigned(diff)} vs ${weekly ? 'last week' : prevName}`}
                    </Text>
                  </View>
                  {fixedMonthly && <Text style={[T.small, { marginTop: 5, color: C.invest }]}>Fixed monthly payment · {displayAmount >= displayBudget && displayBudget > 0 ? 'Paid this month' : `${fmt(Math.max(0, displayBudget - displayAmount))} remaining this month`} · This week {fmt(c.amt)}</Text>}
                  {monthlyLimit > 0 && !fixedMonthly && (
                    <Text style={[T.small, { marginTop: 5, color: monthlyPaid >= monthlyLimit ? C.invest : C.muted }]}>
                      {`Monthly limit ${fmt(monthlyLimit)} · Paid this month ${fmt(monthlyPaid)} · ${monthlyPaid >= monthlyLimit ? 'Monthly limit reached' : `${fmt(monthlyLimit - monthlyPaid)} remaining this month`}`}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      <SavingRateCard byMonth={byMonth} month={weekly ? currentMonth() : key} />

      <LeaksCard leaks={leaks} periodWord={periodWord} budgets={data.budgets} onOpenBudgets={onOpenBudgets} />

      <Card>
        <SectionHeader title="Biggest spends" />
        {pace && (pace.now > 0 || pace.before > 0) && (
          <View style={s.paceBox}>
            <Text style={[T.body, { lineHeight: 22 }]}>
              {pace.before === 0 ? (
                `So far this ${periodWord} you've spent ${fmt(pace.now)}. Nothing was logged by this point ${weekly ? 'last week' : `in ${prevName}`}.`
              ) : Math.abs(pace.diff) < 1 ? (
                `So far this ${periodWord} you've spent the same as by this point ${weekly ? 'last week' : `in ${prevName}`}.`
              ) : (
                <>
                  So far this {periodWord}:{' '}
                  <Text style={{ fontWeight: '800', color: pace.diff > 0 ? C.loss : C.gain }}>
                    {`${fmt(Math.abs(pace.diff))} ${pace.diff > 0 ? 'more' : 'less'}`}
                  </Text>
                  {` than by this point ${weekly ? 'last week' : `in ${prevName}`}.`}
                </>
              )}
            </Text>
          </View>
        )}
        {biggest.length === 0 ? (
          <Text style={T.small}>None yet.</Text>
        ) : (
          biggest.map((e) => (
            <View key={e.id} style={[s.rowBetween, { paddingVertical: 5 }]}>
              <Text style={[T.body, { flex: 1 }]} numberOfLines={1}>
                {e.note || e.category} <Text style={T.small}>{fmtDate(e.date)}</Text>
              </Text>
              <Text style={[T.body, T.num, { fontWeight: '700' }]}>{fmt(e.amount)}</Text>
            </View>
          ))
        )}
      </Card>

      {duesOpen && <UpcomingSheet onClose={() => setDuesOpen(false)} />}

      {trendCategory && (
        <CategoryTrendSheet category={trendCategory} onClose={() => setTrendCategory(null)} onOpenBudgets={onOpenBudgets} />
      )}
    </ScrollView>
  );
}

// The amount above each bar in the trend chart
function BarValue({ amount, selected }) {
  if (!amount) return null;
  return (
    <Text style={[s.barValue, selected && { color: C.ink, fontWeight: '800' }]} numberOfLines={1}>
      {compact(amount)}
    </Text>
  );
}

// Centre of the spending donut: total spent, or the tapped category
function DonutCenter({ slice, total }) {
  return (
    <View style={{ alignItems: 'center', width: 80 }}>
      <Text style={[T.small, { fontSize: 11 }]} numberOfLines={1}>{slice ? slice.name : 'Spent'}</Text>
      <Text style={[T.num, { fontSize: 15, fontWeight: '800', color: C.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {compact(slice ? slice.value : total)}
      </Text>
      {slice ? <Text style={[T.small, { fontSize: 11 }]}>{pct((slice.value / total) * 100)}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: -10 },
  heroLine: { fontSize: 17, lineHeight: 25, color: C.inkSoft, marginTop: 6 },
  heroNum: { fontWeight: '800' },
  legend: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 8 },
  paceBox: { backgroundColor: C.paper, borderRadius: 12, padding: 12, marginBottom: 10 },
  netWorthRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 12, overflow: 'hidden',
  },
  chartDetail: { marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft, gap: 4 },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  detailNum: { fontWeight: '800' },
  barValue: { fontSize: 10, fontWeight: '700', color: C.muted, marginBottom: 3, textAlign: 'center', width: 52 },
  budgetSummary: { backgroundColor: C.paper, borderRadius: 12, padding: 12, marginBottom: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
});
