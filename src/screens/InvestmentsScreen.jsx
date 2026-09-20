import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pencil, Plus, Trash } from 'lucide-react-native';
import { C, T } from '../theme';
import { useData } from '../data/DataContext';
import { fmtDate } from '../utils/dates';
import { fmt, fmtSigned, pct } from '../utils/format';
import ValueSheet from '../components/ValueSheet';
import { Card, EmptyState, GhostButton, IconButton, KpiGrid, PrimaryButton, SectionHeader, Tag } from '../components/ui';

export default function InvestmentsScreen({ onAdd, onEdit, onToast, bottomSpace }) {
  const { data, holdings, removeRecord, setHoldingValue } = useData();
  const [editing, setEditing] = useState(null);

  const totals = useMemo(() => {
    const invested = holdings.reduce((sum, h) => sum + h.invested, 0);
    const current = holdings.reduce((sum, h) => sum + h.current, 0);
    return { invested, current, gain: current - invested };
  }, [holdings]);

  const txns = useMemo(() => [...data.investments].sort((a, b) => b.date.localeCompare(a.date)), [data.investments]);

  if (holdings.length === 0) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomSpace }}>
        <EmptyState
          title="No investments yet"
          body="Log each SIP, PPF deposit, NPS contribution or stock purchase. Update the current value now and then to see your gain."
        >
          <PrimaryButton label="Add investment" icon={<Plus size={18} color={C.white} />} onPress={onAdd} />
        </EmptyState>
      </ScrollView>
    );
  }

  const confirmDelete = (t) => {
    Alert.alert('Delete this entry?', `${t.name}, ${fmt(t.amount)} on ${fmtDate(t.date)}`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeRecord('investments', t.id) },
    ]);
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomSpace, gap: 14 }}>
        <KpiGrid
          items={[
            { label: 'Invested', value: fmt(totals.invested) },
            { label: 'Value now', value: fmt(totals.current) },
            {
              label: 'Gain',
              value: fmtSigned(totals.gain),
              color: totals.gain >= 0 ? C.gain : C.loss,
              note: totals.invested > 0 ? pct((totals.gain / totals.invested) * 100, 1) : '',
            },
          ]}
        />

        <Card style={{ paddingBottom: 6 }}>
          <SectionHeader
            title="Holdings"
            subtitle="Tap a holding to enter its current value. Contributions after that date are added automatically."
          />
          {holdings.map((h, i) => (
            <Pressable
              key={h.name}
              onPress={() => setEditing(h)}
              android_ripple={{ color: C.lineSoft }}
              style={[s.holding, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line }]}
            >
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[T.body, { fontWeight: '700' }]} numberOfLines={1}>{h.name}</Text>
                  <Text style={T.small}>{h.type}</Text>
                </View>
                <View style={s.updateHint}>
                  <Pencil size={13} color={C.invest} />
                  <Text style={{ color: C.invest, fontWeight: '700', fontSize: 13 }}>Update</Text>
                </View>
              </View>
              <View style={[s.rowBetween, { marginTop: 10 }]}>
                <View>
                  <Text style={T.small}>Invested</Text>
                  <Text style={[T.body, T.num, { fontWeight: '600' }]}>{fmt(h.invested)}</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={T.small}>Value now</Text>
                  <Text style={[T.body, T.num, { fontWeight: '700' }]}>{fmt(h.current)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={T.small}>Gain</Text>
                  <Text style={[T.body, T.num, { fontWeight: '700', color: h.gain >= 0 ? C.gain : C.loss }]}>
                    {fmtSigned(h.gain)} <Text style={T.small}>{pct(h.gainPct, 1)}</Text>
                  </Text>
                </View>
              </View>
              <Text style={[T.small, { marginTop: 6 }]}>
                {h.valueDate ? `Value updated ${fmtDate(h.valueDate)}` : 'Value not set yet, showing amount invested'}
              </Text>
            </Pressable>
          ))}
        </Card>

        <Card style={{ paddingHorizontal: 0, paddingBottom: 4 }}>
          <View style={{ paddingHorizontal: 16 }}>
            <SectionHeader
              title="Contributions and withdrawals"
              right={<GhostButton label="Add" icon={<Plus size={16} color={C.ink} />} onPress={onAdd} style={{ paddingVertical: 6 }} />}
            />
          </View>
          {txns.map((t, i) => (
            <Pressable
              key={t.id}
              onPress={() => onEdit(t)}
              android_ripple={{ color: C.lineSoft }}
              style={[s.txn, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line }]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{t.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                  <Tag label={t.type} />
                  <Text style={T.small}>{fmtDate(t.date)}</Text>
                </View>
              </View>
              <Text style={[T.body, T.num, { fontWeight: '700', color: t.action === 'withdraw' ? C.loss : C.invest }]}>
                {t.action === 'withdraw' ? '−' : '+'}{fmt(t.amount)}
              </Text>
              <IconButton onPress={() => confirmDelete(t)} label={`Delete ${t.name}`} size={36}>
                <Trash size={17} color={C.muted} />
              </IconButton>
            </Pressable>
          ))}
        </Card>
      </ScrollView>

      {editing && (
        <ValueSheet
          holding={editing}
          onClose={() => setEditing(null)}
          onSave={(name, value) => {
            setHoldingValue(name, value);
            onToast(`Value updated for ${name}`);
          }}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  holding: { paddingVertical: 12 },
  updateHint: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 2 },
  txn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 6, paddingVertical: 10 },
});
