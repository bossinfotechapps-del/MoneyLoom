import React, { memo, useCallback, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEnsureVisible } from './KeyboardAwareScroll';
import { C, T } from '../theme';

/** A shared page heading; existing tabs, charts and screen actions remain untouched. */
export function ScreenHeading({ title, subtitle, eyebrow, right, style }) {
  return (
    <View style={[s.screenHeading, style]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
        <Text style={T.h1} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={[T.small, { marginTop: 3 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ style, children }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionHeader({ title, subtitle, right }) {
  return (
    <View style={s.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={T.h2}>{title}</Text>
        {subtitle ? <Text style={[T.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function PrimaryButton({ label, onPress, icon, style, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
      style={({ pressed }) => [s.primaryBtn, pressed && { backgroundColor: C.investDark }, disabled && { opacity: 0.4 }, style]}
    >
      {icon}
      <Text style={s.primaryText}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({ label, onPress, icon, color = C.ink, style, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: C.lineSoft }}
      style={[s.ghostBtn, disabled && { opacity: 0.4 }, style]}
    >
      {icon}
      <Text style={[s.ghostText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ onPress, children, label, disabled, size = 40 }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      android_ripple={{ color: C.line, borderless: true, radius: size / 2 }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.25 : 1 }}
    >
      {children}
    </Pressable>
  );
}

export function Segmented({ options, value, onChange, style }) {
  return (
    <View style={[s.seg, style]}>
      {options.map(([key, label]) => {
        const on = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[s.segItem, on && s.segItemOn]}
          >
            <Text style={[s.segText, on && { color: C.ink }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Wrapping chips for choosing one value (categories, payment mode, investment type)
export function ChipGroup({ options, value, onChange, addLabel, onAdd }) {
  return (
    <View style={s.chipWrap}>
      {options.map((opt) => {
        const on = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[s.chip, on && s.chipOn]}
          >
            <Text style={[s.chipText, on && s.chipTextOn]}>{opt}</Text>
          </Pressable>
        );
      })}
      {onAdd ? (
        <Pressable onPress={onAdd} accessibilityRole="button" style={[s.chip, s.chipAdd]}>
          <Text style={[s.chipText, { color: C.invest }]}>{addLabel || '+ New'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Single-line scrolling chips for filters
export function ChipScroller({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
      {options.map(([key, label]) => {
        const on = key === value;
        return (
          <Pressable key={key} onPress={() => onChange(key)} style={[s.chip, on && s.chipOn]}>
            <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Kept outside screens and memoised so typing never loses focus
const NUMERIC = new Set(['decimal-pad', 'number-pad', 'numeric', 'phone-pad']);

export const LabeledInput = memo(function LabeledInput({ label, hint, style, inputStyle, onFocus, nextRef, inputRef: outerRef, ...props }) {
  const inputRef = useRef(null);
  // Keep both the internal ref (for scrolling) and any ref the caller passed (for focusing)
  const setRef = useCallback(
    (node) => {
      inputRef.current = node;
      if (typeof outerRef === 'function') outerRef(node);
      else if (outerRef) outerRef.current = node;
    },
    [outerRef]
  );
  const ensureVisible = useEnsureVisible();
  const numeric = NUMERIC.has(props.keyboardType);

  const handleFocus = useCallback(
    (e) => {
      if (ensureVisible) ensureVisible(inputRef.current);
      if (onFocus) onFocus(e);
    },
    [ensureVisible, onFocus]
  );

  // Enter moves to the next field instead of closing the keyboard
  const goNext = useCallback(
    (e) => {
      if (nextRef?.current?.focus) nextRef.current.focus();
      if (props.onSubmitEditing) props.onSubmitEditing(e);
    },
    [nextRef, props]
  );

  return (
    <View style={style}>
      {label ? <Text style={[T.label, { marginBottom: 6 }]}>{label}</Text> : null}
      <TextInput
        ref={setRef}
        onFocus={handleFocus}
        placeholderTextColor="#98A39F"
        // Typing over an amount is the common case, so select what's there
        selectTextOnFocus={numeric}
        returnKeyType={nextRef ? 'next' : props.returnKeyType}
        submitBehavior={nextRef ? 'submit' : undefined}
        style={[s.input, inputStyle]}
        {...props}
        onSubmitEditing={nextRef ? goNext : props.onSubmitEditing}
      />
      {hint ? <Text style={[T.small, { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
});

export function KpiGrid({ items }) {
  return (
    <View style={s.kpiGrid}>
      {items.map((it) => (
        <View key={it.label} style={[s.kpiCell, { width: items.length === 3 ? '31.5%' : '48.5%' }, it.color && { borderTopWidth: 3, borderTopColor: it.color, paddingTop: 14 }]}>
          <Text style={T.label}>{it.label}</Text>
          <Text style={[s.kpiValue, T.num, { color: it.color || C.ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {it.value}
          </Text>
          {it.note ? (
            <Text style={[T.small, it.noteColor && { color: it.noteColor }]} numberOfLines={2}>
              {it.note}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function Bar({ ratio, color }) {
  const w = `${Math.max(0, Math.min(1, ratio || 0)) * 100}%`;
  return (
    <View style={s.barTrack}>
      <View style={[s.barFill, { width: w, backgroundColor: color }]} />
    </View>
  );
}

export function Dot({ color, height = 10 }) {
  return <View style={{ width: 10, height, borderRadius: 3, backgroundColor: color }} />;
}

export function Tag({ label }) {
  return (
    <View style={s.tag}>
      <Text style={s.tagText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, body, children }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
      <Text style={[T.h1, { fontSize: 26, textAlign: 'center' }]}>{title}</Text>
      <Text style={[T.body, { color: C.muted, textAlign: 'center', marginTop: 8, lineHeight: 22 }]}>{body}</Text>
      <View style={{ marginTop: 20, gap: 10, alignSelf: 'stretch' }}>{children}</View>
    </Card>
  );
}

const s = StyleSheet.create({
  screenHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 3, paddingHorizontal: 2, paddingTop: 4 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: C.invest, marginBottom: 5 },
  card: { backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 18, elevation: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.invest, minHeight: 46, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 14, overflow: 'hidden',
  },
  primaryText: { color: C.white, fontWeight: '700', fontSize: 15 },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, minHeight: 44, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 13, overflow: 'hidden',
  },
  ghostText: { fontWeight: '600', fontSize: 14 },
  seg: { flexDirection: 'row', backgroundColor: C.chip, borderRadius: 16, padding: 4, gap: 3, borderWidth: 1, borderColor: C.lineSoft },
  segItem: { flex: 1, minHeight: 42, paddingVertical: 10, paddingHorizontal: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segItemOn: { backgroundColor: C.surface, elevation: 1, borderWidth: 1, borderColor: C.line },
  segText: { fontWeight: '700', fontSize: 13, color: C.inkSoft, textAlign: 'center' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 37, justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999, backgroundColor: C.chip, borderWidth: 1, borderColor: C.lineSoft },
  chipOn: { backgroundColor: C.invest, borderColor: C.invest },
  chipAdd: { backgroundColor: 'transparent', borderColor: C.invest, borderStyle: 'dashed' },
  chipText: { fontSize: 13, fontWeight: '600', color: C.inkSoft },
  chipTextOn: { color: C.white },
  input: {
    borderWidth: 1, borderColor: '#CCDCD4', backgroundColor: C.white, borderRadius: 13,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.ink,
  },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 9 },
  kpiCell: { backgroundColor: C.surface, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 16, borderWidth: 1, borderColor: C.line, elevation: 1, minHeight: 116 },
  kpiValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.75, marginTop: 7, marginBottom: 4 },
  barTrack: { height: 9, backgroundColor: C.chip, borderRadius: 99, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99 },
  tag: { backgroundColor: C.lineSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, maxWidth: 170 },
  tagText: { fontSize: 12, fontWeight: '600', color: C.inkSoft },
});
