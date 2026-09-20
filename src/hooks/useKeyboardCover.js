import { useEffect, useState } from 'react';
import { Dimensions, Keyboard } from 'react-native';

/**
 * How much of the screen the keyboard actually covers.
 * Returns 0 when the window resized by itself (older Android), so nothing is padded twice.
 */
export default function useKeyboardCover() {
  const [covered, setCovered] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const screenY = e.endCoordinates?.screenY;
      if (typeof screenY !== 'number') return;
      setCovered(Math.max(0, Math.round(Dimensions.get('window').height - screenY)));
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setCovered(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return covered;
}
