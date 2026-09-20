import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { CircleCheck, CircleX, Info, LoaderCircle } from 'lucide-react-native';
import { T } from '../theme';

const LOOK = {
  working: { bg: '#1E2A2B', fg: '#FFFFFF', Icon: LoaderCircle },
  success: { bg: '#11694F', fg: '#FFFFFF', Icon: CircleCheck },
  error: { bg: '#8E2F2F', fg: '#FFFFFF', Icon: CircleX },
  info: { bg: '#1E2A2B', fg: '#FFFFFF', Icon: Info },
};

/**
 * One in-app toast that can say it's working, then change to success or failure in place,
 * which Android's own toast can't do. Used for backup and restore, where people need to know
 * whether the thing actually finished.
 */
export default function StatusToast({ status, bottomInset = 0 }) {
  const slide = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const visible = !!status;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  useEffect(() => {
    if (status?.kind !== 'working') {
      spin.stopAnimation();
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    spin.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [status?.kind, spin]);

  if (!status) return null;
  const look = LOOK[status.kind] || LOOK.info;
  const { Icon } = look;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        s.wrap,
        {
          bottom: 16 + bottomInset,
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      <View style={[s.toast, { backgroundColor: look.bg }]}>
        <Animated.View
          style={
            status.kind === 'working'
              ? { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }
              : null
          }
        >
          <Icon size={18} color={look.fg} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: look.fg }]} numberOfLines={1}>{status.title}</Text>
          {status.detail ? (
            <Text style={[T.small, { color: look.fg, opacity: 0.85 }]} numberOfLines={2}>{status.detail}</Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 40 },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, elevation: 6,
  },
  title: { fontSize: 14, fontWeight: '700' },
});
