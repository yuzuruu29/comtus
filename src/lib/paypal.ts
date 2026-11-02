/**
 * PayPal display config for Smarter Models.
 * New passes carry an included usage budget. Passes already sold carry
 * a request count. The proxy is the source of truth either way.
 */
import { budgetNanoForPrice, formatUsdFromNano } from "./credits";

export const PAYPAL_CLIENT_ID = (import.meta.env.VITE_PAYPAL_CLIENT_ID as string | undefined)?.trim() || "";

export interface StudyPlan {
  id: "sprint" | "scholar" | "mastery";
  name: string;
  price: string;
  regularPrice: string;
  amount: number;
  budgetNano: number;
  badge?: string;
  popular?: boolean;
  desc: string;
}

export const STUDY_PLANS: StudyPlan[] = [
  {
    id: "sprint",
    name: "Sprint Pass",
    price: "5.00",
    regularPrice: "8.33",
    amount: 5,
    budgetNano: budgetNanoForPrice("5.00"),
    desc: "Focused exam prep and chapter review.",
  },
  {
    id: "scholar",
    name: "Scholar Pass",
    price: "20.00",
    regularPrice: "33.33",
    amount: 20,
    budgetNano: budgetNanoForPrice("20.00"),
    badge: "Popular",
    popular: true,
    desc: "Study sessions, mock exams, and synthesis.",
  },
  {
    id: "mastery",
    name: "Mastery Pass",
    price: "60.00",
    regularPrice: "100.00",
    amount: 60,
    budgetNano: budgetNanoForPrice("60.00"),
    desc: "Deep research, thesis work, and intensive board review.",
  },
];

export type DecodedPass =
  | { kind: "requests"; requests: number; expiresAtMs: number }
  | { kind: "credits"; budgetNano: number; expiresAtMs: number | null };

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
    if (payload.v === 3 && typeof payload.c === "number" && payload.e === undefined) return { kind: "credits", budgetNano: payload.c, expiresAtMs: null };
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
    if (info.expiresAtMs === null) return `Active pass · ${formatUsdFromNano(info.budgetNano)} hosted usage · no expiry`;
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
  if (info.budgetNano === budgetNanoForPrice("20.00")) return "scholar";
  if (info.budgetNano >= budgetNanoForPrice("14.99")) return "mastery";
  if (info.budgetNano >= budgetNanoForPrice("6.99")) return "scholar";
  return "sprint";
}
