/** Smooth-scroll to an in-page anchor, deferring to Lenis when active. */
export function scrollToSection(hash: string) {
  const el = document.querySelector(hash);
  if (!el) return;
  const lenis = (window as unknown as { __lenis?: { scrollTo: (t: Element, o?: object) => void } })
    .__lenis;
  if (lenis) {
    lenis.scrollTo(el, { offset: -90, duration: 1.4 });
  } else {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
