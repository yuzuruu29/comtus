/**
 * PayPal Integration Configuration for Comtus Smarter Models Access
 */

export const PAYPAL_CLIENT_ID =
  (import.meta.env.VITE_PAYPAL_CLIENT_ID as string) ||
  "BAAynutt7UG_TKFyejl9ht8OGDrlSrLtTkw7CY9sJtz88QPBBojk7Zq98tasmx4g2rhtyl4XaDTPpStcNY";

export interface StudyPlan {
  id: "sprint" | "scholar" | "mastery";
  name: string;
  price: string; // e.g. "2.99"
  amount: number;
  tokens: string;
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
    tokens: "~500,000 Tokens",
    desc: "~25–35 full mock exams or deep study sessions.",
  },
  {
    id: "scholar",
    name: "Scholar Pass",
    price: "6.99",
    amount: 6.99,
    tokens: "~1,500,000 Tokens",
    badge: "Popular",
    popular: true,
    desc: "~80–100 comprehensive exams with adaptive reasoning.",
  },
  {
    id: "mastery",
    name: "Mastery Pass",
    price: "14.99",
    amount: 14.99,
    tokens: "~3,500,000 Tokens",
    desc: "Full Opus 5 deep synthesis & intensive semester review.",
  },
];
