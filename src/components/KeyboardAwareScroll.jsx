import React, {
  createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

const FocusContext = createContext(null);
export const useEnsureVisible = () => useContext(FocusContext);
const DONE_BAR_HEIGHT = 56;

/** Shared keyboard-safe scrolling for full-screen sheets (including edge-to-edge Android modals). */
const KeyboardAwareScroll = forwardRef(function KeyboardAwareScroll(
  { children, contentContainerStyle, extraBottom = 20, extraScroll = 20, showDoneBar = true, ...props },
  ref
) {
  const scrollRef = useRef(null);
  const offsetY = useRef(0);
  const viewport = useRef({ top: 0, height: 0 });
  const keyboardTop = useRef(null);
  const focused = useRef(null);
  const timer = useRef(null);
  const [covered, setCovered] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scheduleReveal = useRef(() => {});

  useImperativeHandle(ref, () => scrollRef.current, []);

  const measureViewport = useCallback((done) => {
    const node = scrollRef.current;
    if (!node?.measureInWindow) return;
    node.measureInWindow((x, y, width, height) => {
      if (typeof y !== 'number' || !height) return;
      viewport.current = { top: y, height };
      done?.(y, height);
    });
  }, []);

  const revealFocused = useCallback(() => {
    const node = focused.current;
    if (!node?.measureInWindow || !scrollRef.current) return;
    measureViewport((top, height) => {
      node.measureInWindow((x, y, width, fieldHeight) => {
        if (typeof y !== 'number' || !fieldHeight || !scrollRef.current) return;
        // The Done toolbar occupies space ABOVE the keyboard, not inside the scroll view.
        const keyboardLimit = keyboardTop.current == null
          ? top + height
          : keyboardTop.current - (showDoneBar ? DONE_BAR_HEIGHT : 0);
        const visibleBottom = Math.min(top + height, keyboardLimit);
        const fieldBottom = y + fieldHeight + extraScroll;
        if (fieldBottom > visibleBottom) {
          scrollRef.current.scrollTo({
            y: Math.max(0, offsetY.current + fieldBottom - visibleBottom), animated: true,
          });
        } else if (y < top + 8) {
          scrollRef.current.scrollTo({
            y: Math.max(0, offsetY.current - (top + 16 - y)), animated: true,
          });
        }
      });
    });
  }, [extraScroll, measureViewport, showDoneBar]);

  const queueReveal = useCallback((delay = 90) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(revealFocused, delay);
  }, [revealFocused]);
  scheduleReveal.current = queueReveal;

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      const screenY = e.endCoordinates?.screenY;
      if (typeof screenY !== 'number') return;
      keyboardTop.current = screenY;
      setKeyboardVisible(true);
      // screenY uses screen coordinates; window.height may exclude the navigation bar.
      // Measure the actual scroll viewport to avoid assuming either coordinate system.
      measureViewport((top, height) => {
        setCovered(Math.max(0, Math.ceil(top + height - screenY)));
        scheduleReveal.current(80);
      });
      scheduleReveal.current(180); // recheck after the keyboard and content spacer settle
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      setKeyboardVisible(false);
      setCovered(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, [measureViewport]);

  useEffect(() => () => clearTimeout(timer.current), []);
  const ensureVisible = useCallback(node => {
    focused.current = node;
    queueReveal(80);
  }, [queueReveal]);
  const context = useMemo(() => ensureVisible, [ensureVisible]);
  const barVisible = showDoneBar && keyboardVisible;

  return (
    <FocusContext.Provider value={context}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEventThrottle={16}
        onScroll={e => { offsetY.current = e.nativeEvent.contentOffset.y; }}
        onLayout={() => { measureViewport(); if (keyboardTop.current != null) queueReveal(80); }}
        onContentSizeChange={() => { if (keyboardTop.current != null) queueReveal(80); }}
        contentContainerStyle={contentContainerStyle}
        {...props}
      >
        {children}
        {/* This spacer gives the last field enough scroll range even when the modal never resizes. */}
        <View style={{ height: keyboardVisible ? covered + extraBottom + (showDoneBar ? DONE_BAR_HEIGHT : 0) : 0 }} />
      </ScrollView>
      {barVisible && (
        <View style={[s.doneBar, { bottom: covered }]} pointerEvents="box-none">
          <Pressable
            onPress={() => Keyboard.dismiss()}
            android_ripple={{ color: C.lineSoft }}
            style={s.donePill}
            accessibilityRole="button"
            accessibilityLabel="Close the keyboard"
          >
            <Text style={s.doneText}>Done</Text>
          </Pressable>
        </View>
      )}
    </FocusContext.Provider>
  );
});

const s = StyleSheet.create({
  doneBar: {
    position: 'absolute', left: 0, right: 0, alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line,
  },
  donePill: { paddingVertical: 6, paddingHorizontal: 18, borderRadius: 999, backgroundColor: C.chip, overflow: 'hidden' },
  doneText: { fontWeight: '800', color: C.invest, fontSize: 15 },
});

export default KeyboardAwareScroll;
