/**
 * Markdown helpers for an answer that is still arriving.
 *
 * The answer is revealed a few characters at a time, so the visible text
 * regularly ends inside a construct: `**bo`, a half-written `$\frac{`, a
 * table header with no divider row yet. Rendered as-is those flash raw
 * syntax. closeStreamingMarkdown repairs only the unfinished tail; the
 * committed answer always renders exactly what the model wrote.
 */

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

export function closeStreamingMarkdown(text: string): string {
  const fence = openFence(text);
  if (fence) return `${text}${text.endsWith("\n") ? "" : "\n"}${fence}`;

  let out = text;
  if (count(out, "$$") % 2 === 1) out = out.slice(0, out.lastIndexOf("$$")).trimEnd();

  const blockStart = lastBlockStart(out);
  const head = out.slice(0, blockStart);
  let tail = dropUnfinishedTable(out.slice(blockStart));

  tail = closeInlineCode(tail);
  const mask = maskCodeSpans(tail);
  const mathOpen = openInlineMath(mask);
  if (mathOpen !== -1) tail = tail.slice(0, mathOpen).trimEnd();

  tail = tail.replace(/!\[[^\]\n]*\]\([^)\s]*$/, "").replace(/\[([^\]\n]*)\]\([^)\s]*$/, "$1");
  tail = closeEmphasis(tail);
  return head + tail;
}

function count(text: string, token: string): number {
  return text.split(token).length - 1;
}

/** Where the unfinished block begins: after the last blank line or code
 *  fence, so a finished paragraph or code block is never touched. The final
 *  line is still being written, so it never counts as blank. */
function lastBlockStart(text: string): number {
  const lines = text.split("\n");
  let start = 0;
  let offset = 0;
  for (const line of lines.slice(0, -1)) {
    offset += line.length + 1;
    if (line.trim() === "" || FENCE.test(line)) start = offset;
  }
  return start;
}

/** The closing fence for a code block the text is still inside, if any. */
function openFence(text: string): string | null {
  let open: string | null = null;
  for (const line of text.split("\n")) {
    const marker = FENCE.exec(line)?.[1];
    if (!marker) continue;
    if (!open) open = marker;
    else if (marker[0] === open[0] && marker.length >= open.length) open = null;
  }
  return open;
}

/** A GFM table only renders once its divider row is complete; until then
 *  the header line would show as raw pipes. */
function dropUnfinishedTable(block: string): string {
  const lines = block.split("\n");
  let start = lines.length;
  while (start > 0 && lines[start - 1].trimStart().startsWith("|")) start -= 1;
  if (start === lines.length) return block;

  const [header, divider] = lines.slice(start);
  const complete =
    divider !== undefined &&
    /^[\s|:-]+$/.test(divider) &&
    divider.includes("-") &&
    divider.trimEnd().endsWith("|") === header.trimEnd().endsWith("|") &&
    cells(divider) === cells(header);
  return complete ? block : lines.slice(0, start).join("\n").trimEnd();
}

function cells(row: string): number {
  return row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").length;
}

function closeInlineCode(block: string): string {
  if (count(block, "`") % 2 === 0) return block;
  return block.endsWith("`") ? block.slice(0, -1) : `${block}\``;
}

/** Same length as the input, with inline code blanked out so markers inside
 *  code are never mistaken for formatting. */
function maskCodeSpans(block: string): string {
  return block.replace(/`[^`]*`/g, (span) => " ".repeat(span.length));
}

/** Index of an unclosed single-dollar math opener, or -1. A `$` before a
 *  digit is read as currency, not math, so prices never hide text. */
function openInlineMath(mask: string): number {
  let open = -1;
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] !== "$" || mask[i - 1] === "\\") continue;
    if (mask[i + 1] === "$" || mask[i - 1] === "$") continue;
    if (open !== -1) open = -1;
    else if (mask[i + 1] && !/[\s\d]/.test(mask[i + 1])) open = i;
  }
  return open;
}

type Marker = { token: string; at: number };

function closeEmphasis(block: string): string {
  const mask = maskCodeSpans(block);
  const stack: Marker[] = [];
  for (let i = 0; i < mask.length; i += 1) {
    const token = markerAt(mask, i);
    if (!token) continue;
    const depth = stack.map((m) => m.token).lastIndexOf(token);
    if (depth !== -1) stack.length = depth;
    else stack.push({ token, at: i });
    i += token.length - 1;
  }

  let out = block;
  for (const { token, at } of stack.reverse()) {
    if (out.slice(at + token.length).trim() === "") out = out.slice(0, at).trimEnd();
    else out = `${out.trimEnd()}${token}`;
  }
  return out;
}

/** `**`, `~~` or an emphasis `*`. A `*` that opens a list item or stands
 *  between spaces (3 * 4) is not formatting. */
function markerAt(mask: string, i: number): string | null {
  if (mask.startsWith("**", i)) return "**";
  if (mask.startsWith("~~", i)) return "~~";
  if (mask[i] !== "*") return null;
  const before = mask[i - 1];
  const after = mask[i + 1];
  const lineStart = mask.slice(mask.lastIndexOf("\n", i - 1) + 1, i).trim() === "";
  if (lineStart && (after === " " || after === undefined)) return null;
  if ((before === undefined || /\s/.test(before)) && (after === undefined || /\s/.test(after))) return null;
  return "*";
}

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: unknown; ariaHidden?: string };
  children?: HastNode[];
};

/** Rehype plugin: puts the typing cursor right after the last word of the
 *  answer, inside whatever paragraph, list item or table cell holds it. */
export function rehypeStreamCursor() {
  return (tree: HastNode) => {
    const cursor: HastNode = {
      type: "element",
      tagName: "span",
      properties: { className: ["stream-typing-beacon"], ariaHidden: "true" },
      children: [],
    };
    const spot = lastContent(tree);
    if (spot) spot.parent.children!.splice(spot.index + 1, 0, cursor);
    else (tree.children ??= []).push(cursor);
  };
}

const CITE_RE = /\[(\d{1,2})\]/g;
const SKIP_CITE_TAGS = new Set(["code", "pre", "sup", "script", "style"]);

/** Rehype plugin: sets each `[n]` as a footnote mark. The mark hugs the word
 *  it cites (the space a model writes before it would strand the mark, and
 *  the full stop after it, on their own), and marks written side by side
 *  share one superscript, "1,2". The brackets stay in the text for copying
 *  and for screen readers; CSS hides them from sight. */
export function rehypeCitationMarks() {
  return (tree: HastNode) => {
    markCitations(tree);
  };
}

const bracket = (value: string): HastNode => ({
  type: "element",
  tagName: "span",
  properties: { className: ["cite-bracket"] },
  children: [{ type: "text", value }],
});

const markParts = (n: string): HastNode[] => [bracket("["), { type: "text", value: n }, bracket("]")];

function markCitations(node: HastNode): void {
  const kids = node.children;
  if (!kids) return;
  for (let i = 0; i < kids.length; i += 1) {
    const child = kids[i];
    if (child.type === "element") {
      if (SKIP_CITE_TAGS.has(child.tagName ?? "") || isMath(child)) continue;
      markCitations(child);
      continue;
    }
    if (child.type !== "text" || !child.value || !child.value.includes("[")) continue;
    CITE_RE.lastIndex = 0;
    if (!CITE_RE.test(child.value)) continue;
    CITE_RE.lastIndex = 0;
    const parts: HastNode[] = [];
    let last = 0;
    for (const match of child.value.matchAll(CITE_RE)) {
      const idx = match.index ?? 0;
      const before = child.value.slice(last, idx).trimEnd();
      const prev = parts[parts.length - 1];
      if (!before && prev?.tagName === "sup") {
        prev.children!.push({ type: "text", value: "," }, ...markParts(match[1]));
      } else {
        if (before) parts.push({ type: "text", value: before });
        parts.push({
          type: "element",
          tagName: "sup",
          properties: { className: ["cite-mark"] },
          children: markParts(match[1]),
        });
      }
      last = idx + match[0].length;
    }
    if (last < child.value.length) {
      parts.push({ type: "text", value: child.value.slice(last) });
    }
    kids.splice(i, 1, ...parts);
    i += parts.length - 1;
  }
}

function isMath(node: HastNode): boolean {
  const names = node.properties?.className;
  return Array.isArray(names) && names.some((n) => n === "katex" || n === "katex-display");
}

function lastContent(parent: HastNode): { parent: HastNode; index: number } | null {
  const kids = parent.children ?? [];
  for (let i = kids.length - 1; i >= 0; i -= 1) {
    const node = kids[i];
    if (node.type === "text" && node.value?.trim()) return { parent, index: i };
    if (node.type !== "element") continue;
    if (isMath(node)) return { parent, index: i };
    const inner = lastContent(node);
    if (inner) return inner;
  }
  return null;
}
