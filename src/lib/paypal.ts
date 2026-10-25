/**
 * PayPal display config for Smarter Models.
 * New passes carry an included usage budget. Passes already sold carry
 * a request count. The proxy is the source of truth either way.
 */
import { budgetNanoForPrice, formatUsdFromNano } from "./credits";

/* A PayPal client id is public by design (the browser needs it to load the
   buttons); the env var stays the source of truth, and this production
   fallback only keeps checkout alive when a deploy misses it. */
export const PAYPAL_CLIENT_ID =
  (import.meta.env.VITE_PAYPAL_CLIENT_ID as string) ||
  "BAAynutt7UG_TKFyejl9ht8OGDrlSrLtTkw7CY9sJtz88QPBBojk7Zq98tasmx4g2rhtyl4XaDTPpStcNY";

export interface StudyPlan {
  id: "sprint" | "scholar" | "mastery";
  name: string;
  price: string;
  amount: number;
  budgetNano: number;
  days: number;
  badge?: string;
  popular?: boolean;
  desc: string;
}

export const STUDY_PLANS: StudyPlan[] = [
  {
    id: "sprint",
    name: "Sprint Pass",
    price: "2.99",
    amount: 2.99,
    budgetNano: budgetNanoForPrice("2.99"),
    days: 60,
    desc: "Focused exam prep and chapter review.",
  },
  {
    id: "scholar",
    name: "Scholar Pass",
    price: "6.99",
    amount: 6.99,
    budgetNano: budgetNanoForPrice("6.99"),
    days: 120,
    badge: "Popular",
    popular: true,
    desc: "Full-term study sessions, mock exams, and synthesis.",
  },
  {
    id: "mastery",
    name: "Mastery Pass",
    price: "14.99",
    amount: 14.99,
    budgetNano: budgetNanoForPrice("14.99"),
    days: 180,
    desc: "Deep research, thesis work, and intensive board review.",
  },
];

export type DecodedPass =
  | { kind: "requests"; requests: number; expiresAtMs: number }
  | { kind: "credits"; budgetNano: number; expiresAtMs: number };

/** Read the quota baked into a comtus-pass-v1 token. Display only — no signature check. */
export function decodePassInfo(token: string): DecodedPass | null {
  const t = token.trim();
  if (!t.startsWith("comtus-pass-v1.")) return null;
  const rest = t.slice("comtus-pass-v1.".length);
  const dot = rest.lastIndexOf(".");
  if (dot <= 0) return null;
  try {
    const b64 = rest.slice(0, dot).replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64)) as { v?: unknown; q?: unknown; c?: unknown; e?: unknown };
    if (typeof payload.e !== "number") return null;
    const expiresAtMs = payload.e * 1000;
    if (payload.v === 2 && typeof payload.c === "number") return { kind: "credits", budgetNano: payload.c, expiresAtMs };
    if (typeof payload.q === "number") return { kind: "requests", requests: payload.q, expiresAtMs };
    return null;
  } catch {
    return null;
  }
}

export function passSummary(info: DecodedPass): string {
  if (info.kind === "credits") {
    const days = Math.max(1, Math.ceil((info.expiresAtMs - Date.now()) / 86_400_000));
    return `Active pass · ${formatUsdFromNano(info.budgetNano)} hosted usage · ${days}d remaining`;
  }
  return `${info.requests} hosted requests`;
}

/** Best-effort tier label for a decoded pass. */
export function planTierForPass(info: DecodedPass): StudyPlan["id"] {
  if (info.kind === "requests") {
    if (info.requests >= 500) return "mastery";
    if (info.requests >= 200) return "scholar";
    return "sprint";
  }
  if (info.budgetNano >= budgetNanoForPrice("14.99")) return "mastery";
  if (info.budgetNano >= budgetNanoForPrice("6.99")) return "scholar";
  return "sprint";
}
