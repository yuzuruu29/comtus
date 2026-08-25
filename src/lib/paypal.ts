/**
 * PayPal Integration Configuration for Comtus Smarter Models Access.
 *
 * Passes are metered in hosted requests by the server proxy (each pass
 * carries its exact quota inside the signed token) — never advertise
 * token quantities, which we neither meter nor enforce.
 */

export const PAYPAL_CLIENT_ID =
  (import.meta.env.VITE_PAYPAL_CLIENT_ID as string) ||
  "BAAynutt7UG_TKFyejl9ht8OGDrlSrLtTkw7CY9sJtz88QPBBojk7Zq98tasmx4g2rhtyl4XaDTPpStcNY";

export interface StudyPlan {
  id: "sprint" | "scholar" | "mastery";
  name: string;
  price: string; // e.g. "2.99"
  /** Display-only crossed-out reference price; PayPal charges `amount`. */
  compareAt: string;
  amount: number;
  requests: number;
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
    compareAt: "4.99",
    amount: 2.99,
    requests: 60,
    days: 60,
    desc: "~25–35 full mock exams or deep study sessions.",
  },
  {
    id: "scholar",
    name: "Scholar Pass",
    price: "6.99",
    compareAt: "11.99",
    amount: 6.99,
    requests: 200,
    days: 120,
    badge: "Popular",
    popular: true,
    desc: "~80–100 comprehensive exams with adaptive reasoning.",
  },
  {
    id: "mastery",
    name: "Mastery Pass",
    price: "14.99",
    compareAt: "24.99",
    amount: 14.99,
    requests: 500,
    days: 180,
    desc: "Full Opus 5 deep synthesis & intensive semester review.",
  },
];

export interface DecodedPass {
  requests: number;
  expiresAtMs: number;
}

/** Read the quota/expiry baked into a comtus-pass-v1 token (no signature check — display only). */
export function decodePassInfo(token: string): DecodedPass | null {
  const t = token.trim();
  if (!t.startsWith("comtus-pass-v1.")) return null;
  const rest = t.slice("comtus-pass-v1.".length);
  const dot = rest.lastIndexOf(".");
  if (dot <= 0) return null;
  try {
    const b64 = rest.slice(0, dot).replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64)) as { q?: unknown; e?: unknown };
    if (typeof payload.q !== "number" || typeof payload.e !== "number") return null;
    return { requests: payload.q, expiresAtMs: payload.e * 1000 };
  } catch {
    return null;
  }
}

/** Best-effort tier label for a decoded pass quota. */
export function planTierForRequests(requests: number): StudyPlan["id"] {
  if (requests >= 500) return "mastery";
  if (requests >= 200) return "scholar";
  return "sprint";
}
