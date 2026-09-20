import { TestIds } from 'react-native-google-mobile-ads';

// ------------------------------------------------------------------
// STEP BEFORE RELEASE: paste your real banner ad unit ID from AdMob here.
// AdMob > Apps > MoneyLoom > Ad units
// ------------------------------------------------------------------
const PRODUCTION_UNITS = {
  banner: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
};

// Test ads in debug builds. Set to true temporarily if you want to check a release build with test ads.
// Never tap your own real ads: AdMob can disable the account.
const USE_TEST_ADS = __DEV__;

export const AD_UNITS = USE_TEST_ADS ? { banner: TestIds.ADAPTIVE_BANNER } : PRODUCTION_UNITS;

// Banner only: full-screen ads were removed because they interrupt people right after saving an entry
export const AD_RULES = {
  bannerEnabled: true,
};
