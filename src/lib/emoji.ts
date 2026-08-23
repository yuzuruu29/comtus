/** Context-aware cover emoji resolver for notebooks.
 * Matches keywords in the notebook title to evocative study glyphs,
 * or falls back to a deterministic themed emoji from a curated palette. */

const KEYWORD_MAP: Array<{ regex: RegExp; emoji: string }> = [
  { regex: /health|nurs|medic|doctor|pharma|bio|clinic|patient|care/i, emoji: "🩺" },
  { regex: /law|legal|court|justice|juris|contract|dispute/i, emoji: "⚖️" },
  { regex: /finance|wealth|bank|invest|money|tax|liquidity|fund|cpa|stock/i, emoji: "🏛️" },
  { regex: /code|software|tech|dev|ai|model|comput|program|web|android|ios/i, emoji: "💻" },
  { regex: /war|peace|history|latin|bolivar|empire|revolution|revolt/i, emoji: "🕊️" },
  { regex: /japan|centenarian|longevity|age|elder|ikigai/i, emoji: "👵" },
  { regex: /drone|aerial|aviation|flight|plane|heli|sky/i, emoji: "🚁" },
  { regex: /ocean|sea|wave|creek|water|fish|marine|territor/i, emoji: "🐟" },
  { regex: /gtd|getting things done|habit|focus|art of|stress|mind/i, emoji: "🌊" },
  { regex: /shield|security|cyber|protect|risk|defense|insur/i, emoji: "🛡️" },
  { regex: /psych|mental|brain|cognit|neuron|think/i, emoji: "🧠" },
  { regex: /physics|quantum|space|astro|chem|science|atom/i, emoji: "🔬" },
  { regex: /math|algebra|stat|calculus|geometry/i, emoji: "📐" },
  { regex: /art|design|draw|paint|visual|music/i, emoji: "🎨" },
  { regex: /book|read|novel|literature|poem|essay|phil/i, emoji: "📖" },
  { regex: /exam|board|let|pnle|ce|review|quiz|drill/i, emoji: "🎓" },
  { regex: /global|earth|geography|map|world|travel/i, emoji: "🌍" },
  { regex: /nature|farm|plant|garden|tree|flower|bio/i, emoji: "🌱" },
  { regex: /build|engineer|architect|city|civil/i, emoji: "🏗️" },
];

const FALLBACK_PALETTE = ["📚", "🕯️", "📝", "💡", "📑", "🏛️", "🧭", "📜", "🔍", "⚡"];

export function getNotebookCoverEmoji(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "🕯️";

  for (const item of KEYWORD_MAP) {
    if (item.regex.test(trimmed)) {
      return item.emoji;
    }
  }

  // Deterministic fallback based on name hash
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash << 5) - hash + trimmed.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[idx];
}
