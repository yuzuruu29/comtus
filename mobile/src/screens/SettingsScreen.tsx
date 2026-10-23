import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pixelColors, pixelTypography } from '../theme/colors';
import { PixelButton } from '../components/PixelButton';
import { PixelCard } from '../components/PixelCard';
import { PixelBadge } from '../components/PixelBadge';
import {
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  Moon,
  Sun,
  Sparkles,
  Volume2,
  HardDrive,
  Check,
  Cpu,
  Info,
} from 'lucide-react-native';

export const SettingsScreen: React.FC = () => {
  const [apiKey, setApiKey] = useState('sk-ant-api03-sample-key-grounded-scholar');
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(true);
  const [selectedModel, setSelectedModel] = useState<'opus' | 'sonnet' | 'haiku'>('opus');
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [motionTier, setMotionTier] = useState<'full' | 'minimal' | 'none'>('full');
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const handleSaveKey = () => {
    setKeySaved(true);
    Alert.alert('Key Saved', 'Your API key is securely encrypted on your local Android device storage.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Settings Header */}
        <View style={styles.header}>
          <Text style={styles.headerSub}>03 · DESK CONFIGURATION</Text>
          <Text style={styles.headerTitle}>Settings & Privacy</Text>
        </View>

        {/* Section 1: BYOK API Key */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Key size={16} color={pixelColors.pxBrass} />
            <Text style={styles.sectionTitle}>BRING YOUR OWN KEY (BYOK)</Text>
          </View>

          <PixelCard variant="book" style={styles.card}>
            <Text style={styles.label}>ANTHROPIC OR OPENROUTER API KEY</Text>
            <View style={styles.inputRow}>
              <TextInput
                secureTextEntry={!showKey}
                value={apiKey}
                onChangeText={(text: string) => {
                  setApiKey(text);
                  setKeySaved(false);
                }}
                placeholder="sk-ant-..."
                placeholderTextColor={pixelColors.pxMuted}
                style={styles.keyInput}
              />
              <TouchableOpacity
                onPress={() => setShowKey(!showKey)}
                style={styles.eyeButton}
              >
                {showKey ? (
                  <EyeOff size={18} color={pixelColors.pxMuted} />
                ) : (
                  <Eye size={18} color={pixelColors.pxMuted} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.saveRow}>
              <View style={styles.privacyNote}>
                <ShieldCheck size={14} color={pixelColors.pxSage} />
                <Text style={styles.privacyText}>Local-only · Never leaves device</Text>
              </View>

              <PixelButton
                title={keySaved ? 'SAVED' : 'SAVE KEY'}
                size="sm"
                variant={keySaved ? 'secondary' : 'brass'}
                leftIcon={keySaved ? <Check size={14} color={pixelColors.pxSage} /> : undefined}
                onPress={handleSaveKey}
              />
            </View>

            {/* Model Selection */}
            <View style={styles.modelSection}>
              <Text style={styles.label}>REASONING MODEL</Text>
              <View style={styles.modelButtonsRow}>
                <TouchableOpacity
                  onPress={() => setSelectedModel('opus')}
                  style={[
                    styles.modelOption,
                    selectedModel === 'opus' && styles.modelOptionActive,
                  ]}
                >
                  <Cpu size={14} color={selectedModel === 'opus' ? pixelColors.pxBrass : pixelColors.pxMuted} />
                  <Text style={[styles.modelText, selectedModel === 'opus' && styles.modelTextActive]}>
                    Claude Opus 5.5
                  </Text>
                  <PixelBadge variant="brass" size="sm" label="Default" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setSelectedModel('sonnet')}
                  style={[
                    styles.modelOption,
                    selectedModel === 'sonnet' && styles.modelOptionActive,
                  ]}
                >
                  <Cpu size={14} color={selectedModel === 'sonnet' ? pixelColors.pxBrass : pixelColors.pxMuted} />
                  <Text style={[styles.modelText, selectedModel === 'sonnet' && styles.modelTextActive]}>
                    Claude Sonnet 5.5
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </PixelCard>
        </View>

        {/* Section 2: Appearance & Theme */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            {isDarkTheme ? (
              <Moon size={16} color={pixelColors.pxBrass} />
            ) : (
              <Sun size={16} color={pixelColors.pxBrass} />
            )}
            <Text style={styles.sectionTitle}>APPEARANCE & THEME</Text>
          </View>

          <PixelCard variant="shelf" style={styles.card}>
            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleTitle}>Lamplight Dark Mode</Text>
                <Text style={styles.toggleSubtitle}>16-bit Cozy Bookshop midnight palette</Text>
              </View>
              <Switch
                value={isDarkTheme}
                onValueChange={setIsDarkTheme}
                trackColor={{ false: pixelColors.pxSurface, true: pixelColors.pxBrassDeep }}
                thumbColor={isDarkTheme ? pixelColors.pxBrass : pixelColors.pxMuted}
              />
            </View>

            <View style={styles.divider} />

            {/* Atmosphere & Stepped Motion */}
            <Text style={styles.label}>ATMOSPHERE & ANIMATION INTENSITY</Text>
            <View style={styles.motionButtonsRow}>
              {(['full', 'minimal', 'none'] as const).map((tier) => (
                <TouchableOpacity
                  key={tier}
                  onPress={() => setMotionTier(tier)}
                  style={[
                    styles.motionPill,
                    motionTier === tier && styles.motionPillActive,
                  ]}
                >
                  <Sparkles
                    size={12}
                    color={motionTier === tier ? pixelColors.pxBrass : pixelColors.pxMuted}
                  />
                  <Text
                    style={[
                      styles.motionText,
                      motionTier === tier && styles.motionTextActive,
                    ]}
                  >
                    {tier.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </PixelCard>
        </View>

        {/* Section 3: Tactile & Audio Preferences */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Volume2 size={16} color={pixelColors.pxBrass} />
            <Text style={styles.sectionTitle}>TACTILE & AUDIO PREFERENCES</Text>
          </View>

          <PixelCard variant="default" style={styles.card}>
            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleTitle}>Android Haptic Press</Text>
                <Text style={styles.toggleSubtitle}>Tactile feedback on ink-press buttons</Text>
              </View>
              <Switch
                value={hapticsEnabled}
                onValueChange={setHapticsEnabled}
                trackColor={{ false: pixelColors.pxSurface, true: pixelColors.pxBrassDeep }}
                thumbColor={hapticsEnabled ? pixelColors.pxBrass : pixelColors.pxMuted}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleTitle}>Desk Sound Effects</Text>
                <Text style={styles.toggleSubtitle}>Subtle quill strokes & lamp bell chime</Text>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={setSoundEnabled}
                trackColor={{ false: pixelColors.pxSurface, true: pixelColors.pxBrassDeep }}
                thumbColor={soundEnabled ? pixelColors.pxBrass : pixelColors.pxMuted}
              />
            </View>
          </PixelCard>
        </View>

        {/* Section 4: Device Storage */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <HardDrive size={16} color={pixelColors.pxBrass} />
            <Text style={styles.sectionTitle}>ON-DEVICE STORAGE</Text>
          </View>

          <PixelCard variant="parchment" style={styles.card}>
            <Text style={[styles.label, { color: '#5C3E1B' }]}>LOCAL STUDY REPOSITORY</Text>
            <Text style={[styles.storageText, { color: '#1B2334' }]}>
              55 Grounded Sources · 1,013 Lexical Chunks (2.8 MB)
            </Text>
            <View style={styles.storageActionsRow}>
              <PixelButton
                title="EXPORT BACKUP"
                size="sm"
                variant="brass"
                onPress={() => Alert.alert('Exported', 'Study notes bundle exported to downloads.')}
              />
              <PixelButton
                title="CLEAR CACHE"
                size="sm"
                variant="secondary"
                onPress={() => Alert.alert('Cache Cleared', 'Temporary search index rebuilt.')}
              />
            </View>
          </PixelCard>
        </View>

        {/* Section 5: Version & Brand Footer */}
        <View style={styles.footerSection}>
          <View style={styles.footerRow}>
            <Info size={14} color={pixelColors.pxMuted} />
            <Text style={styles.footerText}>
              Comtus Mobile · v0.3.1 (Phase 5 Mobile Architecture)
            </Text>
          </View>
          <Text style={styles.footerSubText}>
            Rough thought, polished. Standalone Android & iOS Build.
          </Text>
        </View>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 240, 230, 0.08)',
    marginBottom: 16,
  },
  headerSub: {
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
  section: {
    marginBottom: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    fontWeight: '700',
    color: pixelColors.pxBrass,
    letterSpacing: 1.2,
  },
  card: {
    padding: 14,
  },
  label: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
    fontWeight: '700',
    color: pixelColors.pxMuted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: pixelColors.pxGround,
    borderWidth: 1,
    borderColor: pixelColors.pxBorder,
    marginBottom: 10,
  },
  keyInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 12,
    color: pixelColors.pxInk,
  },
  eyeButton: {
    padding: 10,
  },
  saveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  privacyText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
    color: pixelColors.pxSage,
  },
  modelSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 240, 230, 0.08)',
    paddingTop: 12,
  },
  modelButtonsRow: {
    gap: 8,
  },
  modelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderWidth: 1,
    borderColor: pixelColors.pxBorder,
    backgroundColor: pixelColors.pxSurface,
  },
  modelOptionActive: {
    borderColor: pixelColors.pxBrass,
    backgroundColor: pixelColors.pxRaised,
  },
  modelText: {
    flex: 1,
    marginLeft: 8,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 12,
    color: pixelColors.pxMuted,
  },
  modelTextActive: {
    color: pixelColors.pxInk,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  toggleTitle: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 13,
    fontWeight: '700',
    color: pixelColors.pxInk,
  },
  toggleSubtitle: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
    color: pixelColors.pxMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(245, 240, 230, 0.08)',
    marginVertical: 12,
  },
  motionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  motionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: pixelColors.pxBorder,
    backgroundColor: pixelColors.pxGround,
  },
  motionPillActive: {
    borderColor: pixelColors.pxBrass,
    backgroundColor: pixelColors.pxRaised,
  },
  motionText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
    color: pixelColors.pxMuted,
  },
  motionTextActive: {
    color: pixelColors.pxBrass,
    fontWeight: '700',
  },
  storageText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  storageActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  footerSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  footerText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    color: pixelColors.pxMuted,
  },
  footerSubText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
    color: pixelColors.pxMuted,
    fontStyle: 'italic',
  },
});
