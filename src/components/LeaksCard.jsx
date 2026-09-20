import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Coins, Repeat2, Search, TrendingUp } from 'lucide-react-native';
import { C, T, categoryColor } from '../theme';
import { fmt } from '../utils/format';
import { Card, GhostButton, SectionHeader } from './ui';

const ICONS = { repeat: Repeat2, small: Coins, above: TrendingUp };

/**
 * "Adds up quietly": repeated spends, lots of small ones, or a category above its usual level.
 * Every line states what was logged, and leaves the judgement to the person.
 */
export default function LeaksCard({ leaks, periodWord, budgets, onOpenBudgets }) {
  if (!leaks.length) return null;
  const missingBudget = leaks.find((l) => !budgets?.[l.category]);

  return (
    <Card>
      <SectionHeader
        title="Adds up quietly"
        subtitle={`Small amounts and repeats from this ${periodWord}`}
        right={<Search size={18} color={C.muted} />}
      />
      <View style={{ gap: 12 }}>
        {leaks.map((leak) => {
          const Icon = ICONS[leak.kind] || Coins;
          return (
            <View key={leak.id} style={s.row}>
              <View style={[s.icon, { backgroundColor: `${categoryColor(leak.category)}1A` }]}>
                <Icon size={17} color={categoryColor(leak.category)} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[T.body, { fontWeight: '700' }]} numberOfLines={1}>{leak.title}</Text>
                <Text style={T.small} numberOfLines={2}>{leak.detail}</Text>
              </View>
              <Text style={[T.body, T.num, { fontWeight: '800' }]}>{fmt(leak.amount)}</Text>
            </View>
          );
        })}
      </View>

      {missingBudget && onOpenBudgets && (
        <GhostButton
          label={`Set a limit for ${missingBudget.category}`}
          color={C.invest}
          onPress={onOpenBudgets}
          style={{ marginTop: 14 }}
        />
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
