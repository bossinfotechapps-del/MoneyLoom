import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import DialogShell from './DialogShell';
import { fmt, toNumber } from '../utils/format';
import { GhostButton, LabeledInput, PrimaryButton } from './ui';

// Small dialog to type the current value of one holding
export default function ValueSheet({ holding, onSave, onClose }) {
  const [value, setValue] = useState(String(Math.round(holding.current)));
  const [error, setError] = useState('');
  const onChange = useCallback((v) => setValue(v), []);

  const save = () => {
    const n = toNumber(value);
    if (Number.isNaN(n) || n < 0) {
      setError('Enter the value shown in your app or statement.');
      return;
    }
    onSave(holding.name, n);
    onClose();
  };

  return (
    <DialogShell title={holding.name} subtitle={`Total invested ${fmt(holding.invested)}`} onClose={onClose}
      footer={
        <View style={s.buttons}>
            <GhostButton label="Cancel" onPress={onClose} style={{ flex: 1 }} />
            <PrimaryButton label="Save value" onPress={save} style={{ flex: 1 }} />
        </View>
      }
    >
<LabeledInput
            style={{ marginTop: 16 }}
            label="Current value (₹)"
            value={value}
            onChangeText={onChange}
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
            onSubmitEditing={save}
            hint="Check your broker, MF, PPF or NPS app and enter today's value."
            inputStyle={{ fontSize: 22, fontWeight: '800' }}
          />
          {error ? <Text style={{ color: C.loss, fontWeight: '600', marginTop: 8 }}>{error}</Text> : null}
    </DialogShell>
  );
}

const s = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: 10, marginTop: 18 },
});
