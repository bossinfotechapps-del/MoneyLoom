import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useAds } from '../ads/AdsContext';
import { AD_RULES, AD_UNITS } from '../ads/adConfig';
import { C } from '../theme';

export default function AdBanner() {
  const { ready } = useAds();
  const [failed, setFailed] = useState(false);

  // After a failed load (no fill / offline), try again in a minute
  useEffect(() => {
    if (!failed) return undefined;
    const t = setTimeout(() => setFailed(false), 60 * 1000);
    return () => clearTimeout(t);
  }, [failed]);

  if (!AD_RULES.bannerEnabled || !ready || failed) return null;

  return (
    <View style={{ alignItems: 'center', backgroundColor: C.paper, borderTopWidth: 1, borderTopColor: C.line }}>
      <BannerAd
        unitId={AD_UNITS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}
