import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';
import { usePremium } from '../premium/PremiumContext';

const AdsContext = createContext({ ready: false });

// Gathers ad consent (EEA/UK) and starts the ads SDK. Only the banner uses it.
export function AdsProvider({ children }) {
  const { ready: premiumReady, isPremium } = usePremium();
  const [sdkReady, setSdkReady] = useState(false);
  const ready = sdkReady && !isPremium;

  useEffect(() => {
    // Wait for the saved premium status; paying users never load the ads SDK
    if (!premiumReady || isPremium) return undefined;
    let cancelled = false;

    (async () => {
      // Consent form appears only where required (EEA/UK); elsewhere this returns quickly
      try {
        await AdsConsent.gatherConsent();
      } catch (e) {
        // Offline or form error: fall through and check what is allowed
      }
      let canRequestAds = false;
      try {
        const info = await AdsConsent.getConsentInfo();
        canRequestAds = !!info?.canRequestAds;
      } catch (e) {
        canRequestAds = false;
      }
      if (!canRequestAds || cancelled) return;

      try {
        await mobileAds().initialize();
      } catch (e) {
        return;
      }
      if (!cancelled) setSdkReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [premiumReady, isPremium]);

  const value = useMemo(() => ({ ready }), [ready]);
  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

export const useAds = () => useContext(AdsContext);
