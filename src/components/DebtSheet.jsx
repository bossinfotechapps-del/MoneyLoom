import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import {
  Building, Car, CreditCard, Gem, GraduationCap, HandCoins, HandHeart, House, Landmark, ShoppingBag, Users, Wallet } from 'lucide-react-native';
import { C, T } from '../theme';
import { DEBT_TYPES, RECORD_MODES, emiFor, hasSchedule, kindOf } from '../data/debts';
import { addMonthsDate, monthYear, todayStr } from '../utils/dates';
import { fmt, toNumber, uid } from '../utils/format';
import SheetScreen from './SheetScreen';
import DateField from './DateField';
import { LabeledInput, PrimaryButton, Segmented } from './ui';

const ICONS = { House, Car, Wallet, GraduationCap, Gem, CreditCard, ShoppingBag, Building, Landmark, HandCoins, HandHeart, Users };

const NAME_LABEL = {
  loan: ['Lender', 'Bank or lender name'],
  gold: ['Lender', 'Bank or finance company'],
  card: ['Card name', 'Salary account card'],
  paylater: ['What you bought', 'Phone on no-cost EMI'],
  hand: ['Who lent you the money', 'Ravi'],
  lent: ['Who borrowed from you', 'Suresh'],
  chit: ['Chit name', 'Office chit group'],
};

const RECORD_HELP = {
  ask: 'Each payment shows up for you to confirm. Payments you mark as paid are added to your expenses.',
  auto: 'Payments are added to your expenses automatically on their due date.',
  none: 'Nothing is added to your expenses. Choose this if you already log these payments yourself.',
};

const str = (v) => (v === undefined || v === null ? '' : String(v));

// Form state (strings) from a saved debt
const toForm = (d) => ({
  name: str(d.name), note: str(d.note),
  principal: str(d.principal), rate: str(d.rate), tenureMonths: str(d.tenureMonths), emi: d.emiCustom ? str(d.emi) : '',
  firstEmiDate: d.firstEmiDate || '', startDate: d.startDate || '', studyInterest: d.studyInterest || 'add', currentLeft: '',
  maturityDate: d.maturityDate || '', grams: str(d.grams), goldStyle: d.goldStyle || 'interestMonthly',
  billAmount: str(d.billAmount), billDueDate: d.billDueDate || '',
  instalment: str(d.instalment), instalments: str(d.instalments), firstDate: d.firstDate || '',
  ratePerMonth: str(d.ratePerMonth), promisedDate: d.promisedDate || '',
  months: str(d.months), taken: !!d.taken, takenDate: d.takenDate || '', receivedAmount: str(d.receivedAmount),
  recordMode: d.recordMode || 'ask',
});

const EMPTY_FORM = toForm({ rate: '', goldStyle: 'interestMonthly', recordMode: 'ask' });

/**
 * initial: { debt?, group?: 'owe' | 'lent' }
 * onSave(debt), onClose()
 */
export default function DebtSheet({ initial, onSave, onClose }) {
  const editing = initial.debt || null;
  const [type, setType] = useState(editing ? editing.type : null);
  const [f, setF] = useState(() => (editing ? toForm(editing) : EMPTY_FORM));
  const [error, setError] = useState('');
  const set = (k) => (v) => setF((prev) => ({ ...prev, [k]: v }));

  const kind = type ? kindOf(type) : null;
  const today = todayStr();

  const pickType = (t) => {
    const k = kindOf(t);
    setType(t);
    setError('');
    setF((prev) => ({
      ...prev,
      rate: prev.rate || (k === 'card' ? '42' : ''),
      ratePerMonth: prev.ratePerMonth || (k === 'hand' || k === 'lent' ? '0' : ''),
      startDate: prev.startDate || (k === 'gold' || k === 'hand' || k === 'lent' ? today : ''),
    }));
  };

  // Live loan preview
  const preview = useMemo(() => {
    if (kind === 'loan') {
      const P = toNumber(f.principal);
      const n = Math.round(toNumber(f.tenureMonths));
      const r = toNumber(f.rate);
      if (!(P > 0) || !(n > 0) || Number.isNaN(r)) return null;
      const calc = emiFor(P, r, n);
      const emi = toNumber(f.emi) > 0 ? toNumber(f.emi) : calc;
      const ends = f.firstEmiDate ? addMonthsDate(f.firstEmiDate, n - 1) : null;
      return { calc, text: `EMI ${fmt(emi)}${ends ? `, ends ${monthYear(ends)}` : ''}, total interest about ${fmt(Math.max(0, emi * n - P))}` };
    }
    if (kind === 'gold') {
      const P = toNumber(f.principal);
      const r = toNumber(f.rate);
      if (!(P > 0) || Number.isNaN(r)) return null;
      if (f.goldStyle === 'interestMonthly') return { text: `Interest about ${fmt((P * r) / 1200)} a month, full ${fmt(P)} due at maturity` };
      if (f.goldStyle === 'emi' && f.startDate && f.maturityDate) {
        const months = Math.max(1, (Number(f.maturityDate.slice(0, 4)) - Number(f.startDate.slice(0, 4))) * 12 + Number(f.maturityDate.slice(5, 7)) - Number(f.startDate.slice(5, 7)));
        return { text: `EMI about ${fmt(emiFor(P, r, months))} for ${months} months` };
      }
      return { text: 'Principal and interest paid together at maturity' };
    }
    if (kind === 'paylater') {
      const a = toNumber(f.instalment);
      const n = Math.round(toNumber(f.instalments));
      if (a > 0 && n > 0) return { text: `${fmt(a * n)} in total over ${n} months${f.firstDate ? `, last one ${monthYear(addMonthsDate(f.firstDate, n - 1))}` : ''}` };
    }
    if (kind === 'chit') {
      const a = toNumber(f.instalment);
      const n = Math.round(toNumber(f.months));
      if (a > 0 && n > 0) return { text: `You pay up to ${fmt(a * n)} over ${n} months` };
    }
    return null;
  }, [kind, f]);

  const num = (v) => toNumber(v);
  const need = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };

  const save = () => {
    try {
      need(f.name.trim(), `Enter ${NAME_LABEL[kind][0].toLowerCase()}.`);
      const base = {
        ...(editing || {}),
        id: editing?.id || uid(),
        type,
        kind,
        name: f.name.trim(),
        note: f.note.trim(),
        createdOn: editing?.createdOn || today,
        closed: editing?.closed || false,
      };
      let debt;
      if (kind === 'loan') {
        need(num(f.principal) > 0, 'Enter the loan amount.');
        need(num(f.rate) >= 0 && f.rate !== '', 'Enter the interest rate (0 if none).');
        need(Math.round(num(f.tenureMonths)) >= 1, 'Enter the tenure in months.');
        need(f.firstEmiDate, type === 'Education loan' ? 'Pick the date EMIs start.' : 'Pick the first EMI date.');
        if (type === 'Education loan') need(f.startDate && f.startDate < f.firstEmiDate, 'Pick when the loan was taken (before EMIs start).');
        const calc = emiFor(num(f.principal), num(f.rate), Math.round(num(f.tenureMonths)));
        const custom = num(f.emi) > 0;
        debt = {
          ...base,
          principal: num(f.principal), rate: num(f.rate), tenureMonths: Math.round(num(f.tenureMonths)),
          firstEmiDate: f.firstEmiDate, startDate: type === 'Education loan' ? f.startDate : f.startDate || undefined,
          studyInterest: type === 'Education loan' ? f.studyInterest : undefined,
          emi: custom ? num(f.emi) : Math.round(calc * 100) / 100, emiCustom: custom,
          prepayMode: editing?.prepayMode || 'tenure',
          recordMode: f.recordMode,
        };
        if (!editing && num(f.currentLeft) > 0) debt.overrides = [{ id: uid(), date: today, value: num(f.currentLeft) }];
      } else if (kind === 'gold') {
        need(num(f.principal) > 0, 'Enter the loan amount.');
        need(f.rate !== '' && num(f.rate) >= 0, 'Enter the interest rate.');
        need(f.startDate, 'Pick the loan date.');
        need(f.maturityDate && f.maturityDate > f.startDate, 'Pick a maturity date after the loan date.');
        debt = {
          ...base, principal: num(f.principal), rate: num(f.rate), startDate: f.startDate, maturityDate: f.maturityDate,
          grams: num(f.grams) > 0 ? num(f.grams) : undefined, goldStyle: f.goldStyle,
          recordMode: f.goldStyle === 'interestEnd' ? 'none' : f.recordMode,
        };
      } else if (kind === 'card') {
        need(f.billAmount === '' || num(f.billAmount) >= 0, 'Enter the bill amount.');
        need(f.rate !== '' && num(f.rate) >= 0, 'Enter the card interest rate.');
        if (num(f.billAmount) > 0) need(f.billDueDate, 'Pick the bill due date.');
        const billChanged = !editing || num(f.billAmount) !== Number(editing.billAmount) || f.billDueDate !== editing.billDueDate;
        debt = {
          ...base, rate: num(f.rate), billAmount: num(f.billAmount) || 0, billDueDate: f.billDueDate || '',
          billDate: billChanged ? today : editing.billDate, payments: editing?.payments || [], recordMode: 'none',
        };
      } else if (kind === 'paylater') {
        need(num(f.instalment) > 0, 'Enter the instalment amount.');
        need(Math.round(num(f.instalments)) >= 1, 'Enter the number of instalments.');
        need(f.firstDate, 'Pick the first instalment date.');
        debt = { ...base, instalment: num(f.instalment), instalments: Math.round(num(f.instalments)), firstDate: f.firstDate, recordMode: f.recordMode };
      } else if (kind === 'hand' || kind === 'lent') {
        need(num(f.principal) > 0, kind === 'lent' ? 'Enter the amount you lent.' : 'Enter the amount you borrowed.');
        need(f.startDate, 'Pick the date.');
        need(f.ratePerMonth === '' || num(f.ratePerMonth) >= 0, 'Enter the interest per month (0 if none).');
        debt = {
          ...base, principal: num(f.principal), ratePerMonth: num(f.ratePerMonth) || 0, startDate: f.startDate,
          promisedDate: f.promisedDate || '', payments: editing?.payments || [], recordMode: 'none',
        };
      } else if (kind === 'chit') {
        need(num(f.instalment) > 0, 'Enter the monthly instalment.');
        need(Math.round(num(f.months)) >= 1, 'Enter the total months.');
        need(f.firstDate, 'Pick the first instalment date.');
        if (f.taken) {
          need(f.takenDate, 'Pick the date you took the chit.');
          need(num(f.receivedAmount) > 0, 'Enter the amount you received.');
        }
        debt = {
          ...base, instalment: num(f.instalment), months: Math.round(num(f.months)),
          firstDate: f.firstDate, taken: f.taken, takenDate: f.taken ? f.takenDate : '', receivedAmount: f.taken ? num(f.receivedAmount) : undefined,
          recordMode: f.recordMode,
        };
      }
      onSave(debt);
      onClose();
    } catch (e) {
      setError(e.message);
    }
  };

  const types = initial.group === 'lent'
    ? [...DEBT_TYPES.filter((t) => t.kind === 'lent' || t.kind === 'chit'), ...DEBT_TYPES.filter((t) => t.kind !== 'lent' && t.kind !== 'chit')]
    : DEBT_TYPES;

  const title = editing ? `Edit ${type.toLowerCase()}` : type ? type : 'What would you like to add?';
  const showRecordMode = kind && hasSchedule({ kind, goldStyle: f.goldStyle });

  return (
    <SheetScreen
      title={title}
      action={type ? { label: 'Save', onPress: save } : null}
      onClose={onClose}
      background={C.surface}
    >
          {!type ? (
            <View style={s.grid}>
              {types.map((t) => {
                const Icon = ICONS[t.icon] || Landmark;
                return (
                  <Pressable key={t.type} onPress={() => pickType(t.type)} style={s.typeCard} android_ripple={{ color: C.lineSoft }} accessibilityRole="button">
                    <Icon size={22} color={t.kind === 'lent' || t.kind === 'chit' ? C.invest : C.inkSoft} />
                    <Text style={[T.body, { fontWeight: '600', marginTop: 8 }]}>{t.type}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {!editing && (
                <Pressable onPress={() => setType(null)} accessibilityRole="button">
                  <Text style={{ color: C.invest, fontWeight: '700' }}>Change type</Text>
                </Pressable>
              )}

              <LabeledInput label={NAME_LABEL[kind][0]} value={f.name} onChangeText={set('name')} placeholder={NAME_LABEL[kind][1]} autoCapitalize="words" />

              {kind === 'loan' && (
                <>
                  <LabeledInput label="Loan amount (₹)" value={f.principal} onChangeText={set('principal')} keyboardType="decimal-pad" placeholder="500000" />
                  <View style={s.row2}>
                    <LabeledInput style={{ flex: 1 }} label="Interest % a year" value={f.rate} onChangeText={set('rate')} keyboardType="decimal-pad" placeholder="9.5" />
                    <LabeledInput style={{ flex: 1 }} label="Tenure (months)" value={f.tenureMonths} onChangeText={set('tenureMonths')} keyboardType="number-pad" placeholder="240" hint="20 years = 240" />
                  </View>
                  {type === 'Education loan' && (
                    <>
                      <DateField label="Loan taken on" value={f.startDate} onChange={set('startDate')} />
                      <View>
                        <Text style={[T.label, { marginBottom: 6 }]}>Interest during study</Text>
                        <Segmented options={[['add', 'Added to loan'], ['monthly', 'Paid monthly']]} value={f.studyInterest} onChange={set('studyInterest')} />
                      </View>
                    </>
                  )}
                  <DateField label={type === 'Education loan' ? 'EMIs start on' : 'First EMI date'} value={f.firstEmiDate} onChange={set('firstEmiDate')} hint="EMIs are due on this day every month." />
                  <LabeledInput
                    label="EMI (₹)"
                    value={f.emi}
                    onChangeText={set('emi')}
                    keyboardType="decimal-pad"
                    placeholder={preview ? String(Math.round(preview.calc)) : 'Calculated automatically'}
                    hint="Leave empty to use the calculated EMI, or enter the exact EMI from your bank."
                  />
                  {!editing && (
                    <LabeledInput
                      label="Amount left today (optional)"
                      value={f.currentLeft}
                      onChangeText={set('currentLeft')}
                      keyboardType="decimal-pad"
                      placeholder="From your bank app"
                      hint="For an older loan, this makes the balance match your bank."
                    />
                  )}
                </>
              )}

              {kind === 'gold' && (
                <>
                  <LabeledInput label="Loan amount (₹)" value={f.principal} onChangeText={set('principal')} keyboardType="decimal-pad" placeholder="50000" />
                  <View style={s.row2}>
                    <LabeledInput style={{ flex: 1 }} label="Interest % a year" value={f.rate} onChangeText={set('rate')} keyboardType="decimal-pad" placeholder="12" />
                    <LabeledInput style={{ flex: 1 }} label="Gold pledged (g)" value={f.grams} onChangeText={set('grams')} keyboardType="decimal-pad" placeholder="Optional" />
                  </View>
                  <View style={s.row2}>
                    <DateField style={{ flex: 1 }} label="Loan date" value={f.startDate} onChange={set('startDate')} />
                    <DateField style={{ flex: 1 }} label="Maturity date" value={f.maturityDate} onChange={set('maturityDate')} />
                  </View>
                  <View>
                    <Text style={[T.label, { marginBottom: 6 }]}>How you repay</Text>
                    <Segmented options={[['interestMonthly', 'Interest monthly'], ['interestEnd', 'All at end'], ['emi', 'EMI']]} value={f.goldStyle} onChange={set('goldStyle')} />
                  </View>
                </>
              )}

              {kind === 'card' && (
                <>
                  <View style={s.row2}>
                    <LabeledInput style={{ flex: 1 }} label="Current bill (₹)" value={f.billAmount} onChangeText={set('billAmount')} keyboardType="decimal-pad" placeholder="0" />
                    <LabeledInput style={{ flex: 1 }} label="Interest % a year" value={f.rate} onChangeText={set('rate')} keyboardType="decimal-pad" hint="Often 36–48%" />
                  </View>
                  <DateField label="Bill due date" value={f.billDueDate} onChange={set('billDueDate')} />
                  <Text style={T.small}>Card spends are already logged as expenses, so paying the bill isn’t added again.</Text>
                </>
              )}

              {kind === 'paylater' && (
                <>
                  <View style={s.row2}>
                    <LabeledInput style={{ flex: 1 }} label="Instalment (₹)" value={f.instalment} onChangeText={set('instalment')} keyboardType="decimal-pad" placeholder="5000" />
                    <LabeledInput style={{ flex: 1 }} label="Instalments" value={f.instalments} onChangeText={set('instalments')} keyboardType="number-pad" placeholder="6" />
                  </View>
                  <DateField label="First instalment date" value={f.firstDate} onChange={set('firstDate')} hint="Instalments before today are counted as paid." />
                </>
              )}

              {(kind === 'hand' || kind === 'lent') && (
                <>
                  <LabeledInput label={kind === 'lent' ? 'Amount lent (₹)' : 'Amount borrowed (₹)'} value={f.principal} onChangeText={set('principal')} keyboardType="decimal-pad" placeholder="10000" />
                  <View style={s.row2}>
                    <DateField style={{ flex: 1 }} label="Date" value={f.startDate} onChange={set('startDate')} />
                    <LabeledInput style={{ flex: 1 }} label="Interest % a month" value={f.ratePerMonth} onChangeText={set('ratePerMonth')} keyboardType="decimal-pad" placeholder="0" hint="₹2 per ₹100 = 2" />
                  </View>
                  <DateField label={kind === 'lent' ? 'Expected back by (optional)' : 'Promised repayment date (optional)'} value={f.promisedDate} onChange={set('promisedDate')} placeholder="No date" />
                </>
              )}

              {kind === 'chit' && (
                <>
                  <View style={s.row2}>
                    <LabeledInput style={{ flex: 1 }} label="Monthly instalment (₹)" value={f.instalment} onChangeText={set('instalment')} keyboardType="decimal-pad" placeholder="5000" />
                    <LabeledInput style={{ flex: 1 }} label="Total months" value={f.months} onChangeText={set('months')} keyboardType="number-pad" placeholder="20" />
                  </View>
                  <DateField label="First instalment date" value={f.firstDate} onChange={set('firstDate')} hint="Instalments before today are counted as paid." />
                  <View style={s.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[T.body, { fontWeight: '600' }]}>I’ve taken the chit</Text>
                      <Text style={T.small}>After taking it, the remaining instalments count as money you owe.</Text>
                    </View>
                    <Switch value={f.taken} onValueChange={set('taken')} trackColor={{ false: C.line, true: '#8BBDB9' }} thumbColor={f.taken ? C.invest : '#F4F4F4'} accessibilityLabel="I’ve taken the chit" />
                  </View>
                  {f.taken && (
                    <View style={s.row2}>
                      <DateField style={{ flex: 1 }} label="Taken on" value={f.takenDate} onChange={set('takenDate')} />
                      <LabeledInput style={{ flex: 1 }} label="Amount received (₹)" value={f.receivedAmount} onChangeText={set('receivedAmount')} keyboardType="decimal-pad" placeholder="88000" />
                    </View>
                  )}
                </>
              )}

              {preview && <View style={s.preview}><Text style={[T.body, { fontWeight: '600', color: C.investDark }]}>{preview.text}</Text></View>}

              {showRecordMode && (
                <View>
                  <Text style={[T.label, { marginBottom: 6 }]}>Recording payments</Text>
                  <Segmented options={RECORD_MODES} value={f.recordMode} onChange={set('recordMode')} />
                  <Text style={[T.small, { marginTop: 6, lineHeight: 18 }]}>
                    {kind === 'chit'
                      ? RECORD_HELP[f.recordMode].replace('expenses', 'records (as invested before you take the chit, as EMI after)')
                      : RECORD_HELP[f.recordMode]}
                  </Text>
                </View>
              )}

              <LabeledInput label="Note (optional)" value={f.note} onChangeText={set('note')} placeholder="Account number, branch, anything useful" />

              {error ? <Text style={{ color: C.loss, fontWeight: '600' }} accessibilityLiveRegion="polite">{error}</Text> : null}
              <PrimaryButton label={editing ? 'Save changes' : 'Save'} onPress={save} />
            </View>
          )}
    </SheetScreen>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: { width: '48%', flexGrow: 1, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, backgroundColor: C.white, overflow: 'hidden' },
  row2: { flexDirection: 'row', gap: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line },
  preview: { backgroundColor: '#E4F0EE', borderRadius: 12, padding: 12 },
});
