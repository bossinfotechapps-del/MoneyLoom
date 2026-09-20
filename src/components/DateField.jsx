import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { C, T } from '../theme';
import { dateFromStr, fmtDate, strFromDate } from '../utils/dates';

// A labelled date button that opens the native Android date picker
export default function DateField({ label, value, onChange, hint, style, placeholder = 'Pick a date', minimumDate, maximumDate }) {
  const open = () => {
    DateTimePickerAndroid.open({
      value: value ? dateFromStr(value) : new Date(),
      mode: 'date',
      minimumDate,
      maximumDate,
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange(strFromDate(date));
      },
    });
  };
  return (
    <View style={style}>
      {label ? <Text style={[T.label, { marginBottom: 6 }]}>{label}</Text> : null}
      <Pressable onPress={open} style={s.btn} accessibilityRole="button" accessibilityLabel={`${label || 'Date'}: ${value ? fmtDate(value) : 'not set'}`}>
        <CalendarDays size={18} color={C.inkSoft} />
        <Text style={[T.body, { fontWeight: '600', color: value ? C.ink : '#98A39F' }]}>{value ? fmtDate(value) : placeholder}</Text>
      </Pressable>
      {hint ? <Text style={[T.small, { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#CBD5CF',
    backgroundColor: C.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
  },
});
