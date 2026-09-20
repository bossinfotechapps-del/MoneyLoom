# MoneyLoom – setup, AdMob and release (Windows)

Expense + income + investment tracker for Android. React Native 0.81.6, targets Android 16 (API 36), legacy architecture, on-device storage. Earns through a Google AdMob banner and a one-time Remove ads purchase (Play Billing 8 via react-native-iap).

## Known-good versions

Two pinned versions matter, both chosen because this project uses the **legacy architecture** (`newArchEnabled=false`):

- `@react-native-firebase/*` is pinned to **25.0.0**. Version 26 hard-fails the build with "New Architecture support is required for @react-native-firebase/app". 25.0.0 still supports the legacy architecture and only prints a deprecation warning, which `RNFB_SUPPRESS_NEW_ARCHITECTURE_WARNING=1` in `android/gradle.properties` silences.
- `react-native-google-mobile-ads` is pinned to **16.0.0**. From 16.3.x the library's app module extends a codegen class that only exists in New Architecture builds, so it fails with `Cannot access 'NativeAppModuleSpec'`. 16.0.0 also uses Google Ads SDK 24.6.0, which matches this project's Kotlin 2.1.20 (25.x is built with Kotlin 2.3 and fails with "incompatible version of Kotlin").
- Kotlin stays at **2.1.20** (`android/build.gradle`).

If you later switch to the New Architecture, you can upgrade the ads library at the same time.

## 1. Run it on your phone

Needs: Node 20, Java 17, Android Studio with **Android 16 (API 36) SDK Platform** installed (SDK Manager). NDK 27.1.12297006 downloads automatically on first build.

```
cd C:\Users\bossu
(unzip MoneyLoom.zip here)
cd MoneyLoom
npm install
adb devices
npx react-native run-android
```

Debug builds show **Google test ads**. On a fresh install, tap Load sample data on the Overview screen to see all charts filled.

The first build takes longer than usual: react-native-iap uses Nitro modules, which compile C++ once.

If the build fails, copy the first `What went wrong` block from the Gradle output and share it.

Run the tests any time: `npm test`

## 2. Google sign-in and cloud backup (Firebase)

**The app builds and runs without this.** With no `google-services.json`, the welcome screen shows only "Get started", and More says cloud backup isn't set up. Everything else works. Do this when you want sign-in and cloud backup live.

1. **Create the Firebase project** at https://console.firebase.google.com with the Google account you use for Play.
2. **Add an Android app**: package name `com.bossinfotech.moneyloom`.
3. **Add both SHA-1 fingerprints** (Project settings > Your apps > Add fingerprint). Google sign-in fails without them:
   ```
   cd C:\Users\bossu\MoneyLoom\android
   gradlew signingReport
   ```
   Add the SHA-1 from the **debug** variant, and from **release** once you've made the upload key. After the app is live, also add the SHA-1 that Play Console shows under **Setup > App signing** (Google re-signs your app, so sign-in breaks in production without it).
4. **Download `google-services.json`** and put it in `android\app\`. Never commit it to a public repo.
5. **Authentication > Sign-in method > Google: enable.** Set a support email.
6. **Copy the Web client ID** (Authentication > Sign-in method > Google > Web SDK configuration) into `src/auth/authConfig.js` > `WEB_CLIENT_ID`. It must be the **Web** client ID, not the Android one. This is the single most common mistake: the wrong ID gives a `DEVELOPER_ERROR` at sign-in.
7. **Firestore Database > Create database** in a region close to you (`asia-south1` for India), in **production mode**.
8. **Paste the rules** from `firestore.rules` into Firestore > Rules and publish. They let each person read and write only their own document.
9. Rebuild: `cd android`, `gradlew clean`, `cd ..`, `npm run android`.

Cloud backup stores one document per user at `users/{uid}`, holding the whole dataset as JSON. Firestore caps a document just under 1 MB, and the app refuses a backup above 900 KB with a message pointing to file backup. On the free Spark plan this costs nothing at small scale.

Also fill in the three URLs in `src/auth/authConfig.js` once you publish `docs/privacy-policy.html`, `docs/terms.html` and `docs/delete-account.html` on GitHub Pages.

## 3. AdMob (to earn)

1. Sign in at https://admob.google.com with the Google account you'll receive payments on. Complete payment and tax details (PAN required in India).
2. Apps > Add app > Android > "No, not listed yet" > name `MoneyLoom`.
3. Copy the **App ID** (`ca-app-pub-...~...`) into `app.json` > `android_app_id`. The current value is Google's sample ID and only works for test ads.
4. Ad units > create one **Banner** ad unit (it's adaptive automatically).
5. Paste the unit ID into `src/ads/adConfig.js` > `PRODUCTION_UNITS`.
6. Privacy & messaging > create a **GDPR** consent message for the app (needed to serve ads to EEA/UK users; the app already shows it where required).
7. After the app is live on Play: in AdMob, link the app to its store listing, and publish `app-ads.txt` at the root of the developer website listed in Play Console (e.g. `https://yourname.github.io/app-ads.txt`).

The app shows one banner above the tab bar and no full-screen ads. Never tap your own live ads.

After changing `app.json`, rebuild: `cd android` then `gradlew clean`, `cd ..`, `npx react-native run-android`.

## 4. Remove ads purchase (Play Billing)

1. Play Console > **Settings > Payments profile**: set up the merchant account (needed to sell anything).
2. Build and upload an AAB to **Internal testing** first. Play only lets you create products after an AAB with the billing permission is uploaded (the library adds it automatically).
3. **Monetize with Play > Products > One-time products > Create**:
   - Product ID: `moneyloom_remove_ads` (must match `src/premium/premiumConfig.js` exactly; IDs can never be reused)
   - Name: Remove ads
   - Description: Removes all ads from MoneyLoom permanently.
   - Price: set in INR (₹99–₹199 is typical for a one-time remove-ads unlock), then **Activate**.
4. **Settings > License testing**: add your Gmail and your testers. Their purchases are free test purchases.
5. Install the app **from the Play internal testing link** (not `run-android`) and test: buy, uninstall and reinstall, then More > Restore.

Billing is off in debug builds, so `npm run android` never contacts the Play Store and never logs billing errors. More shows "Purchases are off in development builds." To debug the billing code itself, set `FORCE_BILLING_IN_DEV` to true in `src/premium/premiumConfig.js`.

How it works: the purchase is acknowledged in the app (Google refunds unacknowledged purchases after 3 days), the unlock is saved on the phone, and it's re-checked with Google Play on each launch, so refunds remove it and reinstalls restore it. There's no server-side receipt check; for a low-priced unlock that's a reasonable trade-off, but a determined person could bypass it on a rooted phone.

## 5. Daily reminder

More > Daily reminder asks for notification permission (Android 13+) and schedules a daily notification at the chosen time (default 9:00 PM). It uses an inexact alarm, so it needs no special alarm permission and may arrive a few minutes late. Tapping it opens Add expense.

Quick test: set the time 2 minutes ahead, lock the phone, wait.

## 6. Release key and AAB

Create the upload key once and **back up the file and passwords** (losing them blocks updates):

```
cd C:\Users\bossu\MoneyLoom\android\app
keytool -genkeypair -v -storetype PKCS12 -keystore moneyloom-upload.keystore -alias moneyloom -keyalg RSA -keysize 2048 -validity 10000
```

Add these 4 lines to `C:\Users\bossu\.gradle\gradle.properties` (your user folder, not the project, so passwords never go into Git):

```
MONEYLOOM_UPLOAD_STORE_FILE=moneyloom-upload.keystore
MONEYLOOM_UPLOAD_STORE_PASSWORD=your_store_password
MONEYLOOM_UPLOAD_KEY_ALIAS=moneyloom
MONEYLOOM_UPLOAD_KEY_PASSWORD=your_key_password
```

Build the bundle:

```
cd C:\Users\bossu\MoneyLoom\android
gradlew bundleRelease
```

Output: `android\app\build\outputs\bundle\release\app-release.aab`

For every new upload, raise `versionCode` (1, 2, 3…) and `versionName` in `android\app\build.gradle`, and `APP_VERSION` in `App.jsx`.

## 7. Before the first upload

- [ ] `google-services.json` in `android\app\`, Web client ID in `src/auth/authConfig.js`, and all three SHA-1 fingerprints added (debug, release, Play app signing)
- [ ] Firestore rules published from `firestore.rules`
- [ ] Real AdMob App ID in `app.json` and banner unit ID in `src/ads/adConfig.js`
- [ ] `docs/privacy-policy.html`, `docs/terms.html` and `docs/delete-account.html` hosted on GitHub Pages, with the URLs pasted into `src/auth/authConfig.js`
- [ ] Remove ads product created and tested with a license tester
- [ ] Launcher icon checked on your phone (an adaptive icon is included; replace in `android\app\src\main\res` if you design your own)
- [ ] App name checked for availability on Play Store and trademarks; rename in `app.json` and `android\app\src\main\res\values\strings.xml` if needed
- [ ] Release AAB tested on a real phone (install via internal testing track)
- [ ] See `PLAY-STORE.md` for listing text and Play Console forms

## Project map

```
App.jsx                     Root: tabs, Add button, entry screen, banner
app.json                    App name + AdMob App ID
src/theme.js                Colours and text styles
src/data/DataContext.jsx    Load/save (AsyncStorage), actions, derived totals
src/data/compute.js         Monthly totals, holdings, monthly repeats, budgets, CSV
src/data/debts.js           Loan, gold, card, pay later, hand loan, lent and chit maths; net worth
src/data/sample.js          Sample data generator
src/data/constants.js       Categories, payment modes, investment types
src/ads/                    AdMob banner config and consent (off for Remove ads buyers)
src/auth/                   Google sign-in, guest mode, cloud backup to Firestore
firestore.rules             Firestore security rules to paste into the Firebase console
src/premium/                Remove ads purchase, restore, product ID
src/reminders/              Daily reminder notification and settings
src/components/             Tab bar, banner, entry form, value dialog, UI parts
src/screens/                Welcome, Overview, Expenses, Wealth (investments, debts, lent and chits), More
src/utils/                  Dates, ₹ formatting, file share/pick
docs/privacy-policy.html    Privacy policy to host
docs/terms.html             Terms of use to host
docs/delete-account.html    Account deletion page to host (required by Play)
docs/store-icon-512.png     Play Store icon
docs/feature-graphic-1024x500.png  Play Store feature graphic
__tests__/                  Render and form tests (npm test)
```

## Switching to the New Architecture later

`android\gradle.properties` > `newArchEnabled=true`, then `gradlew clean` and rebuild. React Native 0.82+ requires it, so plan this before upgrading.
