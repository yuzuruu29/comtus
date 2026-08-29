import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pixelColors, pixelTypography } from '../theme/colors';
import { PixelButton } from '../components/PixelButton';
import { PixelCard } from '../components/PixelCard';
import { PixelBadge } from '../components/PixelBadge';
import {
  Send,
  Sparkles,
  Paperclip,
  ChevronDown,
  ChevronUp,
  BookOpen,
  FileText,
  CheckCircle2,
  BrainCircuit,
  CornerDownRight,
} from 'lucide-react-native';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  thinking?: string;
  citations?: { id: string; docName: string; page: number; snippet: string }[];
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    sender: 'user',
    content:
      'What are the primary hemodynamic parameters to monitor during high-dose dopamine administration in cardiogenic shock?',
    timestamp: '2:14 PM',
  },
  {
    id: 'm2',
    sender: 'assistant',
    content:
      'Based on **Cardiogenic Shock Management (PNLE Ch. 8)** and **Pharmacology Review (Unit 4)**, the primary parameters requiring strict titration include:\n\n1. **Mean Arterial Pressure (MAP)**: Target ≥65 mmHg.\n2. **Systemic Vascular Resistance (SVR)**: Monitor for excessive vasoconstriction above 10 mcg/kg/min (alpha-1 predominance).\n3. **Central Venous Pressure (CVP)** & Pulmonary Capillary Wedge Pressure (PCWP) to assess fluid overload risk.\n4. **Continuous ECG**: Watch for ventricular arrhythmias and sinus tachycardia.',
    timestamp: '2:15 PM',
    thinking:
      'Retrieved 3 chunks from Pharmacology_Review_Unit4.pdf (score: 0.94) and PNLE_Nursing_Ch8.pdf (score: 0.88). Verified dosage thresholds for alpha-1 adrenergic versus beta-1 inotropic activity. Synthesized 4 core parameters with grounding citations.',
    citations: [
      {
        id: 'c1',
        docName: 'PNLE_Nursing_Ch8.pdf',
        page: 42,
        snippet: 'Dopamine dosing >10 mcg/kg/min induces peripheral vasoconstriction, increasing afterload.',
      },
      {
        id: 'c2',
        docName: 'Pharmacology_Review_Unit4.pdf',
        page: 18,
        snippet: 'Maintain MAP >= 65 mmHg; titrate via central line with continuous arterial line monitoring.',
      },
    ],
  },
];

const SUGGESTED_CHIPS = [
  'Generate 5-item Board Quiz',
  'Summarize Drug Contraindications',
  'Compare with Dobutamine',
];

export const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);
  const [activeCitation, setActiveCitation] = useState<{ docName: string; page: number; snippet: string } | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      content: input.trim(),
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Simulate grounded assistant response with thinking
    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        content: `Analyzing your query against the 14 grounded sources in this notebook. Dobutamine primarily acts on Beta-1 receptors to increase cardiac output and stroke volume with minimal alpha vasoconstriction, making it preferable when systemic vascular resistance is already elevated.`,
        timestamp: 'Just now',
        thinking:
          'BM25 index query matched Dobutamine vs Dopamine comparison table in PNLE_Nursing_Ch8.pdf (chunk 114). Extracted differential inotropic vs chronotropic actions.',
        citations: [
          {
            id: 'c3',
            docName: 'PNLE_Nursing_Ch8.pdf',
            page: 45,
            snippet: 'Dobutamine reduces afterload via mild beta-2 vasodilation unlike high-dose dopamine.',
          },
        ],
      };
      setMessages((prev) => [...prev, assistantMsg]);
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 1200);
  };

  const handleSelectChip = (chip: string) => {
    setInput(chip);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Chat Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerSub}>02 · STUDY DESK CHAT</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              PNLE Comprehensive Nursing Care
            </Text>
          </View>

          <View style={styles.sourcesTag}>
            <BookOpen size={12} color={pixelColors.pxBrass} />
            <Text style={styles.sourcesTagText}>14 SOURCES</Text>
          </View>
        </View>

        {/* Active Grounded Citation Modal / Banner */}
        {activeCitation && (
          <View style={styles.citationBanner}>
            <View style={styles.citationBannerHeader}>
              <View style={styles.citationDocRow}>
                <FileText size={14} color={pixelColors.pxBrass} />
                <Text style={styles.citationDocTitle}>
                  {activeCitation.docName} (Page {activeCitation.page})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setActiveCitation(null)}>
                <Text style={styles.citationCloseText}>CLOSE</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.citationSnippetText}>"{activeCitation.snippet}"</Text>
          </View>
        )}

        {/* Message Thread */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Grounding Status Pill */}
          <View style={styles.groundingPillContainer}>
            <View style={styles.groundingPill}>
              <CheckCircle2 size={13} color={pixelColors.pxSage} />
              <Text style={styles.groundingPillText}>
                Grounded Mode Active · Full Citations Enabled
              </Text>
            </View>
          </View>

          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageRow,
                msg.sender === 'user' ? styles.userRow : styles.assistantRow,
              ]}
            >
              {msg.sender === 'user' ? (
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{msg.content}</Text>
                  <Text style={styles.userTime}>{msg.timestamp}</Text>
                </View>
              ) : (
                <View style={styles.assistantContainer}>
                  {/* Reasoning / Thinking Panel */}
                  {msg.thinking && (
                    <PixelCard
                      variant="shelf"
                      style={styles.thinkingCard}
                    >
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setIsThinkingExpanded(!isThinkingExpanded)}
                        style={styles.thinkingHeader}
                      >
                        <View style={styles.thinkingTitleRow}>
                          <BrainCircuit size={14} color={pixelColors.pxMoon} />
                          <Text style={styles.thinkingTitle}>VISIBLE REASONING</Text>
                        </View>
                        {isThinkingExpanded ? (
                          <ChevronUp size={14} color={pixelColors.pxMoon} />
                        ) : (
                          <ChevronDown size={14} color={pixelColors.pxMoon} />
                        )}
                      </TouchableOpacity>

                      {isThinkingExpanded && (
                        <Text style={styles.thinkingBody}>{msg.thinking}</Text>
                      )}
                    </PixelCard>
                  )}

                  {/* Main Grounded Response */}
                  <PixelCard variant="book" style={styles.assistantBubble}>
                    <Text style={styles.assistantText}>{msg.content}</Text>

                    {/* Citations Footer */}
                    {msg.citations && msg.citations.length > 0 && (
                      <View style={styles.citationsContainer}>
                        <Text style={styles.citationsLabel}>GROUNDED CITATIONS:</Text>
                        <View style={styles.citationChipsRow}>
                          {msg.citations.map((c) => (
                            <TouchableOpacity
                              key={c.id}
                              onPress={() => setActiveCitation(c)}
                            >
                              <PixelBadge
                                variant="brass"
                                size="sm"
                                label={`P.${c.page} · ${c.docName.slice(0, 14)}...`}
                                icon={<CornerDownRight size={10} color={pixelColors.pxBrass} />}
                              />
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    <Text style={styles.assistantTime}>{msg.timestamp}</Text>
                  </PixelCard>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Suggested Queries */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContainer}
        >
          {SUGGESTED_CHIPS.map((chip, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => handleSelectChip(chip)}
              style={styles.suggestedChip}
            >
              <Sparkles size={12} color={pixelColors.pxBrass} />
              <Text style={styles.suggestedChipText}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Composer */}
        <View style={styles.composer}>
          <TouchableOpacity style={styles.attachButton}>
            <Paperclip size={18} color={pixelColors.pxMuted} />
          </TouchableOpacity>

          <TextInput
            placeholder="Ask your grounded study companion..."
            placeholderTextColor={pixelColors.pxMuted}
            value={input}
            onChangeText={setInput}
            multiline
            style={styles.composerInput}
          />

          <PixelButton
            variant="brass"
            size="sm"
            onPress={handleSend}
            disabled={!input.trim()}
            style={styles.sendButton}
          >
            <Send size={16} color={pixelColors.pxVoid} />
          </PixelButton>
        </View>
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 240, 230, 0.08)',
  },
  headerLeft: {
    flex: 1,
    marginRight: 10,
  },
  headerSub: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
    color: pixelColors.pxBrass,
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.sm,
    fontWeight: '700',
    color: pixelColors.pxInk,
  },
  sourcesTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: pixelColors.pxSurface,
    borderWidth: 1,
    borderColor: pixelColors.pxBrassDeep,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sourcesTagText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
    fontWeight: '700',
    color: pixelColors.pxBrass,
  },
  citationBanner: {
    backgroundColor: pixelColors.pxSurface,
    borderBottomWidth: 2,
    borderBottomColor: pixelColors.pxBrass,
    padding: 12,
  },
  citationBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  citationDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  citationDocTitle: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    fontWeight: '700',
    color: pixelColors.pxBrass,
  },
  citationCloseText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
    color: pixelColors.pxMuted,
    fontWeight: '700',
  },
  citationSnippetText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    color: pixelColors.pxInk,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  thread: {
    flex: 1,
  },
  threadContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  groundingPillContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  groundingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(120, 176, 132, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(120, 176, 132, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  groundingPillText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
    color: pixelColors.pxSage,
    fontWeight: '600',
  },
  messageRow: {
    marginBottom: 16,
  },
  userRow: {
    alignItems: 'flex-end',
  },
  userBubble: {
    backgroundColor: pixelColors.pxRaised,
    borderWidth: 1,
    borderColor: pixelColors.pxBorder,
    maxWidth: '85%',
    padding: 12,
    elevation: 2,
    shadowColor: pixelColors.pxVoid,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 0,
  },
  userText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.sm,
    color: pixelColors.pxInk,
    lineHeight: 19,
  },
  userTime: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 9,
    color: pixelColors.pxMuted,
    marginTop: 6,
    textAlign: 'right',
  },
  assistantRow: {
    alignItems: 'flex-start',
    width: '100%',
  },
  assistantContainer: {
    width: '100%',
  },
  thinkingCard: {
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: pixelColors.pxMoon,
    padding: 10,
  },
  thinkingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  thinkingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  thinkingTitle: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 10,
    fontWeight: '700',
    color: pixelColors.pxMoon,
    letterSpacing: 1,
  },
  thinkingBody: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    color: pixelColors.pxMuted,
    lineHeight: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(108, 152, 194, 0.2)',
    paddingTop: 6,
  },
  assistantBubble: {
    width: '100%',
    padding: 14,
  },
  assistantText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.sm,
    color: pixelColors.pxInk,
    lineHeight: 21,
  },
  citationsContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 240, 230, 0.1)',
    paddingTop: 8,
  },
  citationsLabel: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 9,
    fontWeight: '700',
    color: pixelColors.pxBrass,
    letterSpacing: 1,
    marginBottom: 6,
  },
  citationChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  assistantTime: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 9,
    color: pixelColors.pxMuted,
    marginTop: 8,
  },
  chipsScroll: {
    maxHeight: 36,
    marginBottom: 8,
  },
  chipsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  suggestedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: pixelColors.pxSurface,
    borderWidth: 1,
    borderColor: pixelColors.pxBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestedChipText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    color: pixelColors.pxInk,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: pixelColors.pxSurface,
    borderTopWidth: 1,
    borderTopColor: pixelColors.pxBorder,
    gap: 8,
  },
  attachButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  composerInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: pixelColors.pxGround,
    borderWidth: 1,
    borderColor: pixelColors.pxBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: pixelTypography.sizes.sm,
    color: pixelColors.pxInk,
  },
  sendButton: {
    minHeight: 38,
    paddingHorizontal: 12,
  },
});
