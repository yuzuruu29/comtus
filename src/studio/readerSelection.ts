/**
 * Maps DOM selections in the source reader back to character offsets in
 * the source. The reader renders every piece of text as a run element with
 * a `data-at` offset and exactly one text node inside, so a point inside a
 * run is `data-at` plus the offset in that node. Element-level points (a
 * triple-click often ends on the next paragraph at offset 0) resolve to
 * the nearest run boundary.
 */

const RUN = "[data-at]";

function runStart(el: Element): number {
  return Number((el as HTMLElement).dataset.at);
}

function runEnd(el: Element): number {
  return runStart(el) + (el.textContent?.length ?? 0);
}

function firstRunFrom(node: Node): Element | null {
  if (!(node instanceof Element)) return null;
  return node.matches(RUN) ? node : node.querySelector(RUN);
}

/** The source offset of a DOM point, or null outside the text. */
export function pointOffset(node: Node, offset: number): number | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const run = node.parentElement?.closest(RUN);
    if (!run) return null;
    return runStart(run) + Math.min(offset, node.textContent?.length ?? 0);
  }
  if (!(node instanceof Element)) return null;
  const inside = node.closest(RUN);
  if (inside) return offset === 0 ? runStart(inside) : runEnd(inside);
  const children = node.childNodes;
  for (let i = offset; i < children.length; i++) {
    const run = firstRunFrom(children[i]);
    if (run) return runStart(run);
  }
  for (let i = Math.min(offset, children.length) - 1; i >= 0; i--) {
    const child = children[i];
    if (!(child instanceof Element)) continue;
    const runs = child.matches(RUN) ? [child] : child.querySelectorAll(RUN);
    if (runs.length) return runEnd(runs[runs.length - 1]);
  }
  return null;
}

export interface SelectedRange {
  start: number;
  end: number;
  rect: DOMRect;
}

/** The current selection as a source range, when it lies in `root`. */
export function selectedRange(root: HTMLElement): SelectedRange | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = pointOffset(range.startContainer, range.startOffset);
  const end = pointOffset(range.endContainer, range.endOffset);
  if (start === null || end === null || end <= start) return null;
  return { start, end, rect: range.getBoundingClientRect() };
}

/** Where a popover sits inside a scrolling container: above the anchor,
 *  or below when there's no room above (or on touch screens, where the
 *  system's own selection menu takes the space above). */
export function popoverPosition(
  anchor: DOMRect,
  container: HTMLElement,
  size: { width: number; height: number },
  preferBelow = false,
): { top: number; left: number } {
  const box = container.getBoundingClientRect();
  const gap = 8;
  const above = anchor.top - box.top + container.scrollTop - size.height - gap;
  const below = anchor.bottom - box.top + container.scrollTop + gap;
  const top = preferBelow || above < container.scrollTop + 4 ? below : above;
  const center = anchor.left + anchor.width / 2 - box.left;
  const maxLeft = Math.max(4, container.clientWidth - size.width - 4);
  const left = Math.min(maxLeft, Math.max(4, center - size.width / 2));
  return { top, left };
}
