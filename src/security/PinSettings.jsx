import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, T } from '../theme';

export default function PinSettings({ lock }) {
  const [mode, setMode] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [current, setCurrent] = useState('');
  const [phrase, setPhrase] = useState('');
  const [phraseConfirm, setPhraseConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const reset = () => { setMode(''); setPin(''); setConfirm(''); setCurrent(''); setPhrase(''); setPhraseConfirm(''); };
  const submit = async () => {
    if (busy) return;
    if (mode === 'enable' || mode === 'change') {
      if (pin.length !== 6 || pin !== confirm) return Alert.alert('PIN mismatch', 'Enter the same six-digit PIN twice.');
    }
    if (mode === 'recovery' && (phrase.trim().length < 16 || phrase.trim().length > 128 || phrase.trim() !== phraseConfirm.trim())) return Alert.alert('Recovery phrase', 'Enter the same recovery phrase twice (16–128 characters).');
    setBusy(true);
    try {
      if (mode === 'enable') {
        await lock.enable(pin);
        reset();
        Alert.alert('PIN enabled', 'Set up a separate recovery phrase now under App Lock. Without one, a forgotten PIN cannot be reset in the app.');
      } else if (mode === 'disable') {
        if (!(await lock.disable(current))) return Alert.alert('Incorrect PIN', 'App Lock was not changed.');
        reset(); Alert.alert('App Lock disabled');
      } else if (mode === 'change') {
        if (!(await lock.changePin(current, pin))) return Alert.alert('Incorrect PIN', 'App Lock was not changed.');
        reset(); Alert.alert('PIN changed', 'Your existing recovery phrase is unchanged.');
      } else if (mode === 'recovery') {
        if (!(await lock.setRecovery(current, phrase))) return Alert.alert('Incorrect PIN', 'Recovery phrase was not changed.');
        reset(); Alert.alert('Recovery phrase saved', 'Keep it somewhere separate and private. You will need the exact phrase if you forget your PIN.');
      }
    } catch (e) { Alert.alert('Could not save App Lock settings', String(e?.message || e)); }
    finally { setBusy(false); }
  };
  return <View style={s.card}>
    <Text style={T.h3}>App Lock</Text>
    <Text style={[T.small, { marginTop: 6, lineHeight: 19 }]}>{lock.enabled ? 'PIN protection is on. MoneyLoom locks when you leave the app.' : 'Optional six-digit PIN to hide MoneyLoom when you leave the app.'} This is a local screen lock, not encryption.</Text>
    {!!lock.error && <Text style={{ color: C.loss }}>{lock.error}</Text>}
    {lock.enabled && <Text style={[T.small, { marginTop: 8, color: lock.recoveryEnabled ? C.invest : C.loss }]}>{lock.recoveryEnabled ? 'Recovery phrase configured.' : 'Recovery is not configured. Set it up before you forget your PIN.'}</Text>}
    {!mode ? <View style={s.actions}>
      {!lock.enabled ? <Pressable style={s.button} onPress={() => setMode('enable')}><Text style={s.buttonText}>Set up PIN</Text></Pressable> : <>
        <Pressable style={s.button} onPress={() => setMode('recovery')}><Text style={s.buttonText}>{lock.recoveryEnabled ? 'Change recovery phrase' : 'Set up recovery'}</Text></Pressable>
        <Pressable style={s.button} onPress={() => setMode('change')}><Text style={s.buttonText}>Change PIN</Text></Pressable>
        <Pressable style={s.button} onPress={() => setMode('disable')}><Text style={s.buttonText}>Turn off</Text></Pressable>
        <Pressable style={s.button} onPress={lock.lock}><Text style={s.buttonText}>Lock now</Text></Pressable>
      </>}
    </View> : <View style={{ marginTop: 12, gap: 10 }}>
      {mode !== 'enable' && <><Text style={T.label}>Current six-digit PIN</Text><TextInput value={current} onChangeText={v => setCurrent(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="Current PIN" placeholderTextColor={C.muted} style={s.input} accessibilityLabel="Current PIN" /></>}
      {(mode === 'enable' || mode === 'change') && <><Text style={T.label}>New six-digit PIN</Text><TextInput value={pin} onChangeText={v => setPin(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="New PIN" placeholderTextColor={C.muted} style={s.input} accessibilityLabel="New PIN" /><Text style={T.label}>Confirm new PIN</Text><TextInput value={confirm} onChangeText={v => setConfirm(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="Repeat PIN" placeholderTextColor={C.muted} style={s.input} accessibilityLabel="Confirm new PIN" /></>}
      {mode === 'recovery' && <><Text style={T.label}>Recovery phrase (16–128 characters)</Text><Text style={T.small}>Choose a separate phrase you can remember or store securely. It is case-sensitive. Anyone who knows it can reset this screen lock.</Text><TextInput value={phrase} onChangeText={setPhrase} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Recovery phrase" placeholderTextColor={C.muted} style={s.input} accessibilityLabel="Recovery phrase" /><Text style={T.label}>Confirm recovery phrase</Text><TextInput value={phraseConfirm} onChangeText={setPhraseConfirm} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Repeat recovery phrase" placeholderTextColor={C.muted} style={s.input} accessibilityLabel="Confirm recovery phrase" /></>}
      <View style={s.actions}><Pressable style={s.button} onPress={reset}><Text style={s.buttonText}>Cancel</Text></Pressable><Pressable disabled={busy} style={[s.button, busy && { opacity: 0.5 }]} onPress={submit}><Text style={s.buttonText}>{busy ? 'Saving…' : 'Save'}</Text></Pressable></View>
    </View>}
  </View>;
}
const s = StyleSheet.create({ card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, button: { backgroundColor: C.invest, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10 }, buttonText: { color: C.white, fontWeight: '700' }, input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 14, color: C.ink, backgroundColor: C.white, height: 50 } });
