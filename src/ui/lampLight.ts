/** Lamplight hover: points each lit control's glow at the pointer.
 *
 *  src/styles/lamp.css draws the glow at --mx/--my. This writes them on the
 *  control under the pointer and on any lit card around it, once per frame.
 *  Touch and pen-less devices without hover never get the listener. */
const LIT = "button, a, summary, [role='button'], [role='option'], [role='menuitem'], .card-wake, .card-paper-curl, .card-book-press";

export function followLampLight() {
  if (typeof window === "undefined" || !window.matchMedia?.("(hover: hover)").matches) return;
  let last: PointerEvent | null = null;
  let frame = 0;
  const paint = () => {
    frame = 0;
    if (!last) return;
    const { clientX, clientY, target } = last;
    let el = target instanceof Element ? target.closest<HTMLElement>(LIT) : null;
    while (el) {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${clientX - r.left}px`);
      el.style.setProperty("--my", `${clientY - r.top}px`);
      el = el.parentElement?.closest<HTMLElement>(LIT) ?? null;
    }
  };
  document.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      last = e;
      if (!frame) frame = requestAnimationFrame(paint);
    },
    { passive: true },
  );
}
