/**
 * @format
 */

import { AppRegistry } from 'react-native';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// Required by notifee so reminder taps while the app is closed are handled quietly
notifee.onBackgroundEvent(async () => {});

AppRegistry.registerComponent(appName, () => App);
