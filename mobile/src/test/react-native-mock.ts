import React from 'react';

export function flattenStyle(style: any): Record<string, any> | undefined {
  if (!style) return undefined;
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.flat(Infinity).map((s) => (typeof s === 'object' && s !== null ? s : {})));
  }
  if (typeof style === 'object') {
    return style;
  }
  return undefined;
}

export const Platform = {
  OS: 'android',
  select: (objs: any) => objs.android ?? objs.default ?? objs.ios,
};

export const StyleSheet = {
  create: (styles: any) => styles,
  flatten: flattenStyle,
};

export const View = ({ children, testID, style, ...props }: any) => {
  const resolvedStyle = flattenStyle(style);
  return React.createElement('div', { 'data-testid': testID, style: resolvedStyle, ...props }, children);
};

export const Text = ({ children, testID, style, ...props }: any) => {
  const resolvedStyle = flattenStyle(style);
  return React.createElement('span', { 'data-testid': testID, style: resolvedStyle, ...props }, children);
};

export const Pressable = ({ children, onPress, disabled, testID, style, ...props }: any) => {
  const resolved = typeof style === 'function' ? style({ pressed: false }) : style;
  const resolvedStyle = flattenStyle(resolved);
  const content = typeof children === 'function' ? children({ pressed: false }) : children;
  return React.createElement(
    'button',
    {
      type: 'button',
      'data-testid': testID,
      disabled,
      onClick: disabled ? undefined : onPress,
      style: resolvedStyle,
      ...props,
    },
    content
  );
};

export const TouchableOpacity = ({ children, onPress, disabled, testID, style, ...props }: any) => {
  const resolvedStyle = flattenStyle(style);
  return React.createElement(
    'button',
    {
      type: 'button',
      'data-testid': testID,
      disabled,
      onClick: disabled ? undefined : onPress,
      style: resolvedStyle,
      ...props,
    },
    children
  );
};

export const TextInput = ({ value, onChangeText, placeholder, style, testID, ...props }: any) => {
  const resolvedStyle = flattenStyle(style);
  return React.createElement('input', {
    'data-testid': testID,
    value,
    placeholder,
    style: resolvedStyle,
    onChange: (e: any) => onChangeText?.(e.target.value),
    ...props,
  });
};

export const ScrollView = ({ children, style, ...props }: any) => {
  const resolvedStyle = flattenStyle(style);
  return React.createElement('div', { style: resolvedStyle, ...props }, children);
};

export const FlatList = ({ data, renderItem, style, ...props }: any) => {
  const resolvedStyle = flattenStyle(style);
  return React.createElement(
    'div',
    { style: resolvedStyle, ...props },
    data?.map((item: any, index: number) => renderItem({ item, index }))
  );
};

export const Dimensions = {
  get: () => ({ width: 390, height: 844 }),
};

export const Switch = ({ value, onValueChange }: any) => {
  return React.createElement('input', {
    type: 'checkbox',
    checked: value,
    onChange: (e: any) => onValueChange?.(e.target.checked),
  });
};

export const Alert = {
  alert: () => {},
};

export const KeyboardAvoidingView = ({ children, style }: any) => {
  const resolvedStyle = flattenStyle(style);
  return React.createElement('div', { style: resolvedStyle }, children);
};

export default {
  Platform,
  StyleSheet,
  View,
  Text,
  Pressable,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Dimensions,
  Switch,
  Alert,
  KeyboardAvoidingView,
};
