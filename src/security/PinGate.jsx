import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Keyboard, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';
import { useAppLock } from './AppLock';

export default function PinGate() {
  const lock = useAppLock();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState('unlock');
  const [value, setValue] = useState('');
  const [phrase, setPhrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const reset = () => { setMode('unlock'); setValue(''); setPhrase(''); setConfirm(''); setMessage(''); };
  const submit = async () => {
    if (busy) return;
    if (mode === 'unlock') {
      if (lock.unlock(value)) { reset(); Keyboard.dismiss(); }
      else { setValue(''); setMessage('Incorrect PIN. Try again.'); }
      return;
    }
    if (value.length !== 6 || value !== confirm) { setMessage('Enter the same new six-digit PIN twice.'); return; }
    setBusy(true);
    try {
      if (await lock.recoverPin(phrase, value)) { reset(); Keyboard.dismiss(); }
      else setMessage('Recovery phrase does not match.');
    } catch (e) { setMessage(String(e?.message || e)); }
    finally { setBusy(false); }
  };
  return <View style={[s.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
    <StatusBar barStyle="dark-content" backgroundColor={C.paper} />
    <Text style={s.title}>{mode === 'unlock' ? 'MoneyLoom is locked' : 'Reset your PIN'}</Text>
    <Text style={s.help}>{mode === 'unlock' ? 'Enter your six-digit PIN to continue.' : 'Enter the recovery phrase you saved when App Lock was set up.'}</Text>
    {mode === 'recover' && <TextInput value={phrase} onChangeText={setPhrase} placeholder="Recovery phrase" placeholderTextColor={C.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} accessibilityLabel="Recovery phrase" style={s.phrase} />}
    <TextInput autoFocus={mode === 'unlock'} value={value} onChangeText={v => { setValue(v.replace(/\D/g, '').slice(0, 6)); setMessage(''); }}
      keyboardType="number-pad" maxLength={6} secureTextEntry textContentType="password" autoComplete="off"
      placeholder={mode === 'recover' ? 'New six-digit PIN' : 'Six-digit PIN'} placeholderTextColor={C.muted}
      accessibilityLabel={mode === 'recover' ? 'New six-digit PIN' : 'MoneyLoom six-digit PIN'} style={s.input} onSubmitEditing={submit} />
    {mode === 'recover' && <TextInput value={confirm} onChangeText={v => setConfirm(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="Confirm new PIN" placeholderTextColor={C.muted} accessibilityLabel="Confirm new PIN" style={s.input} />}
    {!!message && <Text style={s.error}>{message}</Text>}
    <Pressable accessibilityRole="button" disabled={busy || value.length !== 6 || (mode === 'recover' && (!phrase.trim() || confirm.length !== 6))} onPress={submit} style={[s.button, (busy || value.length !== 6 || (mode === 'recover' && (!phrase.trim() || confirm.length !== 6))) && { opacity: 0.45 }]}>
      <Text style={s.buttonText}>{busy ? 'Please wait…' : mode === 'unlock' ? 'Unlock' : 'Reset PIN and unlock'}</Text>
    </Pressable>
    {mode === 'unlock' ? <Pressable accessibilityRole="button" onPress={() => { setMode('recover'); setValue(''); setMessage(''); }}><Text style={s.link}>Forgot PIN?</Text></Pressable> : <Pressable accessibilityRole="button" onPress={reset}><Text style={s.link}>Back to unlock</Text></Pressable>}
    {mode === 'recover' && !lock.recoveryEnabled && <Text style={s.help}>No recovery phrase was configured for this PIN. Do not clear app data or uninstall MoneyLoom: locally stored records may be lost.</Text>}
    <Text style={s.help}>This is a local screen lock, not encryption. Keep a separate backup of your financial records.</Text>
  </View>;
}
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: C.paper, paddingHorizontal: 28, justifyContent: 'center' }, title: { color: C.ink, fontSize: 28, fontWeight: '800', textAlign: 'center' }, help: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 14 }, input: { marginTop: 14, borderWidth: 1, borderColor: C.line, borderRadius: 14, backgroundColor: C.white, color: C.ink, fontSize: 20, textAlign: 'center', height: 54 }, phrase: { marginTop: 18, borderWidth: 1, borderColor: C.line, borderRadius: 14, backgroundColor: C.white, color: C.ink, paddingHorizontal: 12, height: 54 }, error: { color: C.loss, textAlign: 'center', marginTop: 12 }, button: { marginTop: 20, backgroundColor: C.invest, borderRadius: 14, padding: 17 }, buttonText: { color: C.white, textAlign: 'center', fontWeight: '800', fontSize: 16 }, link: { color: C.invest, fontWeight: '700', textAlign: 'center', padding: 14 } });
