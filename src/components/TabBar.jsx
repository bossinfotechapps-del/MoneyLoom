import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ellipsis, Landmark, LayoutDashboard, ReceiptText, Target } from 'lucide-react-native';
import { C } from '../theme';

// Plain text labels only: emojis render as blank boxes on some Android devices
const TABS = [
  { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { key: 'entries', label: 'Expenses', Icon: ReceiptText },
  { key: 'wealth', label: 'Wealth', Icon: Landmark },
  { key: 'goals', label: 'Goals', Icon: Target },
  { key: 'more', label: 'More', Icon: Ellipsis },
];

export default function TabBar({ active, onChange, bottomInset }) {
  return (
    <View style={[s.bar, { paddingBottom: Math.max(bottomInset, 6) }]}>
      {TABS.map(({ key, label, Icon }) => {
        const on = key === active;
        const color = on ? C.invest : C.muted;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            android_ripple={{ color: C.lineSoft, borderless: true }}
            style={s.tab}
          >
            <Icon size={22} color={color} strokeWidth={on ? 2.4 : 2} />
            <Text style={[s.label, { color, fontWeight: on ? '700' : '600' }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  label: { fontSize: 12 },
});
