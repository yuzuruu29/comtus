/** Shared domain types — the whole studio speaks this language. */

export type SourceKind =
  | "pdf"
  | "docx"
  | "txt"
  | "md"
  | "json"
  | "url"
  | "paste"
  | "img";

export interface Notebook {
  id: string;
  name: string;
  description?: string;
  /** Local midnight of the exam this notebook is for, when one is set. */
  examAt?: number;
  /** What the exam is called ("Midterm", "Board exam"); optional. */
  examName?: string;
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
  /** Set when the cited document was a web search result rather than a saved source. */
  url?: string;
}

/** One named conversation inside a notebook. Messages carry `sessionId`
 *  to point at their thread; v2 migration folds pre-session messages
 *  into a single per-notebook session. */
export interface ChatSession {
  id: string;
  notebookId: string;
  /** "" renders as "New chat"; auto-titled from the first user question. */
  title: string;
  createdAt: number;
  updatedAt: number;
}

/** Outcome of a live web-search turn, shown in the chat strip and sent to the model. */
export type WebSearchStatus = "ok" | "empty" | "error";

export interface WebSearchMeta {
  status: WebSearchStatus;
  query: string;
  count: number;
  ms: number;
  error?: string;
}

export interface ChatMessage {
  id: string;
  notebookId: string;
  sessionId?: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  citations?: Citation[];
  webSearch?: WebSearchMeta;
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
  | "slideshow"
  | "note"
  | "audio-overview";

export interface Generation {
  id: string;
  notebookId: string;
  kind: GenerationKind;
  title: string;
  /** Fully-formed, kind-specific payload — see generators/*.ts */
  payload: unknown;
  createdAt: number;
  /** When an edit last changed it (a note rewritten, cards added); absent
   *  on work never edited. Settles which copy wins when devices merge. */
  updatedAt?: number;
}

/* ── Quiz & exam payloads ─────────────────────────────────── */

/** "solution" = problem-solving item: the student submits a photo of
 *  their handwritten solution and AI grades it (see SolutionCheck). */
export type QuizFormat = "mcq" | "truefalse" | "identification" | "solution";

export interface QuestionGraph {
  title: string;
  xLabel: string;
  yLabel: string;
  series: { label: string; points: [number, number][] }[];
  xRange?: [number, number];
  yRange?: [number, number];
}

export interface QuizQuestion {
  id: string;
  format: QuizFormat;
  topic: string;
  difficulty: "easy" | "moderate" | "hard";
  stem: string;
  graph?: QuestionGraph;
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

/* ── Attempts: what happened when the student sat a quiz or exam ── */

export interface AttemptItem {
  /** QuizQuestion.id within the attempted generation. */
  questionId: string;
  topic: string;
  /** 0 wrong, 0.5 partially correct solution, 1 correct. */
  credit: number;
  /** False when the item was left blank. */
  answered: boolean;
}

export interface Attempt {
  id: string;
  notebookId: string;
  generationId: string;
  kind: "quiz" | "exam";
  /** "misses" = a retake of only the items missed last time. */
  scope: "full" | "misses";
  score: number;
  total: number;
  items: AttemptItem[];
  finishedAt: number;
}

/* ── Highlights: passages the student marked while reading ── */

export interface Highlight {
  id: string;
  notebookId: string;
  sourceId: string;
  /** Character range in Source.content, end exclusive — the same offsets
   *  citations and search results use. */
  start: number;
  end: number;
  /** The words covered, kept for lists, notes and search. */
  quote: string;
  /** The student's margin note; "" for a plain highlight. */
  note: string;
  createdAt: number;
  updatedAt: number;
}

/* ── Handwritten solution submissions ─────────────────────── */

export type SolutionVerdict = "correct" | "partial" | "incorrect" | "unreadable";

/** AI grading of a submitted handwritten solution. Scoring: correct = 1,
 *  partial = ½, anything else = 0 — and it can be wrong, so the UI
 *  always tells the student to double-check. */
export interface SolutionCheck {
  verdict: SolutionVerdict;
  /** Whether the final answer (drawn or typed) matches the expected one. */
  finalAnswerOk: boolean;
  /** The final answer as best the model could read it off the sheet. */
  transcribedAnswer: string;
  /** Concrete mistakes in the working, one sentence each. */
  errors: string[];
  /** Teaching feedback — what held up, what broke, what to review. */
  feedback: string;
}

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
  /** Times a graduated card was forgotten ("again"); absent on older rows. */
  lapses?: number;
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

/* ── Note & Audio Overview payloads ──────────────────────── */

export interface NotePayload {
  content: string;
  tags?: string[];
}

export interface AudioOverviewSpeakerTurn {
  speaker: "Alex" | "Sam" | string;
  text: string;
}

export interface AudioOverviewPayload {
  title: string;
  summary: string;
  script: AudioOverviewSpeakerTurn[];
  duration?: number;
}

/* ── Settings ─────────────────────────────────────────────── */

/** Anthropic (official API or a hosted pass) or any OpenAI-compatible
 *  endpoint (OpenRouter, Ollama, LM Studio, Groq, DeepSeek, Together, vLLM,
 *  OpenAI itself…). */
export type ProviderId = "anthropic" | "openai-compatible";

export type AnthropicModelId =
  | "claude-opus-5-5"
  | "claude-sonnet-5-5"
  | "claude-opus-5"
  | "claude-sonnet-5";
export type Effort = "low" | "medium" | "high" | "xhigh";

export interface StoredKey {
  id: string;
  name: string;
  provider: "openrouter" | "groq" | "deepseek" | "together" | "ollama" | "zen" | "cerebras" | "custom";
  apiKey: string;
  baseUrl: string;
  defaultModel?: string;
  createdAt: number;
}
