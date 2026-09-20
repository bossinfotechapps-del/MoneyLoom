import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, T } from '../theme';
import { useData } from '../data/DataContext';
import SheetScreen from '../components/SheetScreen';

const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const balanceOf = g => (g.transactions || []).reduce((sum, t) => sum + t.amount, 0);
const validAmount = text => {
  const value = Number(text.trim());
  return text.trim() && Number.isFinite(value) && value > 0 && value <= 1000000000000 ? value : null;
};
const Action = ({ label, onPress, danger, disabled }) => <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, danger && s.danger, disabled && { opacity: 0.4 }]}><Text style={[s.buttonText, danger && { color: C.loss }]}>{label}</Text></Pressable>;
const Field = ({ label, value, onChangeText, placeholder, numeric, multiline }) => <View style={{ gap: 6 }}><Text style={T.label}>{label}</Text><TextInput accessibilityLabel={label} style={[s.input, multiline && { minHeight: 76, textAlignVertical: 'top' }]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.muted} keyboardType={numeric ? 'decimal-pad' : 'default'} multiline={multiline} maxLength={numeric ? 16 : 160} /></View>;

export default function GoalsScreen({ bottomSpace = 100, onToast }) {
  const { data, saveGoal, removeGoal, moveGoalMoney, updateGoalTransaction, removeGoalTransaction } = useData();
  const goals = data.goals || [];
  const [editor, setEditor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [movement, setMovement] = useState(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [editTransaction, setEditTransaction] = useState(null);
  const current = goals.find(g => g.id === selected);
  const openEditor = goal => { setName(goal?.name || ''); setTarget(goal ? String(goal.target) : ''); setDate(goal?.date || ''); setEditor(goal?.id || 'new'); };
  const commitGoal = () => {
    const value = validAmount(target);
    if (!name.trim() || !value) { Alert.alert('Check goal', 'Enter a name and a target greater than zero.'); return; }
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) { Alert.alert('Invalid date', 'Use YYYY-MM-DD or leave the date empty.'); return; }
    saveGoal({ id: editor === 'new' ? undefined : editor, name: name.trim(), target: value, date: date.trim() });
    setEditor(null); onToast?.('Goal saved');
  };
  const commitMovement = () => {
    const value = validAmount(amount);
    if (!value) { Alert.alert('Invalid amount', 'Enter an amount greater than zero.'); return; }
    if (movement === 'withdraw' && value > balanceOf(current)) { Alert.alert('Not enough saved', 'You cannot withdraw more than the pot balance.'); return; }
    moveGoalMoney(selected, movement === 'withdraw' ? -value : value, note.trim());
    setMovement(null); setAmount(''); setNote(''); onToast?.('Savings updated');
  };
  const saveTransactionCorrection = () => {
    const value = validAmount(amount);
    if (!value) { Alert.alert('Invalid amount', 'Enter an amount greater than zero.'); return; }
    const corrected = (editTransaction.amount < 0 ? -1 : 1) * value;
    const nextBalance = balanceOf(current) - editTransaction.amount + corrected;
    if (nextBalance < 0) { Alert.alert('Cannot save', 'This correction would make the savings pot balance negative.'); return; }
    updateGoalTransaction(current.id, editTransaction.id, { amount: corrected, note: note.trim() });
    setEditTransaction(null); onToast?.('Transaction corrected');
  };
  const removeTransaction = t => Alert.alert('Delete transaction?', 'This removes the selected entry from the savings history.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => {
      if (balanceOf(current) - t.amount < 0) { Alert.alert('Cannot delete', 'Deleting this contribution would make the pot balance negative.'); return; }
      removeGoalTransaction(current.id, t.id); onToast?.('Transaction deleted');
    } },
  ]);
  return <View style={{ flex: 1 }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: bottomSpace, gap: 14 }}>
      <View style={s.heading}><View style={{ flex: 1 }}><Text style={T.h1}>Savings goals</Text><Text style={T.small}>Your manual savings pots</Text></View><Action label="+ New" onPress={() => openEditor(null)} /></View>
      {!goals.length && <View style={s.card}><Text style={T.h2}>Start your first savings pot</Text><Text style={T.body}>Set a target, then record contributions whenever you save money.</Text><Action label="Create goal" onPress={() => openEditor(null)} /></View>}
      {goals.map(g => { const saved = balanceOf(g); const progress = Math.min(100, Math.max(0, saved / g.target * 100)); return <Pressable accessibilityRole="button" key={g.id} onPress={() => setSelected(g.id)} style={s.card}><Text style={T.h2}>{g.name}</Text><Text style={s.amount}>{money(saved)} <Text style={T.small}>of {money(g.target)}</Text></Text><View style={s.track}><View style={[s.fill, { width: `${progress}%` }]} /></View><Text style={T.small}>{Math.round(progress)}% saved · {money(Math.max(0, g.target - saved))} remaining{g.date ? ` · Target ${g.date}` : ''}</Text></Pressable>; })}
      <Text style={T.small}>These are tracking pots, not bank accounts. Contributions and withdrawals do not automatically create expenses or change your net worth.</Text>
    </ScrollView>
    {editor !== null && <SheetScreen title={editor === 'new' ? 'New savings goal' : 'Edit savings goal'} onClose={() => setEditor(null)}><Field label="Goal name" value={name} onChangeText={setName} placeholder="Emergency fund" /><Field label="Target amount (₹)" value={target} onChangeText={setTarget} numeric placeholder="100000" /><Field label="Target date (optional)" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" /><Action label="Save goal" onPress={commitGoal} /></SheetScreen>}
    {current && !movement && editor === null && <SheetScreen title={current.name} onClose={() => setSelected(null)}><Text style={s.amount}>{money(balanceOf(current))}</Text><Text style={T.body}>Target: {money(current.target)} · Remaining: {money(Math.max(0, current.target - balanceOf(current)))}</Text>{current.date && <Text style={T.small}>{(() => { const days = Math.ceil((new Date(current.date + 'T12:00:00') - new Date()) / 86400000); const remaining = Math.max(0, current.target - balanceOf(current)); return remaining === 0 ? 'Target reached' : days <= 0 ? 'Target date reached · ' + money(remaining) + ' still needed' : money(remaining / Math.max(1, Math.ceil(days / 30))) + ' per month needed · ' + days + ' days remaining'; })()}</Text>}<View style={s.row}><Action label="+ Add money" onPress={() => { setAmount(''); setNote(''); setMovement('add'); }} /><Action label="− Withdraw" onPress={() => { setAmount(''); setNote(''); setMovement('withdraw'); }} /></View><Action label="Edit goal" onPress={() => openEditor(current)} /><Text style={T.h2}>Transaction history</Text>{[...(current.transactions || [])].reverse().map(t => <View key={t.id} style={s.history}><View style={{ flex: 1 }}><Text style={T.body}>{t.amount > 0 ? 'Added' : 'Withdrawn'} · {new Date(t.date).toLocaleDateString('en-IN')}</Text>{!!t.note && <Text style={T.small}>{t.note}</Text>}</View><View style={{ alignItems: 'flex-end', gap: 6 }}><Text style={[T.body, { color: t.amount > 0 ? C.invest : C.loss }]}>{t.amount > 0 ? '+' : '−'}{money(Math.abs(t.amount))}</Text><View style={s.row}><Action label="Edit" onPress={() => { setAmount(String(Math.abs(t.amount))); setNote(t.note || ''); setEditTransaction(t); }} /><Action label="Delete" danger onPress={() => removeTransaction(t)} /></View></View></View>)}{!current.transactions?.length && <Text style={T.small}>No transactions yet.</Text>}<Action label="Delete goal" danger onPress={() => Alert.alert('Delete savings goal?', 'This permanently deletes the goal and its manual transaction history. It does not move real money.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { removeGoal(current.id); setSelected(null); onToast?.('Goal deleted'); } }])} /></SheetScreen>}
    {current && editTransaction && <SheetScreen title="Correct transaction" onClose={() => setEditTransaction(null)}><Field label="Amount (₹)" value={amount} onChangeText={setAmount} numeric /><Field label="Note (optional)" value={note} onChangeText={setNote} multiline /><Action label="Save correction" onPress={saveTransactionCorrection} /></SheetScreen>}
    {current && movement && <SheetScreen title={movement === 'add' ? 'Add savings' : 'Withdraw savings'} onClose={() => setMovement(null)}><Text style={T.small}>Available: {money(balanceOf(current))}</Text><Field label="Amount (₹)" value={amount} onChangeText={setAmount} numeric placeholder="500" /><Field label="Note (optional)" value={note} onChangeText={setNote} multiline placeholder="What is this for?" /><Action label={movement === 'add' ? 'Add to pot' : 'Withdraw from pot'} onPress={commitMovement} /></SheetScreen>}
  </View>;
}
const s = StyleSheet.create({ heading: { flexDirection: 'row', alignItems: 'center', gap: 8 }, card: { padding: 16, borderRadius: 16, backgroundColor: C.surface, gap: 12, borderWidth: 1, borderColor: C.line }, amount: { fontSize: 25, fontWeight: '800', color: C.invest }, track: { height: 8, backgroundColor: C.lineSoft, borderRadius: 5, overflow: 'hidden' }, fill: { height: 8, backgroundColor: C.invest, borderRadius: 5 }, button: { backgroundColor: C.chip, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', alignSelf: 'flex-start' }, buttonText: { color: C.investDark, fontWeight: '800' }, danger: { backgroundColor: '#FCEBEB' }, input: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 10, color: C.ink, fontSize: 16, paddingHorizontal: 12, paddingVertical: 12 }, row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' }, history: { flexDirection: 'row', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line } });
