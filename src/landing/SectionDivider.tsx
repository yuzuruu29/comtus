import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Igniting brass rule that draws in and blooms with ambient light as you scroll. */
export default function SectionDivider({ className = "" }: { className?: string }) {
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lineRef.current) return;
    const el = lineRef.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-ignited");
      return;
    }
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top 85%",
      onEnter: () => el.classList.add("is-ignited"),
      once: true,
    });
    return () => trigger.kill();
  }, []);

  return (
    <div className={`mx-auto w-full max-w-6xl px-6 ${className}`} aria-hidden>
      <div ref={lineRef} className="section-divider-beam" />
    </div>
  );
}
