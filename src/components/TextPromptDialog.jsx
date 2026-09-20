import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import DialogShell from './DialogShell';
import { GhostButton, LabeledInput, PrimaryButton } from './ui';

/** Dialog for a single line of text, used for creating a category. */
export default function TextPromptDialog({ title, subtitle, label, placeholder, initial = '', maxLength = 28, saveLabel = 'Add', onSave, onClose }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  const onChange = useCallback((v) => setValue(v), []);

  const save = () => {
    const name = value.trim();
    if (name.length < 2) {
      setError('Enter at least 2 characters.');
      return;
    }
    const result = onSave(name);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <DialogShell title={title} subtitle={subtitle} onClose={onClose}
      footer={
        <View style={s.buttons}>
            <GhostButton label="Cancel" onPress={onClose} style={{ flex: 1 }} />
            <PrimaryButton label={saveLabel} onPress={save} style={{ flex: 1 }} />
        </View>
      }
    >
<LabeledInput
            style={{ marginTop: 14 }}
            label={label}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            autoFocus
            autoCapitalize="sentences"
            maxLength={maxLength}
            returnKeyType="done"
            onSubmitEditing={save}
          />
          {error ? <Text style={{ color: C.loss, fontWeight: '600', marginTop: 8 }}>{error}</Text> : null}
    </DialogShell>
  );
}

const s = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: 10, marginTop: 18 },
});
