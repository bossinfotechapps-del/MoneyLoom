import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { History, X } from 'lucide-react-native';
import { C, T } from '../theme';
import { fmtDate } from '../utils/dates';
import { GhostButton, IconButton } from './ui';

const timeOf = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** Older cloud copies, so a bad restore or an accidental wipe can be undone. */
export default function VersionPicker({ versions, onPick, onClose }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={s.sheet}>
          <View style={s.header}>
            <History size={18} color={C.inkSoft} />
            <Text style={[T.h2, { flex: 1 }]}>Older copies</Text>
            <IconButton onPress={onClose} label="Close" size={36}>
              <X size={18} color={C.ink} />
            </IconButton>
          </View>
          <ScrollView style={{ maxHeight: 320 }}>
            {versions.map((v) => {
              const counts = v.counts || {};
              return (
                <Pressable key={v.id} onPress={() => onPick(v)} android_ripple={{ color: C.lineSoft }} style={s.row} accessibilityRole="button">
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { fontWeight: '600' }]}>
                      {`${fmtDate(String(v.updatedAt).slice(0, 10))} ${timeOf(v.updatedAt)}`}
                    </Text>
                    <Text style={T.small}>
                      {`${counts.entries || 0} entries · ${counts.investments || 0} investments · ${counts.debts || 0} debts`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <GhostButton label="Cancel" onPress={onClose} style={{ margin: 16, marginTop: 10 }} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,42,43,0.45)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: C.surface, borderRadius: 18, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 8 },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
});
