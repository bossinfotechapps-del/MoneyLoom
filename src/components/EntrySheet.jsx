import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { CalendarDays, Repeat, Trash } from 'lucide-react-native';
import { C, T } from '../theme';
import { EXPENSE_CATS, INCOME_CATS, INV_TYPES, MODES } from '../data/constants';
import { categoriesFor } from '../data/compute';
import { useData } from '../data/DataContext';
import { currentMonth, dateFromStr, fmtDate, monthKey, monthLabel, strFromDate, todayStr } from '../utils/dates';
import { toNumber, uid } from '../utils/format';
import SheetScreen from './SheetScreen';
import TextPromptDialog from './TextPromptDialog';
import { ChipGroup, GhostButton, LabeledInput, PrimaryButton, Segmented } from './ui';

const blankFor = (tab, date = todayStr(), category) =>
  tab === 'investment'
    ? { action: 'invest', amount: '', date, type: INV_TYPES[0], name: '', note: '' }
    : { kind: tab, amount: '', date, category: category || (tab === 'income' ? INCOME_CATS[0] : EXPENSE_CATS[0]), mode: 'UPI', note: '' };

const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return strFromDate(d);
};

/**
 * Full-screen form for adding or editing an expense, income or investment.
 * Props: initial = { tab, record? }, investmentNames, onSave(tab, record, isEdit, repeatMonthly), onDelete(tab, id), onClose()
 */
export default function EntrySheet({ initial, investmentNames, onSave, onDelete, onClose }) {
  const { data, addCategory } = useData();
  const expenseCats = useMemo(() => categoriesFor(data, 'expense'), [data]);
  const incomeCats = useMemo(() => categoriesFor(data, 'income'), [data]);
  const [newCategory, setNewCategory] = useState(false);
  const noteRef = useRef(null);
  const isEdit = !!initial.record;
  const [tab, setTab] = useState(initial.tab);
  const [form, setForm] = useState(() =>
    initial.record ? { ...initial.record, amount: String(initial.record.amount), note: initial.record.note || '' } : blankFor(initial.tab)
  );
  const [error, setError] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [amountKey, setAmountKey] = useState(0); // remounts the amount input to re-focus after "add another"

  const set = useCallback((k, v) => setForm((f) => ({ ...f, [k]: v })), []);
  const onAmount = useCallback((v) => set('amount', v), [set]);
  const onName = useCallback((v) => set('name', v), [set]);
  const onNote = useCallback((v) => set('note', v), [set]);

  const switchTab = (t) => {
    setTab(t);
    setForm((f) => ({ ...blankFor(t, f.date, t === 'income' ? incomeCats[0] : expenseCats[0]), amount: f.amount }));
    setError('');
  };

  const openDatePicker = () => {
    DateTimePickerAndroid.open({
      value: dateFromStr(form.date),
      mode: 'date',
      onChange: (event, date) => {
        if (event.type === 'set' && date) set('date', strFromDate(date));
      },
    });
  };

  const submit = (addAnother) => {
    const amt = toNumber(form.amount);
    if (!amt || Number.isNaN(amt) || amt <= 0) return setError('Enter an amount greater than zero.');
    if (!form.date) return setError('Pick a date.');
    if (tab === 'investment' && !form.name.trim()) return setError('Name the investment, for example Nifty 50 Index Fund.');
    if (amt > 1e10) return setError('That amount looks too large. Check the number.');

    const record = { ...form, amount: Math.round(amt * 100) / 100, id: form.id || uid(), note: form.note.trim() };
    if (tab === 'investment') record.name = record.name.trim();
    onSave(tab, record, isEdit, !isEdit && repeat);

    if (addAnother) {
      setForm((f) => ({ ...f, id: undefined, amount: '', note: '' }));
      setRepeat(false);
      setError('');
      setAmountKey((k) => k + 1);
    } else {
      onClose();
    }
    return undefined;
  };

  const confirmDelete = () => {
    Alert.alert('Delete this entry?', 'This can’t be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onDelete(tab, form.id);
          onClose();
        },
      },
    ]);
  };

  const cats = tab === 'income' ? incomeCats : expenseCats;
  const catOptions = form.category && !cats.includes(form.category) ? [...cats, form.category] : cats;
  const modeOptions = form.mode && !MODES.includes(form.mode) ? [form.mode, ...MODES] : MODES;
  const nameSuggestions = tab === 'investment'
    ? investmentNames.filter((n) => n !== form.name && (!form.name || n.toLowerCase().includes(form.name.toLowerCase()))).slice(0, 6)
    : [];
  const title = isEdit ? (tab === 'investment' ? 'Edit investment' : tab === 'income' ? 'Edit income' : 'Edit expense') : 'Add entry';
  const today = todayStr();
  const yesterday = yesterdayStr();

  return (
    <SheetScreen
      title={title}
      action={{ label: 'Save', onPress: () => submit(false) }}
      onClose={onClose}
      background={C.surface}
    >
          {!isEdit && (
            <Segmented
              style={{ marginBottom: 14 }}
              options={[['expense', 'Expense'], ['income', 'Income'], ['investment', 'Investment']]}
              value={tab}
              onChange={switchTab}
            />
          )}

          {tab === 'investment' && (
            <Segmented
              style={{ marginBottom: 14 }}
              options={[['invest', 'Money in'], ['withdraw', 'Withdrawal']]}
              value={form.action}
              onChange={(v) => set('action', v)}
            />
          )}

          <LabeledInput
            key={amountKey}
            label="Amount (₹)"
            value={form.amount}
            onChangeText={onAmount}
            placeholder="0"
            keyboardType="decimal-pad"
            autoFocus={!isEdit}
            inputStyle={{ fontSize: 28, fontWeight: '800', paddingVertical: 12 }}
          />

          <Text style={[T.label, { marginTop: 16, marginBottom: 6 }]}>Date</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Pressable onPress={openDatePicker} style={s.dateBtn} accessibilityRole="button" accessibilityLabel="Change date">
              <CalendarDays size={18} color={C.inkSoft} />
              <Text style={[T.body, { fontWeight: '600' }]}>{fmtDate(form.date)}</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <ChipGroup
                options={['Today', 'Yesterday']}
                value={form.date === today ? 'Today' : form.date === yesterday ? 'Yesterday' : null}
                onChange={(v) => set('date', v === 'Today' ? today : yesterday)}
              />
            </View>
          </View>

          {tab === 'investment' ? (
            <>
              <LabeledInput
                style={{ marginTop: 16 }}
                label="Investment name"
                value={form.name}
                onChangeText={onName}
                placeholder="e.g. Nifty 50 Index Fund"
                nextRef={noteRef}
                hint="Use the same name every month so contributions add up under one holding."
                autoCapitalize="words"
              />
              {nameSuggestions.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <ChipGroup options={nameSuggestions} value={null} onChange={(n) => set('name', n)} />
                </View>
              )}
              <Text style={[T.label, { marginTop: 16, marginBottom: 8 }]}>Type</Text>
              <ChipGroup options={INV_TYPES} value={form.type} onChange={(v) => set('type', v)} />
            </>
          ) : (
            <>
              <Text style={[T.label, { marginTop: 16, marginBottom: 8 }]}>Category</Text>
              <ChipGroup
                options={catOptions}
                value={form.category}
                onChange={(v) => set('category', v)}
                addLabel="+ New category"
                onAdd={() => setNewCategory(true)}
              />
              <Text style={[T.label, { marginTop: 16, marginBottom: 8 }]}>{tab === 'income' ? 'Received by' : 'Paid by'}</Text>
              <ChipGroup options={modeOptions} value={form.mode} onChange={(v) => set('mode', v)} />
            </>
          )}

          <LabeledInput
            style={{ marginTop: 16 }}
            label="Note"
            inputRef={noteRef}
            value={form.note}
            onChangeText={onNote}
            placeholder={tab === 'investment' ? 'Optional' : 'e.g. Weekly groceries'}
            returnKeyType="done"
            onSubmitEditing={() => submit(false)}
          />

          {!isEdit && (
            <View style={s.repeatRow}>
              <Repeat size={18} color={C.inkSoft} />
              <View style={{ flex: 1 }}>
                <Text style={[T.body, { fontWeight: '600' }]}>Repeat every month</Text>
                <Text style={T.small}>
                  {repeat
                    ? `Added automatically on day ${Number(form.date.slice(8, 10))} of each month.${
                        monthKey(form.date) < currentMonth() ? ` Months since ${monthLabel(monthKey(form.date))} are added too.` : ''
                      }`
                    : 'For rent, EMI, salary, SIP and other fixed amounts.'}
                </Text>
              </View>
              <Switch
                value={repeat}
                onValueChange={setRepeat}
                trackColor={{ false: C.line, true: '#8BBDB9' }}
                thumbColor={repeat ? C.invest : '#F4F4F4'}
                accessibilityLabel="Repeat every month"
              />
            </View>
          )}

          {isEdit && form.recurringId ? (
            <Text style={[T.small, { marginTop: 14 }]}>
              Added by a monthly repeat. Changes here apply to this month only. Manage repeats in More.
            </Text>
          ) : null}

          {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : null}

          <View style={{ marginTop: 20, gap: 10 }}>
            <PrimaryButton label={isEdit ? 'Save changes' : 'Save entry'} onPress={() => submit(false)} />
            {!isEdit && <GhostButton label="Save and add another" onPress={() => submit(true)} />}
            {isEdit && (
              <GhostButton
                label="Delete entry"
                color={C.loss}
                icon={<Trash size={16} color={C.loss} />}
                onPress={confirmDelete}
              />
            )}
          </View>

      {newCategory && (
        <TextPromptDialog
          title="New category"
          subtitle={`Your own ${tab === 'income' ? 'income' : 'expense'} category, saved for next time.`}
          label="Category name"
          placeholder={tab === 'income' ? 'e.g. Rent received' : 'e.g. Insurance'}
          onClose={() => setNewCategory(false)}
          onSave={(name) => {
            const result = addCategory(tab, name);
            if (!result) return { error: 'Enter a category name.' };
            set('category', result.name);
            return null;
          }}
        />
      )}
    </SheetScreen>
  );
}


const s = StyleSheet.create({
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#CBD5CF',
    backgroundColor: C.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  error: { color: C.loss, fontWeight: '600', marginTop: 12 },
  repeatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, padding: 12,
    borderRadius: 12, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line,
  },
});
