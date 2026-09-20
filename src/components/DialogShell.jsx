import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { C, T } from '../theme';
import useKeyboardCover from '../hooks/useKeyboardCover';

/**
 * The shared shell for small centred dialogs.
 *
 * The body scrolls inside a height that already accounts for the keyboard, so the buttons at the
 * bottom stay reachable even on a short screen with the keyboard open.
 */
export default function DialogShell({ title, subtitle, onClose, children, footer }) {
  const covered = useKeyboardCover();
  const { height } = useWindowDimensions();
  // Leave room for the title, the buttons and a margin, whatever is left after the keyboard
  const maxBody = Math.max(140, height - covered - 260);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.backdrop, { paddingBottom: 20 + covered }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={s.dialog}>
          {title ? <Text style={T.h2}>{title}</Text> : null}
          {subtitle ? <Text style={[T.small, { marginTop: 2, lineHeight: 18 }]}>{subtitle}</Text> : null}
          <ScrollView
            style={{ maxHeight: maxBody }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 4 }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,42,43,0.45)', justifyContent: 'center', padding: 20 },
  dialog: { backgroundColor: C.surface, borderRadius: 18, padding: 20 },
});
