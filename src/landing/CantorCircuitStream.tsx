import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function CantorCircuitStream() {
  const pulseMainRef = useRef<SVGPathElement>(null);
  const pulseSubRef = useRef<SVGPathElement>(null);
  const spark1Ref = useRef<SVGCircleElement>(null);
  const spark2Ref = useRef<SVGCircleElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      const pulseMain = pulseMainRef.current;
      const pulseSub = pulseSubRef.current;
      const spark1 = spark1Ref.current;
      const spark2 = spark2Ref.current;
      if (!pulseMain || !pulseSub) return;

      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top bottom",
        end: "bottom top",
        scrub: 0.8,
        onUpdate: (self) => {
          const progress = self.progress;
          const offsetMain = 1000 - progress * 1000;
          const offsetSub = 1040 - progress * 980;

          pulseMain.style.strokeDashoffset = String(offsetMain);
          pulseSub.style.strokeDashoffset = String(offsetSub);

          // Position traveling photon sparks along main path
          try {
            const length = pulseMain.getTotalLength ? pulseMain.getTotalLength() : 1000;
            const pt1 = pulseMain.getPointAtLength(progress * length);
            if (spark1 && pt1) {
              spark1.setAttribute("cx", String(pt1.x));
              spark1.setAttribute("cy", String(pt1.y));
            }
            if (spark2 && pulseSub.getTotalLength) {
              const pt2 = pulseSub.getPointAtLength(((progress + 0.15) % 1) * pulseSub.getTotalLength());
              if (pt2) {
                spark2.setAttribute("cx", String(pt2.x));
                spark2.setAttribute("cy", String(pt2.y));
              }
            }
          } catch {
            // fallback
          }
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="c8-circuit-wrap" style={{ height: "460px" }} aria-hidden="true">
      <svg className="c8-circuit-svg" viewBox="0 0 1440 460" fill="none" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="c8GradPulse" x1="0" y1="0" x2="1440" y2="460" gradientUnits="userSpaceOnUse">
            <stop stopColor="#044AB3" stopOpacity="0.2" />
            <stop offset="0.5" stopColor="#6FE3FF" />
            <stop offset="1" stopColor="#044AB3" stopOpacity="0.9" />
          </linearGradient>
          <filter id="c8Glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Base Orthogonal Hairline Tracks */}
        <path
          d="M 40 30 H 320 V 170 H 720 V 290 H 1120 V 400 H 1400"
          className="c8-circuit-path-base"
        />
        <path
          d="M 80 50 H 360 V 190 H 760 V 310 H 1160 V 420 H 1420"
          className="c8-circuit-path-base"
          strokeOpacity="0.08"
        />

        {/* Junction Nodes */}
        {[
          [320, 170], [720, 290], [1120, 400],
          [360, 190], [760, 310], [1160, 420]
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="4" fill="#044AB3" fillOpacity="0.3" />
            <circle cx={x} cy={y} r="2" fill="#6FE3FF" />
          </g>
        ))}

        {/* Scroll-Driven Traveling Laser Pulses */}
        <path
          ref={pulseSubRef}
          d="M 80 50 H 360 V 190 H 760 V 310 H 1160 V 420 H 1420"
          className="c8-circuit-path-pulse"
          stroke="url(#c8GradPulse)"
          strokeWidth="2.5"
          pathLength={1000}
        />
        <path
          ref={pulseMainRef}
          d="M 40 30 H 320 V 170 H 720 V 290 H 1120 V 400 H 1400"
          className="c8-circuit-path-pulse"
          stroke="#044AB3"
          strokeWidth="3.5"
          pathLength={1000}
        />

        {/* Dynamic Flying Spark Photons */}
        <circle ref={spark1Ref} cx="40" cy="30" r="5" fill="#6FE3FF" filter="url(#c8Glow)" />
        <circle ref={spark2Ref} cx="80" cy="50" r="4" fill="#FFFFFF" filter="url(#c8Glow)" />
      </svg>
    </div>
  );
}
