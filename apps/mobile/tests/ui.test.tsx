// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { Button, Field, State, Txt } from '../src/ui';
import { usePreferences } from '../src/store';
const mocks = vi.hoisted(() => ({ scheme: 'light' }));
// DOM host adapters exercise native component contracts and handlers.
// Android rendering remains covered by device testing.
vi.mock('react-native', async () => {
  const React = await import('react');
  const block = ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children);
  return {
    Platform: { OS: 'android' },
    ActivityIndicator: () => React.createElement('span', null, 'Loading'),
    View: block,
    ScrollView: block,
    RefreshControl: block,
    KeyboardAvoidingView: block,
    Pressable: ({
      children,
      onPress,
      disabled,
      accessibilityRole,
      accessibilityState,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled: boolean;
      accessibilityRole: string;
      accessibilityState: { disabled: boolean };
    }) =>
      React.createElement(
        'button',
        {
          onClick: onPress,
          disabled,
          role: accessibilityRole,
          'aria-disabled': accessibilityState?.disabled,
        },
        children,
      ),
    Text: ({ children, style }: { children: React.ReactNode; style: React.CSSProperties[] }) =>
      React.createElement('span', { style: Object.assign({}, ...style) }, children),
    TextInput: ({ accessibilityLabel }: { accessibilityLabel: string }) =>
      React.createElement('input', { 'aria-label': accessibilityLabel }),
    StyleSheet: { create: (v: unknown) => v },
    useColorScheme: () => mocks.scheme,
  };
});
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'div' }));
vi.mock('@expo/vector-icons/Ionicons', () => ({ default: 'span' }));
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  mocks.scheme = 'light';
  usePreferences.setState({ appearance: 'system' });
  container = document.createElement('div');
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
});
describe('native design system contracts', () => {
  it('exposes accessible disabled actions', async () => {
    const press = vi.fn();
    await act(async () => root.render(<Button title="Save" disabled onPress={press} />));
    const button = container.querySelector('button')!;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('role')).toBe('button');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    button.click();
    expect(press).not.toHaveBeenCalled();
  });
  it('keeps errors adjacent to labeled fields', async () => {
    await act(async () => root.render(<Field label="Group URL" error="Invalid URL" />));
    expect(container.querySelector('input')?.getAttribute('aria-label')).toBe('Group URL');
    expect(container.textContent).toContain('Invalid URL');
  });
  it('provides a working recovery action in error state', async () => {
    const retry = vi.fn();
    await act(async () => root.render(<State error={new Error('Offline')} retry={retry} />));
    await act(async () => container.querySelector('button')!.click());
    expect(retry).toHaveBeenCalledOnce();
  });
  it('renders readable text for light and dark appearance', async () => {
    await act(async () => root.render(<Txt>Hello</Txt>));
    expect(container.querySelector('span')?.style.color).toBe('rgb(20, 42, 49)');
    await act(async () => usePreferences.setState({ appearance: 'dark' }));
    expect(container.querySelector('span')?.style.color).toBe('rgb(239, 246, 245)');
  });
});
