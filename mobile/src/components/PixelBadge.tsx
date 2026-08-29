import React, { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { pixelColors, pixelTypography } from '../theme/colors';

export type PixelBadgeVariant = 'brass' | 'moon' | 'sage' | 'rust' | 'neutral';
export type PixelBadgeSize = 'sm' | 'md';

export interface PixelBadgeProps {
  children?: ReactNode;
  label?: string;
  variant?: PixelBadgeVariant;
  size?: PixelBadgeSize;
  icon?: ReactNode;
  showDot?: boolean;
  jewelCut?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export const PixelBadge: React.FC<PixelBadgeProps> = ({
  children,
  label,
  variant = 'brass',
  size = 'sm',
  icon,
  showDot = true,
  jewelCut = true,
  style,
  textStyle,
  testID,
}) => {
  const getVariantStyles = (): { bg: string; border: string; text: string; dot: string } => {
    switch (variant) {
      case 'moon':
        return {
          bg: 'rgba(108, 152, 194, 0.12)',
          border: 'rgba(108, 152, 194, 0.5)',
          text: pixelColors.pxMoon,
          dot: pixelColors.pxMoon,
        };
      case 'sage':
        return {
          bg: 'rgba(120, 176, 132, 0.12)',
          border: 'rgba(120, 176, 132, 0.5)',
          text: pixelColors.pxSage,
          dot: pixelColors.pxSage,
        };
      case 'rust':
        return {
          bg: 'rgba(200, 88, 72, 0.12)',
          border: 'rgba(200, 88, 72, 0.5)',
          text: pixelColors.pxRust,
          dot: pixelColors.pxRust,
        };
      case 'neutral':
        return {
          bg: 'rgba(144, 153, 176, 0.12)',
          border: 'rgba(144, 153, 176, 0.4)',
          text: pixelColors.pxMuted,
          dot: pixelColors.pxMuted,
        };
      case 'brass':
      default:
        return {
          bg: 'rgba(227, 176, 75, 0.12)',
          border: 'rgba(227, 176, 75, 0.5)',
          text: pixelColors.pxBrass,
          dot: pixelColors.pxBrass,
        };
    }
  };

  const v = getVariantStyles();
  const isSm = size === 'sm';
  const content = children || label;

  return (
    <View
      testID={testID}
      style={[
        styles.badgeContainer,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
        },
        isSm ? styles.sizeSm : styles.sizeMd,
        style,
      ]}
    >
      {/* Jewel-cut corner */}
      {jewelCut && (
        <View
          style={[
            styles.jewelPip,
            { backgroundColor: v.dot },
          ]}
        />
      )}

      {/* Icon or Status Dot */}
      {icon ? (
        <View style={styles.iconContainer}>{icon}</View>
      ) : showDot ? (
        <View
          style={[
            styles.statusDot,
            { backgroundColor: v.dot },
          ]}
        />
      ) : null}

      {/* Text Label */}
      {typeof content === 'string' ? (
        <Text
          style={[
            styles.badgeText,
            { color: v.text },
            isSm ? styles.textSm : styles.textMd,
            textStyle,
          ]}
        >
          {content}
        </Text>
      ) : (
        content
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    alignSelf: 'flex-start',
    position: 'relative',
    marginRight: 6,
    marginVertical: 2,
  },
  jewelPip: {
    position: 'absolute',
    top: -1,
    left: -1,
    width: 3,
    height: 3,
  },
  statusDot: {
    width: 5,
    height: 5,
    marginRight: 5,
  },
  iconContainer: {
    marginRight: 4,
  },
  badgeText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sizeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sizeMd: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  textSm: {
    fontSize: 10,
  },
  textMd: {
    fontSize: 12,
  },
});
