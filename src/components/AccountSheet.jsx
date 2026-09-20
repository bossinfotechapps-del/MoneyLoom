import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Trash } from 'lucide-react-native';
import { C, T } from '../theme';
import { ACCOUNT_TYPES } from '../data/constants';
import { todayStr } from '../utils/dates';
import { toNumber, uid } from '../utils/format';
import SheetScreen from './SheetScreen';
import { ChipGroup, GhostButton, LabeledInput, PrimaryButton } from './ui';

const str = (v) => (v === undefined || v === null ? '' : String(v));

/**
 * Add or edit a bank or cash account. Balances are typed in by hand: MoneyLoom never connects
 * to a bank, so this is a note of what you saw in your banking app.
 */
export default function AccountSheet({ initial, onSave, onDelete, onClose }) {
  const editing = initial?.account || null;
  const [name, setName] = useState(str(editing?.name));
  const [type, setType] = useState(editing?.type || ACCOUNT_TYPES[0]);
  const [balance, setBalance] = useState(editing ? String(editing.balance) : '');
  const [last4, setLast4] = useState(str(editing?.last4));
  const [error, setError] = useState('');

  const save = () => {
    if (!name.trim()) return setError('Name the account, for example HDFC Savings.');
    const amount = toNumber(balance);
    if (balance === '' || Number.isNaN(amount)) return setError('Enter the balance, or 0 if it’s empty.');
    if (last4 && !/^\d{4}$/.test(last4.trim())) return setError('Last 4 digits should be four numbers, or leave it blank.');

    const account = {
      ...(editing || {}),
      id: editing?.id || uid(),
      name: name.trim(),
      type,
      last4: last4.trim(),
      balance: Math.round(amount * 100) / 100,
      updatedOn: todayStr(),
      history: editing?.history || [],
    };
    onSave(account);
    onClose();
    return undefined;
  };

  const confirmDelete = () => {
    Alert.alert(`Remove ${editing.name}?`, 'Its balance stops counting towards your net worth. Your entries are untouched.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          onDelete(editing.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <SheetScreen
      title={editing ? 'Edit account' : 'Add account'}
      action={{ label: 'Save', onPress: save }}
      onClose={onClose}
      background={C.surface}
    >
          <LabeledInput label="Account name" value={name} onChangeText={setName} placeholder="e.g. HDFC Savings" autoCapitalize="words" />

          <View>
            <Text style={[T.label, { marginBottom: 8 }]}>Type</Text>
            <ChipGroup options={ACCOUNT_TYPES} value={type} onChange={setType} />
          </View>

          <LabeledInput
            label="Balance today (₹)"
            value={balance}
            onChangeText={setBalance}
            keyboardType="decimal-pad"
            placeholder="0"
            hint="Open your banking app and copy what it shows."
            inputStyle={{ fontSize: 22, fontWeight: '800' }}
          />

          <LabeledInput
            label="Last 4 digits (optional)"
            value={last4}
            onChangeText={setLast4}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="1234"
            hint="Only to tell two accounts apart. Never enter a full account number."
          />

          {error ? <Text style={{ color: C.loss, fontWeight: '600' }} accessibilityLiveRegion="polite">{error}</Text> : null}

          <PrimaryButton label={editing ? 'Save changes' : 'Add account'} onPress={save} />
          {editing && (
            <GhostButton label="Remove account" color={C.loss} icon={<Trash size={16} color={C.loss} />} onPress={confirmDelete} />
          )}
    </SheetScreen>
  );
}

