/** Shared domain types — the whole studio speaks this language. */

export type SourceKind =
  | "pdf"
  | "docx"
  | "txt"
  | "md"
  | "json"
  | "url"
  | "paste";

export interface Notebook {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Source {
  id: string;
  notebookId: string;
  title: string;
  kind: SourceKind;
  content: string; // full extracted text
  chars: number;
  tokens: number; // ≈ chars/4 estimate
  addedAt: number;
  meta?: { url?: string; pages?: number; origin?: string };
}

export interface Chunk {
  id: string; // sourceId:idx
  sourceId: string;
  notebookId: string;
  idx: number;
  text: string;
  tokens: number;
}

export interface Citation {
  /** Index into the document blocks we sent — maps to a Source. */
  documentIndex: number;
  sourceId?: string;
  sourceTitle: string;
  citedText: string;
  startChar?: number;
  endChar?: number;
}

export interface ChatMessage {
  id: string;
  notebookId: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  citations?: Citation[];
  error?: string;
  createdAt: number;
}

export type GenerationKind =
  | "quiz"
  | "exam"
  | "essay-review"
  | "study-guide"
  | "brief"
  | "faq"
  | "timeline"
  | "flashcards"
  | "presentation"
  | "slideshow";

export interface Generation {
  id: string;
  notebookId: string;
  kind: GenerationKind;
  title: string;
  /** Fully-formed, kind-specific payload — see generators/*.ts */
  payload: unknown;
  createdAt: number;
}

/* ── Quiz & exam payloads ─────────────────────────────────── */

export type QuizFormat = "mcq" | "truefalse" | "identification";

export interface QuizQuestion {
  id: string;
  format: QuizFormat;
  topic: string;
  difficulty: "easy" | "moderate" | "hard";
  stem: string;
  /** MCQ / T-F options; identification leaves empty. */
  options: string[];
  answerIndex: number; // for identification: always 0, answer lives in `answer`
  answer: string;
  rationale: string;
  /** Source the item was drawn from, when the model names one. */
  sourceHint?: string;
}

export interface QuizPayload {
  questions: QuizQuestion[];
  config: QuizConfig;
}

export interface QuizConfig {
  count: number;
  formats: QuizFormat[];
  difficulty: "mixed" | "easy" | "moderate" | "hard";
  scope: string; // topic scope or "entire notebook"
}

export type ExamPresetId = "pnle" | "let" | "ce" | "cpa" | "custom";

export interface BlueprintSection {
  topic: string;
  items: number;
}

export interface ExamBlueprint {
  preset: ExamPresetId;
  title: string;
  totalItems: number;
  minutes: number;
  sections: BlueprintSection[];
  difficulty: "mixed" | "easy" | "moderate" | "hard";
}

export interface ExamPayload {
  blueprint: ExamBlueprint;
  questions: QuizQuestion[];
}

export type ExamMode = "simulated" | "drill";

/* ── Essay payloads ───────────────────────────────────────── */

export interface RubricCriterion {
  name: string;
  score: number;
  max: number;
  comment: string;
}

export interface EssayReviewPayload {
  prompt: string;
  rubricName: string;
  essay: string;
  overall: number;
  overallMax: number;
  criteria: RubricCriterion[];
  strengths: string[];
  improvements: string[];
  reasoning: string;
}

export const RUBRICS: { id: string; name: string; criteria: [string, number][] }[] = [
  {
    id: "university",
    name: "University essay",
    criteria: [
      ["Thesis & argument", 25],
      ["Use of evidence", 25],
      ["Organization & flow", 20],
      ["Critical depth", 20],
      ["Mechanics & style", 10],
    ],
  },
  {
    id: "ielts",
    name: "IELTS Writing Task 2",
    criteria: [
      ["Task response", 25],
      ["Coherence & cohesion", 25],
      ["Lexical resource", 25],
      ["Grammatical range & accuracy", 25],
    ],
  },
  {
    id: "board",
    name: "Board-exam short essay",
    criteria: [
      ["Directness of answer", 30],
      ["Accuracy of concepts", 40],
      ["Application to scenario", 30],
    ],
  },
];

/* ── Flashcards ───────────────────────────────────────────── */

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  topic?: string;
}

export interface FlashcardsPayload {
  cards: Flashcard[];
}

export interface CardProgress {
  id: string; // generationId:cardId
  generationId: string;
  notebookId: string;
  ease: number; // SM-2-lite
  intervalDays: number;
  dueAt: number;
  reps: number;
}

/* ── Study aid payloads (markdown documents) ──────────────── */

export interface DocPayload {
  markdown: string;
}

/* ── Presentation & Slideshow payloads (Anthropic Exclusive) ─── */

export interface Slide {
  id: string;
  slideNumber: number;
  title: string;
  subtitle?: string;
  bullets: string[];
  notes?: string; // Speaker notes
  visualLayoutHint?: string; // e.g. "Key Definition", "2-Column Comparison", "Stat Highlight", "Process Flow"
}

export interface PresentationPayload {
  topic: string;
  deckTitle: string;
  deckSubtitle?: string;
  slides: Slide[];
}

/* ── Settings ─────────────────────────────────────────────── */

/** Anthropic (official API or any Anthropic-shaped gateway) and any
 *  OpenAI-compatible endpoint (OpenRouter, Ollama, LM Studio, Groq,
 *  DeepSeek, Together, vLLM, OpenAI itself…). */
export type ProviderId = "anthropic" | "openai-compatible";

export type AnthropicModelId = "claude-opus-5" | "claude-sonnet-5";
export type Effort = "medium" | "high" | "xhigh";

export interface StoredKey {
  id: string;
  name: string;
  provider: "openrouter" | "groq" | "deepseek" | "together" | "ollama" | "custom";
  apiKey: string;
  baseUrl: string;
  defaultModel?: string;
  createdAt: number;
}
