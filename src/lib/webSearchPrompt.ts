import type { WebSearchMeta } from "./types";

/**
 * System-prompt clause. Small models ignore a polite "treat these as fresh
 * evidence" and fall back to "I cannot browse the web" — this has to be
 * explicit, and must not claim a successful fetch when none happened.
 */
export function webSearchGroundingClause(meta: WebSearchMeta): string {
  if (meta.status === "ok" && meta.count > 0) {
    return `Web Search Grounding: ACTIVE — ${meta.count} live page(s) attached as sources titled "Web: ...".
- You already performed this live web search yourself. The results below ARE fresh web data you retrieved just now for this question.
- Never claim you cannot access, browse, or search the web. Never say you lack internet access. Never refuse the retrieval and fall back to "here are strategies / tools you could use" when the pages are already attached.
- Treat Web sources as evidence you just retrieved. Answer from them, citing attached titles and URLs. Prefer them for current facts.
- Snippets are excerpts and may be truncated. Never claim the search came up empty when Web sources exist. Never invent URLs beyond those attached.`;
  }
  if (meta.status === "error") {
    return `Web Search Grounding: FAILED this turn (${meta.error || "search error"}).
- No live pages were attached. Do not invent search results or URLs.
- Do not claim you are generally unable to search the web; this turn's fetch failed. Answer from notebook sources and your knowledge, and mention briefly that live search did not return pages.`;
  }
  return `Web Search Grounding: RAN — no usable pages this turn.
- Do not pretend you retrieved live results. Say the search came up empty, then answer from notebook sources and your knowledge.
- Do not claim you are generally unable to search the web.`;
}

/**
 * Last-turn reminder. Weak models overweight the user message over the
 * system preamble, so the same fact has to sit next to the question.
 */
export function webSearchUserReminder(meta: WebSearchMeta): string {
  if (meta.status === "ok" && meta.count > 0) {
    return `\n\n[Internal: A live web search already ran for this question. ${meta.count} page(s) are attached as documents titled "Web: …". Use them as your retrieved results. Never say you cannot search the web.]`;
  }
  if (meta.status === "error") {
    return `\n\n[Internal: Web search was requested but failed (${meta.error || "error"}). No live pages are attached. Do not invent URLs. Answer from knowledge and notebook sources.]`;
  }
  return `\n\n[Internal: Web search ran but returned no results. Say so briefly, then answer from knowledge and notebook sources.]`;
}
