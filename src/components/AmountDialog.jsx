import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import DialogShell from './DialogShell';
import { toNumber } from '../utils/format';
import { GhostButton, LabeledInput, PrimaryButton } from './ui';

// Small dialog for changing one amount (used for monthly repeats)
export default function AmountDialog({ title, subtitle, label, initial, hint, onSave, onClose }) {
  const [value, setValue] = useState(String(initial ?? ''));
  const [error, setError] = useState('');
  const onChange = useCallback((v) => setValue(v), []);

  const save = () => {
    const n = toNumber(value);
    if (Number.isNaN(n) || n <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    onSave(Math.round(n * 100) / 100);
    onClose();
  };

  return (
    <DialogShell title={title} subtitle={subtitle} onClose={onClose}
      footer={
        <View style={s.buttons}>
            <GhostButton label="Cancel" onPress={onClose} style={{ flex: 1 }} />
            <PrimaryButton label="Save" onPress={save} style={{ flex: 1 }} />
        </View>
      }
    >
<LabeledInput
            style={{ marginTop: 16 }}
            label={label}
            value={value}
            onChangeText={onChange}
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
            onSubmitEditing={save}
            hint={hint}
            inputStyle={{ fontSize: 22, fontWeight: '800' }}
          />
          {error ? <Text style={{ color: C.loss, fontWeight: '600', marginTop: 8 }}>{error}</Text> : null}
    </DialogShell>
  );
}

const s = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: 10, marginTop: 18 },
});
