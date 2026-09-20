// ------------------------------------------------------------------
// STEP BEFORE RELEASE: create this product in Play Console with exactly this ID.
// Monetize with Play > Products > One-time products.
// ------------------------------------------------------------------
export const PREMIUM_SKU = 'moneyloom_remove_ads';

/**
 * Google Play billing only works in a build installed from Google Play, so it is switched off in
 * debug builds. Without this, the library logs a "Play Store service is not connected" error on
 * every launch, which React Native turns into a full-screen red box while developing.
 *
 * To test a real purchase, upload to the Play internal testing track and install from that link.
 * Set FORCE_BILLING_IN_DEV to true only if you need to debug the billing code itself.
 */
const FORCE_BILLING_IN_DEV = false;

export const BILLING_ENABLED = !__DEV__ || FORCE_BILLING_IN_DEV;
