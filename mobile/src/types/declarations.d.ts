declare module 'react-native' {
  import * as React from 'react';

  export type ViewStyle = any;
  export type TextStyle = any;
  export type ImageStyle = any;
  export type StyleProp<T> = any;

  export interface GestureResponderEvent {
    nativeEvent: any;
  }

  export interface NativeScrollEvent {
    contentOffset: { x: number; y: number };
    contentSize: { width: number; height: number };
    layoutMeasurement: { width: number; height: number };
  }

  export interface NativeSyntheticEvent<T> {
    nativeEvent: T;
  }

  export interface PressableStateCallbackType {
    pressed: boolean;
    focused?: boolean;
    hovered?: boolean;
  }

  export interface PressableProps {
    children?: React.ReactNode | ((state: PressableStateCallbackType) => React.ReactNode);
    style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
    onPress?: (event: GestureResponderEvent) => void;
    disabled?: boolean;
    android_ripple?: {
      color?: string;
      borderless?: boolean;
      radius?: number;
      foreground?: boolean;
    };
    testID?: string;
    [key: string]: any;
  }

  export const Pressable: React.FC<PressableProps>;
  export class View extends React.Component<any> {}
  export class Text extends React.Component<any> {}
  export class TextInput extends React.Component<any> {}
  export class ScrollView extends React.Component<any> {
    scrollToEnd(options?: { animated?: boolean }): void;
    scrollTo(options?: { x?: number; y?: number; animated?: boolean }): void;
  }
  export class FlatList<T = any> extends React.Component<any> {
    scrollToIndex(params: { index: number; animated?: boolean; viewOffset?: number; viewPosition?: number }): void;
    scrollToOffset(params: { offset: number; animated?: boolean }): void;
  }
  export class TouchableOpacity extends React.Component<any> {}
  export class Switch extends React.Component<any> {}
  export class KeyboardAvoidingView extends React.Component<any> {}

  export const Platform: {
    OS: 'ios' | 'android' | 'windows' | 'macos' | 'web';
    select: <T>(specifics: { [platform in 'ios' | 'android' | 'windows' | 'macos' | 'web' | 'default']?: T }) => T;
  };

  export const StyleSheet: {
    create: <T extends Record<string, any>>(styles: T) => T;
    flatten: <T>(style: StyleProp<T>) => T;
  };

  export const Dimensions: {
    get: (dim: 'window' | 'screen') => { width: number; height: number; scale: number; fontScale: number };
  };

  export const Alert: {
    alert: (title: string, message?: string, buttons?: any[], options?: any) => void;
  };
}

declare module 'react-native-safe-area-context' {
  import * as React from 'react';
  export class SafeAreaView extends React.Component<any> {}
  export class SafeAreaProvider extends React.Component<any> {}
  export const useSafeAreaInsets: () => { top: number; bottom: number; left: number; right: number };
}

declare module 'expo-status-bar' {
  import * as React from 'react';
  export interface StatusBarProps {
    style?: 'auto' | 'inverted' | 'light' | 'dark';
    backgroundColor?: string;
    translucent?: boolean;
    hidden?: boolean;
  }
  export const StatusBar: React.FC<StatusBarProps>;
}

declare module 'lucide-react-native' {
  import * as React from 'react';
  export interface IconProps {
    size?: number | string;
    color?: string;
    strokeWidth?: number;
    style?: any;
  }
  export type Icon = React.FC<IconProps>;

  export const BookOpen: Icon;
  export const Flame: Icon;
  export const Sparkles: Icon;
  export const ArrowRight: Icon;
  export const Check: Icon;
  export const Search: Icon;
  export const Plus: Icon;
  export const FileText: Icon;
  export const Clock: Icon;
  export const Award: Icon;
  export const Send: Icon;
  export const Paperclip: Icon;
  export const ChevronDown: Icon;
  export const ChevronUp: Icon;
  export const CheckCircle2: Icon;
  export const BrainCircuit: Icon;
  export const CornerDownRight: Icon;
  export const Key: Icon;
  export const Eye: Icon;
  export const EyeOff: Icon;
  export const ShieldCheck: Icon;
  export const Moon: Icon;
  export const Sun: Icon;
  export const Volume2: Icon;
  export const HardDrive: Icon;
  export const Cpu: Icon;
  export const Info: Icon;
  export const SlidersHorizontal: Icon;
}

declare module '@react-navigation/native' {
  import * as React from 'react';
  export class NavigationContainer extends React.Component<any> {}
  export const useNavigation: () => any;
  export const useRoute: () => any;
}

declare module '@react-navigation/native-stack' {
  export function createNativeStackNavigator<T extends Record<string, any>>(): {
    Navigator: any;
    Screen: any;
  };
}

declare module '@react-navigation/bottom-tabs' {
  export interface BottomTabBarProps {
    state: any;
    descriptors: any;
    navigation: any;
  }
  export function createBottomTabNavigator<T extends Record<string, any>>(): {
    Navigator: any;
    Screen: any;
  };
}
