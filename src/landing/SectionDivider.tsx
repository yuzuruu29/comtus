import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

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
      start: "top 88%",
      onEnter: () => el.classList.add("is-ignited"),
      once: true,
    });
    return () => trigger.kill();
  }, []);

  return (
    <div className={`relative mx-auto w-full max-w-6xl px-6 py-6 ${className}`} aria-hidden>
      <div className="relative flex items-center justify-center">
        <div ref={lineRef} className="section-divider-beam w-full" />
        <div className="absolute flex items-center justify-center">
          <span className="h-2 w-2 rotate-45 border border-[#044AB3]/40 bg-white shadow-[0_0_8px_rgba(111,227,255,0.5)] transition-transform duration-500 hover:scale-150" />
        </div>
      </div>
    </div>
  );
}
