import React, { ReactNode } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  ViewStyle,
  TextStyle,
  Platform,
  GestureResponderEvent,
} from 'react-native';
import { pixelColors, pixelTypography } from '../theme/colors';

export type PixelButtonVariant = 'primary' | 'secondary' | 'brass' | 'ghost' | 'danger';
export type PixelButtonSize = 'sm' | 'md' | 'lg';

export interface PixelButtonProps {
  children?: ReactNode;
  title?: string;
  variant?: PixelButtonVariant;
  size?: PixelButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  steppedDepress?: boolean;
  haptic?: boolean;
  testID?: string;
}

export const PixelButton: React.FC<PixelButtonProps> = ({
  children,
  title,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  onPress,
  disabled = false,
  style,
  textStyle,
  steppedDepress = true,
  testID,
}) => {
  const content = children || (title ? <Text style={[styles.textBase, sizeTextStyles[size], variantTextStyles[variant], textStyle]}>{title}</Text> : null);

  const getVariantContainerStyle = (pressed: boolean): ViewStyle => {
    switch (variant) {
      case 'brass':
        return {
          backgroundColor: pressed ? pixelColors.pxBrassDeep : pixelColors.pxBrass,
          borderColor: pixelColors.pxBrassDeep,
          borderTopColor: pixelColors.pxBrassLight,
          borderLeftColor: pixelColors.pxBrassLight,
        };
      case 'secondary':
        return {
          backgroundColor: pressed ? pixelColors.pxSurface : pixelColors.pxRaised,
          borderColor: pixelColors.pxBorder,
          borderTopColor: pixelColors.pxMuted,
        };
      case 'ghost':
        return {
          backgroundColor: pressed ? 'rgba(227, 176, 75, 0.12)' : 'transparent',
          borderColor: pressed ? pixelColors.pxBorder : 'transparent',
        };
      case 'danger':
        return {
          backgroundColor: pressed ? '#96372B' : pixelColors.pxRust,
          borderColor: '#73261C',
          borderTopColor: '#DE7A6D',
        };
      case 'primary':
      default:
        return {
          backgroundColor: pressed ? pixelColors.pxVoid : pixelColors.pxSurface,
          borderColor: pixelColors.pxVoid,
          borderTopColor: pixelColors.pxBrassDeep,
          borderLeftColor: pixelColors.pxBrassDeep,
        };
    }
  };

  const getShadowOffset = (pressed: boolean): ViewStyle => {
    if (!steppedDepress || pressed || variant === 'ghost') {
      return {
        transform: [{ translateY: pressed && steppedDepress ? 1 : 0 }, { translateX: pressed && steppedDepress ? 1 : 0 }],
        elevation: pressed ? 1 : 0,
      };
    }

    return {
      elevation: 3,
      shadowColor: pixelColors.pxVoid,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.8,
      shadowRadius: 0,
    };
  };

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{
        color: variant === 'brass' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(227, 176, 75, 0.2)',
        borderless: false,
      }}
      style={({ pressed }: { pressed: boolean }) => [
        styles.base,
        sizeContainerStyles[size],
        getVariantContainerStyle(pressed),
        getShadowOffset(pressed),
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        {typeof content === 'string' ? (
          <Text style={[styles.textBase, sizeTextStyles[size], variantTextStyles[variant], textStyle]}>
            {content}
          </Text>
        ) : (
          content
        )}
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBase: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: 6,
  },
  iconRight: {
    marginLeft: 6,
  },
  disabled: {
    opacity: 0.45,
  },
});

const sizeContainerStyles = StyleSheet.create({
  sm: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 28,
  },
  md: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 38,
  },
  lg: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 48,
  },
});

const sizeTextStyles = StyleSheet.create({
  sm: {
    fontSize: pixelTypography.sizes.xs,
  },
  md: {
    fontSize: pixelTypography.sizes.sm,
  },
  lg: {
    fontSize: pixelTypography.sizes.md,
  },
});

const variantTextStyles = StyleSheet.create({
  primary: {
    color: pixelColors.pxInk,
  },
  secondary: {
    color: pixelColors.pxInk,
  },
  brass: {
    color: pixelColors.pxVoid,
  },
  ghost: {
    color: pixelColors.pxMuted,
  },
  danger: {
    color: pixelColors.pxInk,
  },
});
