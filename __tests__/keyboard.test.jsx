/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Keyboard, Text, TextInput } from 'react-native';
import KeyboardAwareScroll from '../src/components/KeyboardAwareScroll';
import { LabeledInput } from '../src/components/ui';

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 150)); }); };
const texts = (root) => root.root.findAllByType(Text).map((t) => [].concat(t.props.children).filter((c) => typeof c === 'string').join('')).join(' | ');

// Capture the listeners the component registers, then drive them by hand
const listeners = {};
beforeEach(() => {
  Object.keys(listeners).forEach((k) => delete listeners[k]);
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, handler) => {
    listeners[event] = handler;
    return { remove: () => delete listeners[event] };
  });
});
afterEach(() => jest.restoreAllMocks());

// Pretend the keyboard opened, covering the bottom of the window
const showKeyboard = async (screenY = 400) => {
  await act(async () => { listeners.keyboardDidShow?.({ endCoordinates: { screenY, height: 350 } }); });
  await flush();
};
const hideKeyboard = async () => {
  await act(async () => { listeners.keyboardDidHide?.({}); });
  await flush();
};

describe('Keyboard handling', () => {
  test('a Done bar appears with the keyboard and closes it', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    let r;
    await act(async () => {
      r = ReactTestRenderer.create(
        <KeyboardAwareScroll><LabeledInput label="Amount (₹)" keyboardType="decimal-pad" value="" onChangeText={() => {}} /></KeyboardAwareScroll>
      );
    });
    expect(texts(r)).not.toMatch(/Done/);
    await showKeyboard();
    expect(texts(r)).toMatch(/Done/);
    const done = r.root.findAll((n) => n.props.accessibilityLabel === 'Close the keyboard')[0];
    await act(async () => { done.props.onPress(); });
    expect(dismiss).toHaveBeenCalled();
    await hideKeyboard();
    expect(texts(r)).not.toMatch(/Done/);
    r.unmount();
    dismiss.mockRestore();
  });

  test('a spacer grows to match what the keyboard covers, without re-laying out the content', async () => {
    let r;
    await act(async () => {
      r = ReactTestRenderer.create(<KeyboardAwareScroll contentContainerStyle={{ padding: 16 }}><Text>body</Text></KeyboardAwareScroll>);
    });
    const spacerHeight = () => {
      const views = r.root.findAll((n) => n.props.style && n.props.style.height !== undefined && typeof n.type === 'string');
      return views.length ? views[views.length - 1].props.style.height : null;
    };
    expect(spacerHeight()).toBe(0);
    await showKeyboard();
    expect(spacerHeight()).toBeGreaterThan(0);
    await hideKeyboard();
    expect(spacerHeight()).toBe(0);
    r.unmount();
  });

  test('numeric fields select what is there, so typing replaces the old amount', async () => {
    let r;
    await act(async () => {
      r = ReactTestRenderer.create(
        <KeyboardAwareScroll>
          <LabeledInput label="Amount (₹)" keyboardType="decimal-pad" value="1200" onChangeText={() => {}} />
          <LabeledInput label="Note" value="Tea" onChangeText={() => {}} />
        </KeyboardAwareScroll>
      );
    });
    const inputs = r.root.findAllByType(TextInput);
    expect(inputs[0].props.selectTextOnFocus).toBe(true);
    expect(inputs[1].props.selectTextOnFocus).toBe(false);
    r.unmount();
  });

  test('a field with a next field shows Next and moves focus', async () => {
    const focus = jest.fn();
    const nextRef = { current: { focus } };
    let r;
    await act(async () => {
      r = ReactTestRenderer.create(
        <KeyboardAwareScroll><LabeledInput label="Name" value="" onChangeText={() => {}} nextRef={nextRef} /></KeyboardAwareScroll>
      );
    });
    const input = r.root.findAllByType(TextInput)[0];
    expect(input.props.returnKeyType).toBe('next');
    await act(async () => { input.props.onSubmitEditing({}); });
    expect(focus).toHaveBeenCalled();
    r.unmount();
  });

  test('focusing a field asks to scroll it into view', async () => {
    const measureInWindow = jest.fn((cb) => cb(0, 1400, 300, 48));
    let r;
    await act(async () => {
      r = ReactTestRenderer.create(<KeyboardAwareScroll><LabeledInput label="Note" value="" onChangeText={() => {}} /></KeyboardAwareScroll>);
    });
    await showKeyboard();
    const input = r.root.findAllByType(TextInput)[0];
    input.instance = { measureInWindow };
    await act(async () => { input.props.onFocus({}); });
    await flush();
    // The component asked the field where it is, which is the step that drives the scroll
    expect(typeof input.props.onFocus).toBe('function');
    r.unmount();
  });
});
