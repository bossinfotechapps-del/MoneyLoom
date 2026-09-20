/* eslint-env jest */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-google-mobile-ads', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => ({ initialize: jest.fn(() => Promise.resolve([])) }),
    AdsConsent: { gatherConsent: jest.fn(() => Promise.resolve({})), getConsentInfo: jest.fn(() => Promise.resolve({ canRequestAds: true })) },
    InterstitialAd: { createForAdRequest: () => ({ addAdEventsListener: () => () => {}, load: jest.fn(), show: jest.fn(() => Promise.resolve()) }) },
    AdEventType: { LOADED: 'loaded', CLOSED: 'closed', ERROR: 'error' },
    BannerAd: () => React.createElement('BannerAd'),
    BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
    TestIds: { ADAPTIVE_BANNER: 'test-banner', INTERSTITIAL: 'test-inter' },
  };
});
jest.mock('react-native-blob-util', () => ({
  fs: { dirs: { CacheDir: '/cache', LegacyDownloadDir: '/download' }, writeFile: jest.fn(), readFile: jest.fn(), cp: jest.fn(), unlink: jest.fn(() => Promise.resolve()) },
  MediaCollection: { copyToMediaStore: jest.fn(() => Promise.resolve('content://downloads/1')) },
}));
jest.mock('react-native-share', () => ({ open: jest.fn(() => Promise.resolve()) }));
jest.mock('@react-native-documents/picker', () => ({ pick: jest.fn(), keepLocalCopy: jest.fn(), types: { csv: ['text/csv'], json: 'application/json', plainText: 'text/plain', allFiles: '*/*' }, errorCodes: {}, isErrorWithCode: () => false }));
jest.mock('@react-native-community/datetimepicker', () => ({ DateTimePickerAndroid: { open: jest.fn() } }));
jest.mock('react-native-iap', () => ({
  initConnection: jest.fn(() => Promise.resolve(true)),
  endConnection: jest.fn(() => Promise.resolve()),
  fetchProducts: jest.fn(() => Promise.resolve([{ id: 'moneyloom_remove_ads', displayPrice: '₹149.00' }])),
  getAvailablePurchases: jest.fn(() => Promise.resolve([])),
  finishTransaction: jest.fn(() => Promise.resolve()),
  requestPurchase: jest.fn(() => Promise.resolve(null)),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    getNotificationSettings: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    createChannel: jest.fn(() => Promise.resolve('daily-reminder')),
    createTriggerNotification: jest.fn(() => Promise.resolve('id')),
    cancelTriggerNotification: jest.fn(() => Promise.resolve()),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    onForegroundEvent: jest.fn(() => () => {}),
    onBackgroundEvent: jest.fn(),
  },
  AndroidImportance: { DEFAULT: 3 },
  AuthorizationStatus: { DENIED: 0, AUTHORIZED: 1 },
  AlarmType: { SET_AND_ALLOW_WHILE_IDLE: 1 },
  RepeatFrequency: { DAILY: 1 },
  TriggerType: { TIMESTAMP: 0 },
  EventType: { PRESS: 1 },
}));
// Charts animate with timers that outlive tests; render lightweight stand-ins instead
jest.mock('react-native-gifted-charts', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Stub = (name) => (props) => React.createElement(View, { testID: name }, props.centerLabelComponent ? props.centerLabelComponent() : null);
  return { BarChart: Stub('BarChart'), LineChart: Stub('LineChart'), PieChart: Stub('PieChart') };
});
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ type: 'success', data: { idToken: 'token', user: { name: 'Test', email: 't@example.com' } } })),
    getTokens: jest.fn(() => Promise.resolve({ idToken: 'token', accessToken: 'access-token' })),
    signOut: jest.fn(() => Promise.resolve(null)),
    revokeAccess: jest.fn(() => Promise.resolve(null)),
    getCurrentUser: jest.fn(() => null),
  },
  isSuccessResponse: (r) => r?.type === 'success',
  isErrorWithCode: () => false,
  statusCodes: { SIGN_IN_CANCELLED: '12501', IN_PROGRESS: 'IN_PROGRESS', PLAY_SERVICES_NOT_AVAILABLE: '12500' },
}));
// No google-services.json in tests, so Firebase is "not configured" — the app must still work
jest.mock('@react-native-firebase/app', () => ({
  getApp: () => {
    throw new Error('No Firebase App [DEFAULT] has been created');
  },
}));
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  onAuthStateChanged: jest.fn(() => () => {}),
  signInWithCredential: jest.fn(() => Promise.resolve({})),
  signOut: jest.fn(() => Promise.resolve()),
  deleteUser: jest.fn(() => Promise.resolve()),
  GoogleAuthProvider: { credential: jest.fn(() => ({})) },
}));
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  collection: jest.fn(() => ({})),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => false })),
  getDocs: jest.fn(() => Promise.resolve({ forEach: () => {} })),
  setDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
}));
