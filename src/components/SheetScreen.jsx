import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { C, T } from '../theme';
import KeyboardAwareScroll from './KeyboardAwareScroll';
import { IconButton } from './ui';

/**
 * The shared shell for every full-screen sheet.
 *
 * It exists so scrolling, keyboard handling and bottom safe space are solved once rather than
 * per screen: the body always scrolls, the focused input is always brought above the keyboard,
 * and the last control always clears the navigation bar. Chart-only sheets may use
 * keyboardAware={false} to mount an ordinary native ScrollView immediately; input sheets
 * keep the keyboard-aware scroller. Both modes preserve the same safe-area spacing.
 */
export default function SheetScreen({ title, subtitle, onClose, action, footer, children, contentStyle, background = C.paper, keyboardAware = true }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[s.screen, { paddingTop: insets.top, backgroundColor: background }]}>
        <View style={s.header}>
          <IconButton onPress={onClose} label="Close">
            <X size={22} color={C.ink} />
          </IconButton>
          <View style={{ flex: 1, marginLeft: 4, minWidth: 0 }}>
            <Text style={T.h2} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={T.small} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          {action ? (
            <Pressable onPress={action.onPress} hitSlop={8} style={s.action} accessibilityRole="button">
              <Text style={s.actionText}>{action.label}</Text>
            </Pressable>
          ) : null}
        </View>

        {keyboardAware ? (
          <KeyboardAwareScroll
            style={s.scroller}
            nestedScrollEnabled
            contentContainerStyle={[s.body, { paddingBottom: 28 + insets.bottom + (footer ? 8 : 0) }, contentStyle]}
          >
            {children}
          </KeyboardAwareScroll>
        ) : (
          <ScrollView
            style={s.scroller}
            scrollEnabled
            nestedScrollEnabled
            directionalLockEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={[s.body, { flexGrow: 1, paddingBottom: 28 + insets.bottom + (footer ? 8 : 0) }, contentStyle]}
          >
            {children}
          </ScrollView>
        )}

        {footer ? <View style={[s.footer, { paddingBottom: 10 + insets.bottom }]}>{footer}</View> : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  scroller: { flex: 1, minHeight: 0 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 13, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.surface,
  },
  action: { paddingHorizontal: 12, paddingVertical: 8 },
  actionText: { color: C.invest, fontWeight: '800', fontSize: 16 },
  body: { padding: 16, gap: 16 },
  footer: {
    paddingHorizontal: 16, paddingTop: 10, backgroundColor: C.surface,
    borderTopWidth: 1, borderTopColor: C.line,
  },
});
