import React, { useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { CloudUpload, Landmark, ShieldCheck, WalletMinimal } from 'lucide-react-native';
import { C, T } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../auth/authConfig';
import { GhostButton, PrimaryButton } from '../components/ui';

// The MoneyLoom mark, drawn so it matches the launcher icon exactly
function Logo({ size = 76 }) {
  return (
    <View style={[s.logoBox, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 54 54">
        <Path fill={C.white} d="M8,30 a3,3 0 0 1 3,-3 h5 a3,3 0 0 1 3,3 v15 h-11 z" />
        <Path fill={C.white} d="M21.5,19 a3,3 0 0 1 3,-3 h5 a3,3 0 0 1 3,3 v26 h-11 z" />
        <Path fill={C.white} d="M35,8 a3,3 0 0 1 3,-3 h5 a3,3 0 0 1 3,3 v37 h-11 z" />
        <Path fill="#9ED8CF" d="M6,48 h42 v3 h-42 z" />
      </Svg>
    </View>
  );
}

function Point({ Icon, title, body }) {
  return (
    <View style={s.point}>
      <View style={s.pointIcon}>
        <Icon size={19} color={C.invest} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[T.body, { fontWeight: '700' }]}>{title}</Text>
        <Text style={[T.small, { marginTop: 2, lineHeight: 18 }]}>{body}</Text>
      </View>
    </View>
  );
}

/** First screen on a new install. Signing in is optional: everything works without an account. */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { cloudReady, busy, signInWithGoogle, continueAsGuest } = useAuth();
  const [error, setError] = useState('');

  const onGoogle = async () => {
    setError('');
    const result = await signInWithGoogle();
    if (result?.error) setError(result.error);
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 24 + insets.bottom, flexGrow: 1 }}>
        <View style={{ alignItems: 'center', paddingTop: 24 }}>
          <Logo />
          <Text style={s.title}>MoneyLoom</Text>
          <Text style={s.tagline}>Expenses, income, investments and debts in one clear monthly picture.</Text>
        </View>

        <View style={{ gap: 14, marginTop: 32 }}>
          <Point Icon={WalletMinimal} title="Log in seconds" body="Amount, category, done. Rent, EMIs and SIPs repeat themselves each month." />
          <Point Icon={Landmark} title="See the whole picture" body="What you own minus what you owe, with your debt-free date." />
          <Point
            Icon={ShieldCheck}
            title="Private by design"
            body="Your entries stay on this phone. No bank login, ever."
          />
          {cloudReady && (
            <Point Icon={CloudUpload} title="Optional cloud backup" body="Sign in with Google and get your data back if you change phones." />
          )}
        </View>

        <View style={{ flex: 1, minHeight: 24 }} />

        {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : null}

        <View style={{ gap: 10, marginTop: 16 }}>
          {cloudReady && (
            <PrimaryButton
              label={busy ? 'Signing in…' : 'Continue with Google'}
              onPress={onGoogle}
              disabled={busy}
              icon={busy ? <ActivityIndicator size="small" color={C.white} /> : <GoogleMark />}
            />
          )}
          <GhostButton label={cloudReady ? 'Use without an account' : 'Get started'} onPress={continueAsGuest} disabled={busy} />
        </View>

        <Text style={s.legal}>
          By continuing you agree to the{' '}
          <Text style={s.link} onPress={() => Linking.openURL(TERMS_URL)}>Terms of use</Text>
          {' '}and{' '}
          <Text style={s.link} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>Privacy policy</Text>.
          {cloudReady ? ' You can switch between an account and offline use at any time.' : ''}
        </Text>
      </ScrollView>
    </View>
  );
}

// Google's four-colour G
function GoogleMark() {
  return (
    <View style={s.googleMark}>
      <Svg width={14} height={14} viewBox="0 0 48 48">
        <Path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z" />
        <Path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.700-3.9-12.5-9.1H4.2v5.7C7.8 41.1 15.3 46 24 46z" />
        <Path fill="#FBBC05" d="M11.5 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.2C2.8 17 2 20.4 2 24s.8 7 2.2 9.8l7.3-5.7z" />
        <Path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C34.9 4.2 30 2 24 2 15.3 2 7.8 6.9 4.2 14.2l7.3 5.7c1.8-5.2 6.7-9.1 12.5-9.1z" />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  logoBox: { backgroundColor: C.invest, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8, color: C.ink, marginTop: 16 },
  tagline: { fontSize: 16, color: C.inkSoft, textAlign: 'center', lineHeight: 23, marginTop: 8, maxWidth: 320 },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pointIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#E1F0ED', alignItems: 'center', justifyContent: 'center' },
  error: { color: C.loss, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  legal: { fontSize: 12, color: C.muted, textAlign: 'center', lineHeight: 18, marginTop: 16 },
  link: { color: C.invest, fontWeight: '700' },
  googleMark: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
});
