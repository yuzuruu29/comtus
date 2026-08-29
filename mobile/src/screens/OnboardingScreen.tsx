import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pixelColors, pixelTypography } from '../theme/colors';
import { PixelButton } from '../components/PixelButton';
import { PixelCard } from '../components/PixelCard';
import { PixelBadge } from '../components/PixelBadge';
import { BookOpen, Flame, Sparkles, ArrowRight, Check } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface StoryStep {
  id: string;
  chapter: string;
  title: string;
  tagline: string;
  description: string;
  iconName: 'book' | 'flame' | 'sparkles';
  badgeText: string;
  quote: string;
}

const STORY_STEPS: StoryStep[] = [
  {
    id: '1',
    chapter: '01 — THE EMPTY DESK',
    title: 'Rough thought, polished.',
    tagline: 'Study is a craft.',
    description:
      'Highlights, half-questions, and messy source notes are worked and reworked until understanding shines. That work happens in one place: the quiet midnight bookshop.',
    iconName: 'book',
    badgeText: 'SCHOLAR’S CRAFT',
    quote: '"Comtus — from Latin comptus: adorned, polished, refined."',
  },
  {
    id: '2',
    chapter: '02 — LIGHT THE LAMP',
    title: 'Grounded or silent.',
    tagline: 'Thinking is visible.',
    description:
      'Every answer is strictly grounded in your own uploaded textbooks, notes, and papers. No hallucinations, full citations, and step-by-step reasoning you can verify.',
    iconName: 'flame',
    badgeText: 'EVIDENTIARY REASONING',
    quote: '"Every answer traces back to a source page you added."',
  },
  {
    id: '3',
    chapter: '03 — ENTER THE STUDY',
    title: 'Your thinking companion.',
    tagline: 'Local-first & BYOK.',
    description:
      'Practice with board exam simulators, get line-by-line essay coaching, and master active recall flashcards. Your notes stay private on your device.',
    iconName: 'sparkles',
    badgeText: 'LOCAL-FIRST STUDY',
    quote: '"One brass lamp lit, everything quiet except the thinking."',
  },
];

export interface OnboardingScreenProps {
  onComplete?: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<StoryStep>>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(slideIndex);
  };

  const handleNext = () => {
    if (activeIndex < STORY_STEPS.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: activeIndex + 1,
        animated: true,
      });
    } else {
      onComplete?.();
    }
  };

  const handleSkip = () => {
    onComplete?.();
  };

  const renderIcon = (name: StoryStep['iconName']) => {
    switch (name) {
      case 'book':
        return <BookOpen size={36} color={pixelColors.pxBrass} />;
      case 'flame':
        return <Flame size={36} color={pixelColors.pxCandle} />;
      case 'sparkles':
        return <Sparkles size={36} color={pixelColors.pxBrassLight} />;
    }
  };

  const renderStep = ({ item }: { item: StoryStep }) => (
    <View style={styles.slideContainer}>
      <View style={styles.slideContent}>
        {/* Chapter Header */}
        <Text style={styles.chapterText}>{item.chapter}</Text>
        
        {/* Pixel Icon Showcase */}
        <View style={styles.iconCircle}>
          {renderIcon(item.iconName)}
          <View style={styles.glowAura} />
        </View>

        <PixelBadge
          variant="brass"
          size="md"
          label={item.badgeText}
          style={styles.badgeStyle}
        />

        {/* Titles */}
        <Text style={styles.mainTitle}>{item.title}</Text>
        <Text style={styles.tagline}>{item.tagline}</Text>

        {/* Narrative Card */}
        <PixelCard variant="shelf" style={styles.narrativeCard}>
          <Text style={styles.descriptionText}>{item.description}</Text>
          <View style={styles.quoteDivider} />
          <Text style={styles.quoteText}>{item.quote}</Text>
        </PixelCard>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Bar with Skip */}
      <View style={styles.topBar}>
        <View style={styles.brandTitleContainer}>
          <Text style={styles.brandTitle}>COMTUS</Text>
          <Text style={styles.brandSubtitle}>STUDY COMPANION</Text>
        </View>
        {activeIndex < STORY_STEPS.length - 1 && (
          <PixelButton
            title="SKIP"
            variant="ghost"
            size="sm"
            onPress={handleSkip}
          />
        )}
      </View>

      {/* Story Carousel */}
      <FlatList
        ref={flatListRef}
        data={STORY_STEPS}
        renderItem={renderStep}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        keyExtractor={(item: StoryStep) => item.id}
        style={styles.flatList}
      />

      {/* Bottom Controls */}
      <View style={styles.bottomBar}>
        {/* Stepped Step Indicators */}
        <View style={styles.stepIndicators}>
          {STORY_STEPS.map((_: StoryStep, i: number) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                i === activeIndex && styles.stepDotActive,
              ]}
            />
          ))}
        </View>

        {/* Next / Enter Button */}
        <View style={styles.buttonWrapper}>
          <PixelButton
            title={activeIndex === STORY_STEPS.length - 1 ? 'ENTER THE STUDY' : 'CONTINUE'}
            variant="brass"
            size="lg"
            rightIcon={
              activeIndex === STORY_STEPS.length - 1 ? (
                <Check size={18} color={pixelColors.pxVoid} />
              ) : (
                <ArrowRight size={18} color={pixelColors.pxVoid} />
              )
            }
            onPress={handleNext}
            style={styles.primaryButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: pixelColors.pxGround,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 240, 230, 0.08)',
  },
  brandTitleContainer: {
    flexDirection: 'column',
  },
  brandTitle: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.lg,
    fontWeight: '900',
    color: pixelColors.pxBrass,
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 9,
    color: pixelColors.pxMuted,
    letterSpacing: 1.5,
  },
  flatList: {
    flex: 1,
  },
  slideContainer: {
    width,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideContent: {
    width: '100%',
    alignItems: 'center',
  },
  chapterText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.xs,
    color: pixelColors.pxMuted,
    letterSpacing: 2,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  iconCircle: {
    width: 80,
    height: 80,
    backgroundColor: pixelColors.pxSurface,
    borderWidth: 2,
    borderColor: pixelColors.pxBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
    elevation: 4,
    shadowColor: pixelColors.pxVoid,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.8,
    shadowRadius: 0,
  },
  glowAura: {
    position: 'absolute',
    width: 60,
    height: 60,
    backgroundColor: 'rgba(227, 176, 75, 0.1)',
  },
  badgeStyle: {
    marginBottom: 14,
  },
  mainTitle: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.xl,
    fontWeight: '800',
    color: pixelColors.pxInk,
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  tagline: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.md,
    color: pixelColors.pxBrassLight,
    textAlign: 'center',
    marginBottom: 18,
  },
  narrativeCard: {
    width: '100%',
    padding: 16,
  },
  descriptionText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.sm,
    color: pixelColors.pxInk,
    lineHeight: 20,
  },
  quoteDivider: {
    height: 1,
    backgroundColor: 'rgba(245, 240, 230, 0.1)',
    marginVertical: 12,
  },
  quoteText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.xs,
    color: pixelColors.pxMuted,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'android' ? 24 : 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 240, 230, 0.08)',
  },
  stepIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  stepDot: {
    width: 12,
    height: 6,
    backgroundColor: pixelColors.pxSurface,
    borderWidth: 1,
    borderColor: pixelColors.pxBorder,
  },
  stepDotActive: {
    width: 24,
    backgroundColor: pixelColors.pxBrass,
    borderColor: pixelColors.pxBrassLight,
  },
  buttonWrapper: {
    width: '100%',
  },
  primaryButton: {
    width: '100%',
  },
});
