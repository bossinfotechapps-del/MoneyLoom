import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarRange, Wallet } from 'lucide-react-native';
import { C, T } from '../theme';
import { useData } from '../data/DataContext';
import { computeCashFlow } from '../data/cashFlow';
import { monthLabel, todayStr } from '../utils/dates';
import { fmt, fmtSigned } from '../utils/format';

function Figure({ label, amount, icon: Icon, color }) {
  return (
    <View style={s.figure}>
      <Icon size={16} color={color} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.figureLabel}>{label}</Text>
        <Text style={[s.figureAmount, T.num]} numberOfLines={1} adjustsFontSizeToFit>{amount === null ? 'Not set' : fmt(amount)}</Text>
      </View>
    </View>
  );
}

/** Month forecast intentionally stays on the CURRENT month regardless of Overview's Week/Month/FY filter. */
export default function CashFlowCard({ onOpen }) {
  const { data } = useData();
  const today = todayStr();
  const plan = useMemo(() => computeCashFlow(data, today), [data, today]);
  const positive = plan.surplus !== null && plan.surplus >= 0;
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open this month's cash flow plan" style={s.card}>
      <View style={s.heading}>
        <View style={s.headingIcon}><CalendarRange size={19} color={C.invest} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[T.h2, { fontSize: 18 }]}>This month's cash flow</Text>
          <Text style={[T.small, { marginTop: 2 }]}>{monthLabel(plan.month)} · Remaining plan</Text>
        </View>
        <ArrowRight size={19} color={C.invest} />
      </View>

      <View style={s.hero}>
        <Text style={[T.small, { color: '#CEE6DF' }]}>{plan.surplus === null ? 'Add your available balance' : 'Expected surplus / shortfall'}</Text>
        <Text style={[s.heroAmount, T.num]} numberOfLines={1} adjustsFontSizeToFit>
          {plan.surplus === null ? '—' : fmtSigned(plan.surplus)}
        </Text>
        <Text style={s.heroNote}>
          {plan.surplus === null ? 'Update your cash and bank balances in Wealth → Accounts.' : positive ? 'Estimated money left after this month’s plan' : 'Additional money estimated to be needed'}
        </Text>
      </View>

      <View style={s.figures}>
        <Figure icon={ArrowUpRight} label="Total required" amount={plan.totalRequired} color={C.spend} />
        <Figure icon={Wallet} label="Available now" amount={plan.available} color={C.invest} />
        <Figure icon={ArrowDownLeft} label="Upcoming income" amount={plan.upcomingIncoming} color={C.earn} />
      </View>
      <View style={s.footer}>
        <Text style={s.footerText} numberOfLines={2}>Planned amounts are estimates, not confirmed payments.</Text>
        <Text style={s.footerLink}>View plan  →</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 21, borderWidth: 1, borderColor: C.line, padding: 18, gap: 15, elevation: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headingIcon: { backgroundColor: '#E3F2EC', width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: C.investDark, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 17 },
  heroAmount: { color: C.white, fontWeight: '800', fontSize: 29, letterSpacing: -0.8, marginTop: 4 },
  heroNote: { color: '#E3F0EC', fontSize: 12, marginTop: 4 },
  figures: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  figure: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, flexGrow: 1, flexBasis: '45%', backgroundColor: C.paper, borderRadius: 13, padding: 12 },
  figureLabel: { fontSize: 12, color: C.muted, marginBottom: 4 },
  figureAmount: { fontSize: 17, fontWeight: '800', color: C.ink },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  footerText: { color: C.muted, fontSize: 11, flex: 1 },
  footerLink: { color: C.invest, fontSize: 13, fontWeight: '800' },
});
