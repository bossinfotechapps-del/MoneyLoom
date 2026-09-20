module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: { '^.+\\.(js|jsx|ts|tsx|mjs)$': 'babel-jest' },
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'mjs', 'json'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-firebase|@react-native-google-signin|lucide-react-native|react-native-gifted-charts|gifted-charts-core|react-native-svg|react-native-safe-area-context|@react-native-documents|@react-native-community)/)',
  ],
};
