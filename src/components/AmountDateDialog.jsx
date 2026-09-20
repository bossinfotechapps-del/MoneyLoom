import React, { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { C, T } from '../theme';
import DialogShell from './DialogShell';
import { todayStr } from '../utils/dates';
import { toNumber } from '../utils/format';
import DateField from './DateField';
import { GhostButton, LabeledInput, PrimaryButton } from './ui';

/**
 * Dialog for one amount (or rate) plus a date, with an optional switch.
 * onSave({ amount, date, switchOn })
 */
export default function AmountDateDialog({
  title, subtitle, label = 'Amount (₹)', initialAmount = '', initialDate, hint, dateLabel = 'Date',
  switchLabel, switchInitial = false, allowZero = false, saveLabel = 'Save', onSave, onClose,
}) {
  const [amount, setAmount] = useState(String(initialAmount ?? ''));
  const [date, setDate] = useState(initialDate || todayStr());
  const [switchOn, setSwitchOn] = useState(switchInitial);
  const [error, setError] = useState('');
  const onAmount = useCallback((v) => setAmount(v), []);

  const save = () => {
    const n = toNumber(amount);
    if (Number.isNaN(n) || n < 0 || (!allowZero && n === 0)) {
      setError(allowZero ? 'Enter a number, 0 or more.' : 'Enter an amount greater than zero.');
      return;
    }
    onSave({ amount: Math.round(n * 100) / 100, date, switchOn });
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
            value={amount}
            onChangeText={onAmount}
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
            hint={hint}
            inputStyle={{ fontSize: 22, fontWeight: '800' }}
          />
          <DateField style={{ marginTop: 12 }} label={dateLabel} value={date} onChange={setDate} />
          {switchLabel ? (
            <View style={s.switchRow}>
              <Text style={[T.body, { flex: 1 }]}>{switchLabel}</Text>
              <Switch
                value={switchOn}
                onValueChange={setSwitchOn}
                trackColor={{ false: C.line, true: '#8BBDB9' }}
                thumbColor={switchOn ? C.invest : '#F4F4F4'}
                accessibilityLabel={switchLabel}
              />
            </View>
          ) : null}
          {error ? <Text style={{ color: C.loss, fontWeight: '600', marginTop: 8 }}>{error}</Text> : null}
    </DialogShell>
  );
}

const s = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: 10, marginTop: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
});
