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

export type PixelCardVariant = 'default' | 'book' | 'parchment' | 'shelf';

export interface PixelCardProps {
  children?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  variant?: PixelCardVariant;
  corners?: 'trim' | 'square';
  dithered?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  headerStyle?: TextStyle;
  testID?: string;
}

export const PixelCard: React.FC<PixelCardProps> = ({
  children,
  header,
  footer,
  variant = 'default',
  corners = 'trim',
  style,
  contentStyle,
  headerStyle,
  testID,
}) => {
  const getVariantStyles = (): { container: ViewStyle; headerColor: string; textColor: string } => {
    switch (variant) {
      case 'book':
        return {
          container: {
            backgroundColor: '#0D1322',
            borderLeftWidth: 4,
            borderLeftColor: pixelColors.pxBrass,
            borderTopWidth: 1,
            borderTopColor: pixelColors.pxBorder,
            borderRightWidth: 1,
            borderRightColor: pixelColors.pxBorder,
            borderBottomWidth: 1,
            borderBottomColor: pixelColors.pxBorder,
          },
          headerColor: pixelColors.pxBrass,
          textColor: pixelColors.pxInk,
        };
      case 'parchment':
        return {
          container: {
            backgroundColor: pixelColors.pxParchment,
            borderWidth: 2,
            borderColor: pixelColors.pxBrassDeep,
          },
          headerColor: '#5C3E1B',
          textColor: '#1B2334',
        };
      case 'shelf':
        return {
          container: {
            backgroundColor: pixelColors.pxSurface,
            borderWidth: 1,
            borderColor: pixelColors.pxBorder,
            borderTopWidth: 3,
            borderTopColor: pixelColors.pxBrass,
          },
          headerColor: pixelColors.pxBrassLight,
          textColor: pixelColors.pxInk,
        };
      case 'default':
      default:
        return {
          container: {
            backgroundColor: pixelColors.pxSurface,
            borderWidth: 1,
            borderColor: 'rgba(227, 176, 75, 0.25)',
          },
          headerColor: pixelColors.pxBrass,
          textColor: pixelColors.pxInk,
        };
    }
  };

  const { container: variantContainerStyle, headerColor } = getVariantStyles();

  return (
    <View
      testID={testID}
      style={[
        styles.cardContainer,
        variantContainerStyle,
        style,
      ]}
    >
      {/* Book-trim corner highlights */}
      {corners === 'trim' && variant !== 'parchment' && (
        <>
          <View style={[styles.cornerBox, styles.cornerTL]} />
          <View style={[styles.cornerBox, styles.cornerTR]} />
          <View style={[styles.cornerBox, styles.cornerBL]} />
          <View style={[styles.cornerBox, styles.cornerBR]} />
        </>
      )}

      {/* Header */}
      {header && (
        <View style={styles.headerContainer}>
          {typeof header === 'string' ? (
            <Text style={[styles.headerText, { color: headerColor }, headerStyle]}>
              {header}
            </Text>
          ) : (
            header
          )}
        </View>
      )}

      {/* Card Content */}
      <View style={[styles.bodyContainer, contentStyle]}>
        {children}
      </View>

      {/* Footer */}
      {footer && (
        <View style={styles.footerContainer}>
          {typeof footer === 'string' ? (
            <Text style={styles.footerText}>{footer}</Text>
          ) : (
            footer
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    padding: 14,
    position: 'relative',
    marginVertical: 6,
    elevation: 2,
    shadowColor: pixelColors.pxVoid,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 0,
  },
  cornerBox: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: 'rgba(227, 176, 75, 0.45)',
  },
  cornerTL: {
    top: 0,
    left: 0,
  },
  cornerTR: {
    top: 0,
    right: 0,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(227, 176, 75, 0.25)',
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(227, 176, 75, 0.25)',
  },
  headerContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 240, 230, 0.1)',
    paddingBottom: 8,
    marginBottom: 10,
  },
  headerText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  bodyContainer: {
    flexShrink: 1,
  },
  footerContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 240, 230, 0.1)',
    paddingTop: 8,
    marginTop: 10,
  },
  footerText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.xs,
    color: pixelColors.pxMuted,
  },
});
