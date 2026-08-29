import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pixelColors, pixelTypography } from '../theme/colors';
import { PixelButton } from '../components/PixelButton';
import { PixelCard } from '../components/PixelCard';
import { PixelBadge } from '../components/PixelBadge';
import {
  Search,
  Plus,
  BookOpen,
  FileText,
  Flame,
  Clock,
  Sparkles,
  Award,
} from 'lucide-react-native';

export interface NotebookItem {
  id: string;
  title: string;
  discipline: string;
  sourceCount: number;
  chunkCount: number;
  lastStudied: string;
  examScore?: string;
  badgeVariant: 'brass' | 'moon' | 'sage' | 'rust';
}

const INITIAL_NOTEBOOKS: NotebookItem[] = [
  {
    id: '1',
    title: 'PNLE Comprehensive Nursing Care & Pharmacology',
    discipline: 'Medicine',
    sourceCount: 14,
    chunkCount: 240,
    lastStudied: 'Today, 2:15 PM',
    examScore: '92% (Mock #4)',
    badgeVariant: 'sage',
  },
  {
    id: '2',
    title: 'Civil Engineering Structural Analysis & Geotech',
    discipline: 'Engineering',
    sourceCount: 8,
    chunkCount: 165,
    lastStudied: 'Yesterday',
    examScore: '86% (Mock #2)',
    badgeVariant: 'brass',
  },
  {
    id: '3',
    title: 'Constitutional Law & Jurisprudence (Philippine Bar)',
    discipline: 'Law',
    sourceCount: 22,
    chunkCount: 410,
    lastStudied: '3 days ago',
    badgeVariant: 'moon',
  },
  {
    id: '4',
    title: 'Auditing Standards & Taxation CPA Review',
    discipline: 'Accountancy',
    sourceCount: 11,
    chunkCount: 198,
    lastStudied: 'Aug 24',
    badgeVariant: 'rust',
  },
];

const DISCIPLINES = ['All', 'Medicine', 'Engineering', 'Law', 'Accountancy'];

export interface HomeScreenProps {
  onSelectNotebook?: (notebook: NotebookItem) => void;
  onNewNotebook?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectNotebook,
  onNewNotebook,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState('All');
  const [notebooks] = useState<NotebookItem[]>(INITIAL_NOTEBOOKS);

  const filteredNotebooks = notebooks.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDiscipline = selectedDiscipline === 'All' || item.discipline === selectedDiscipline;
    return matchesSearch && matchesDiscipline;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Shelf Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>01 · THE SHELF</Text>
            <Text style={styles.headerTitle}>Your Study Desk</Text>
          </View>
          
          <View style={styles.streakPill}>
            <Flame size={16} color={pixelColors.pxCandle} />
            <Text style={styles.streakText}>4-DAY STREAK</Text>
          </View>
        </View>

        {/* Study Habit Milestone Banner */}
        <PixelCard variant="shelf" style={styles.bannerCard}>
          <View style={styles.bannerRow}>
            <View style={styles.bannerIcon}>
              <Award size={24} color={pixelColors.pxBrass} />
            </View>
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>Rough thought, polished.</Text>
              <Text style={styles.bannerDescription}>
                55 sources grounded across 4 study notebooks. Ready for mock examination drill.
              </Text>
            </View>
          </View>
        </PixelCard>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={18} color={pixelColors.pxMuted} style={styles.searchIcon} />
          <TextInput
            placeholder="Search notebooks, sources, topics..."
            placeholderTextColor={pixelColors.pxMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        {/* Discipline Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {DISCIPLINES.map((disc) => {
            const isSelected = selectedDiscipline === disc;
            return (
              <TouchableOpacity
                key={disc}
                onPress={() => setSelectedDiscipline(disc)}
                style={[
                  styles.filterPill,
                  isSelected && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isSelected && styles.filterPillTextActive,
                  ]}
                >
                  {disc}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Quick Action Bar */}
        <View style={styles.actionRow}>
          <Text style={styles.sectionHeading}>
            NOTEBOOKS ({filteredNotebooks.length})
          </Text>
          <PixelButton
            title="NEW NOTEBOOK"
            size="sm"
            variant="brass"
            leftIcon={<Plus size={14} color={pixelColors.pxVoid} />}
            onPress={onNewNotebook}
          />
        </View>

        {/* Notebook Cards Shelf */}
        {filteredNotebooks.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.85}
            onPress={() => onSelectNotebook?.(item)}
          >
            <PixelCard
              variant="book"
              style={styles.notebookCard}
            >
              <View style={styles.cardTopRow}>
                <PixelBadge
                  variant={item.badgeVariant}
                  size="sm"
                  label={item.discipline}
                />
                <View style={styles.lastStudiedRow}>
                  <Clock size={12} color={pixelColors.pxMuted} />
                  <Text style={styles.lastStudiedText}>{item.lastStudied}</Text>
                </View>
              </View>

              <Text style={styles.notebookTitle}>{item.title}</Text>

              {item.examScore && (
                <View style={styles.scoreRow}>
                  <Sparkles size={14} color={pixelColors.pxBrassLight} />
                  <Text style={styles.scoreText}>Best Mock: {item.examScore}</Text>
                </View>
              )}

              <View style={styles.cardMetaRow}>
                <View style={styles.metaItem}>
                  <FileText size={13} color={pixelColors.pxMuted} />
                  <Text style={styles.metaText}>{item.sourceCount} Sources</Text>
                </View>
                <View style={styles.metaItem}>
                  <BookOpen size={13} color={pixelColors.pxMuted} />
                  <Text style={styles.metaText}>{item.chunkCount} Study Chunks</Text>
                </View>
              </View>
            </PixelCard>
          </TouchableOpacity>
        ))}

        {filteredNotebooks.length === 0 && (
          <PixelCard variant="default" style={styles.emptyCard}>
            <BookOpen size={32} color={pixelColors.pxMuted} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No notebooks found</Text>
            <Text style={styles.emptySubtitle}>
              Try adjusting your search terms or create a new notebook to get started.
            </Text>
            <PixelButton
              title="CREATE FIRST NOTEBOOK"
              variant="brass"
              size="md"
              leftIcon={<Plus size={16} color={pixelColors.pxVoid} />}
              onPress={onNewNotebook}
              style={styles.emptyButton}
            />
          </PixelCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: pixelColors.pxGround,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 240, 230, 0.08)',
  },
  headerSubtitle: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
    color: pixelColors.pxBrass,
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.xl,
    fontWeight: '800',
    color: pixelColors.pxInk,
    marginTop: 2,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: pixelColors.pxSurface,
    borderWidth: 1,
    borderColor: pixelColors.pxBrassDeep,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  streakText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
    fontWeight: '700',
    color: pixelColors.pxCandle,
    letterSpacing: 0.5,
  },
  bannerCard: {
    marginTop: 14,
    marginBottom: 14,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    backgroundColor: pixelColors.pxVoid,
    borderWidth: 1,
    borderColor: pixelColors.pxBrassDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.sm,
    fontWeight: '700',
    color: pixelColors.pxBrass,
  },
  bannerDescription: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.xs,
    color: pixelColors.pxMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: pixelColors.pxSurface,
    borderWidth: 1,
    borderColor: pixelColors.pxBorder,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.sm,
    color: pixelColors.pxInk,
    paddingVertical: 0,
  },
  filterScroll: {
    marginBottom: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: pixelColors.pxBorder,
    backgroundColor: pixelColors.pxSurface,
  },
  filterPillActive: {
    borderColor: pixelColors.pxBrass,
    backgroundColor: pixelColors.pxRaised,
  },
  filterPillText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.xs,
    color: pixelColors.pxMuted,
  },
  filterPillTextActive: {
    color: pixelColors.pxBrass,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeading: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.xs,
    fontWeight: '700',
    color: pixelColors.pxMuted,
    letterSpacing: 1.2,
  },
  notebookCard: {
    marginBottom: 10,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lastStudiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lastStudiedText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
    color: pixelColors.pxMuted,
  },
  notebookTitle: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.md,
    fontWeight: '700',
    color: pixelColors.pxInk,
    lineHeight: 20,
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(227, 176, 75, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(227, 176, 75, 0.2)',
  },
  scoreText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    color: pixelColors.pxBrassLight,
    fontWeight: '600',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 240, 230, 0.08)',
    paddingTop: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    color: pixelColors.pxMuted,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 24,
    marginTop: 20,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.md,
    fontWeight: '700',
    color: pixelColors.pxInk,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.xs,
    color: pixelColors.pxMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyButton: {
    marginTop: 4,
  },
});
