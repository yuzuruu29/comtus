import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Sparkles, Check, ArrowRight, Lightbulb, CheckCircle2, RefreshCw } from "lucide-react";
import SectionHead from "./SectionHead";
import { playProceduralSfx } from "../studio/companion/sfx";
import "./landing.css";

gsap.registerPlugin(ScrollTrigger);

interface DemoStep {
  id: string;
  label: string;
  title: string;
  icon: string;
}

const DEMO_STEPS: DemoStep[] = [
  { id: "input", label: "1. Student Note", title: "Rough Lecture Note", icon: "📝" },
  { id: "explain", label: "2. Explanation & Analogy", title: "Step-by-Step Logic", icon: "💡" },
  { id: "organize", label: "3. Study Guide", title: "Structured Knowledge", icon: "📑" },
  { id: "practice", label: "4. Practice Quiz", title: "Active Recall & Rationale", icon: "🎯" },
];

export default function ProductDemo() {
  const [activeStep, setActiveStep] = useState<string>("explain");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showRationale, setShowRationale] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>(".reveal-demo");
      if (reduced) {
        gsap.set(targets, { opacity: 1, y: 0 });
        return;
      }
      targets.forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 35 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          },
        );
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      id="demo"
      data-torch
      className="relative mx-auto w-full max-w-6xl px-6 py-[clamp(6rem,14vh,10rem)]"
    >
      <div className="reveal-demo">
        <SectionHead
          index="02"
          label="Product Demonstration"
          title={
            <>
              See Comtus in{" "}
              <em className="font-[420] text-lamp">action.</em>
            </>
          }
          sub="Watch how Comtus transforms unorganized lecture notes into understandable explanations, structured study guides, and high-yield practice drills."
        />
      </div>

      <div className="reveal-demo mt-12 overflow-hidden rounded-[2rem] border border-white/[0.09] bg-study/70 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        {/* Step Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-white/[0.07] bg-night/80 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rust/80" />
            <span className="h-2 w-2 rounded-full bg-brass/80" />
            <span className="h-2 w-2 rounded-full bg-sage/80" />
            <span className="ml-2 font-mono text-[11px] tracking-[0.18em] text-faded uppercase">
              STUDY WORKSPACE · BIO 101 — CELLULAR RESPIRATION
            </span>
          </div>

          {/* Step Pill Buttons */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:mt-0">
            {DEMO_STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setActiveStep(s.id);
                  if (s.id === "practice") {
                    setSelectedAnswer(null);
                    setShowRationale(false);
                  }
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] transition-all cursor-pointer ${
                  activeStep === s.id
                    ? "bg-brass text-night font-semibold shadow-[0_0_15px_rgba(227,176,75,0.3)]"
                    : "bg-white/[0.04] text-faded hover:bg-white/[0.08] hover:text-parchment"
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Demo Content Viewport */}
        <div className="p-6 sm:p-8">
          {/* Step 1: Raw Student Note */}
          {activeStep === "input" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-faded">
                  Uploaded Source · Lecture Notes (Page 4)
                </span>
                <span className="rounded-full border border-brass/30 bg-brass/10 px-2.5 py-0.5 font-mono text-[10px] text-brasspale">
                  Raw Input
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-night/90 p-5 font-mono text-[13px] leading-relaxed text-parchment/90">
                <p className="text-brasspale/90 font-semibold mb-2">&gt; Student Rough Note:</p>
                <p className="italic text-faded">
                  &ldquo;ETC in inner mitochondrial membrane. NADH and FADH2 drop electrons. Hydrogen ions pumped across membrane into intermembrane space creating electrochemical gradient. ATP synthase uses proton-motive force to make ATP like a turbine. Oxygen is the final electron acceptor forming H2O. Why does lack of O2 stop everything? Confused on complex I vs II.&rdquo;
                </p>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setActiveStep("explain")}
                  className="inline-flex items-center gap-2 rounded-full grad-lamp px-5 py-2 text-[12.5px] font-semibold text-night"
                >
                  <span>See How Comtus Explains It</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Explanation & Analogy */}
          {activeStep === "explain" && (
            <div className="space-y-5">
              {/* Thinking Panel */}
              <div className="rounded-xl border border-moon/20 bg-moon/[0.06] p-4 text-[12.5px]">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-moon">
                  <Sparkles size={12} />
                  <span>Thinking Pass · Socratic Formulation</span>
                </div>
                <p className="mt-2 text-faded">
                  Student understands the main players but struggles with the dependency cascade (why stopping oxygen halts ATP synthesis) and complex distinctions. Let's provide an intuitive hydroelectric dam analogy before breaking down the exact biochemistry.
                </p>
              </div>

              {/* Response Card */}
              <div className="rounded-xl border border-white/10 bg-night/80 p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Lightbulb size={17} className="text-brass" />
                  <h4 className="font-display text-[1.25rem] font-[450] text-parchment">
                    The Hydroelectric Dam Analogy
                  </h4>
                </div>
                <p className="text-[14px] leading-relaxed text-faded">
                  Think of the inner mitochondrial membrane like a massive <strong>hydroelectric dam</strong>:
                </p>
                <ul className="space-y-2 text-[13.5px] text-parchment/85">
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-brass font-bold">1. Pumps (Complexes I, III, IV):</span>
                    <span>Electrons from your food power molecular pumps that push hydrogen ions ($H^+$) upstream into a reservoir (the intermembrane space).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-brass font-bold">2. The Turbine (ATP Synthase):</span>
                    <span>The crowded $H^+$ ions rush back through a spinning generator turbine. Each rotation cranks out ATP from ADP.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-brass font-bold">3. The Drain Plug (Oxygen):</span>
                    <span>Oxygen sits at the end of the line catching used electrons and forming water. If oxygen disappears, the electron queue backs up, the pumps stall, the gradient collapses, and turbine rotation stops instantly.</span>
                  </li>
                </ul>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setActiveStep("input")}
                  className="font-mono text-[11.5px] text-faded hover:text-parchment"
                >
                  ← Back to Note
                </button>
                <button
                  onClick={() => setActiveStep("organize")}
                  className="inline-flex items-center gap-2 rounded-full grad-lamp px-5 py-2 text-[12.5px] font-semibold text-night"
                >
                  <span>View Structured Study Guide</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Structured Study Guide */}
          {activeStep === "organize" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-moon">
                  Organized Output · Summary & Comparison
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-mono text-[10px] text-faded">
                  Source: Notes §4.2
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-night/80 p-5">
                  <h5 className="font-display text-[1.1rem] font-[450] text-brasspale">
                    Complex I (NADH Dehydrogenase)
                  </h5>
                  <ul className="mt-3 space-y-1.5 text-[12.5px] text-faded">
                    <li>• Accepts electrons from <strong className="text-parchment">NADH</strong></li>
                    <li>• Pumps <strong className="text-brass">4 protons ($4H^+$)</strong> across membrane</li>
                    <li>• Higher energy yield (~2.5 ATP per NADH)</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-white/10 bg-night/80 p-5">
                  <h5 className="font-display text-[1.1rem] font-[450] text-moon">
                    Complex II (Succinate Dehydrogenase)
                  </h5>
                  <ul className="mt-3 space-y-1.5 text-[12.5px] text-faded">
                    <li>• Accepts electrons from <strong className="text-parchment">FADH2</strong></li>
                    <li>• <strong className="text-rust">Does NOT pump protons</strong> across membrane</li>
                    <li>• Lower energy yield (~1.5 ATP per FADH2)</li>
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-[13px] text-faded">
                <strong className="text-parchment font-medium">Exam Rule of Thumb:</strong> Complex II feeds electrons directly into Coenzyme Q without crossing the energy threshold required to pump protons.
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setActiveStep("explain")}
                  className="font-mono text-[11.5px] text-faded hover:text-parchment"
                >
                  ← Back to Explanation
                </button>
                <button
                  onClick={() => {
                    setActiveStep("practice");
                    setSelectedAnswer(null);
                    setShowRationale(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-full grad-lamp px-5 py-2 text-[12.5px] font-semibold text-night"
                >
                  <span>Practice Active Recall Quiz</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Active Recall Practice Quiz */}
          {activeStep === "practice" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sage/20 font-mono text-[10px] text-sage font-bold">
                    Q1
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-faded">
                    Knowledge Check · 1 of 3
                  </span>
                </div>
                <span className="font-mono text-[10px] text-brasspale">Grounded in Lecture Notes §4</span>
              </div>

              <div className="rounded-xl border border-white/10 bg-night/90 p-5 sm:p-6">
                <h4 className="text-[15px] font-medium text-parchment leading-snug">
                  Why does cellular ATP production drastically decrease in the complete absence of molecular oxygen?
                </h4>

                <div className="mt-4 space-y-2.5">
                  {[
                    "Glucose cannot enter the glycolysis pathway without oxygen.",
                    "Electrons back up in the transport chain, preventing proton gradient maintenance.",
                    "ATP synthase denatures when oxygen levels drop below 10%.",
                    "Pyruvate is converted directly into carbon dioxide without acetyl-CoA.",
                  ].map((option, idx) => {
                    const isSelected = selectedAnswer === idx;
                    const isCorrect = idx === 1;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedAnswer(idx);
                          setShowRationale(true);
                          if (isCorrect) {
                            playProceduralSfx("correct");
                          } else {
                            playProceduralSfx("wrong");
                          }
                        }}
                        className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-[13px] transition-all cursor-pointer ${
                          isSelected
                            ? isCorrect
                              ? "border-sage/50 bg-sage/10 text-parchment shadow-[0_0_15px_rgba(79,138,90,0.2)]"
                              : "border-rust/50 bg-rust/10 text-parchment"
                            : "border-white/[0.08] bg-white/[0.02] text-faded hover:border-white/20 hover:text-parchment"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold ${
                            isSelected
                              ? isCorrect
                                ? "bg-sage text-night"
                                : "bg-rust text-white"
                              : "border border-white/20 text-faded"
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="flex-1">{option}</span>
                        {isSelected && isCorrect && <CheckCircle2 size={16} className="text-sage shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Instant Rationale Box */}
                {showRationale && (
                  <div className="mt-5 rounded-xl border border-sage/30 bg-sage/[0.07] p-4 text-[13px] leading-relaxed text-parchment/90 animate-fadeIn">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-sage mb-1.5">
                      <Check size={13} /> Correct Answer: Option B · Rationale
                    </div>
                    <p className="text-faded">
                      Oxygen is the terminal electron acceptor. Without it, Complex IV cannot offload electrons, which stalls the entire chain. Consequently, proton pumping halts, the electrochemical gradient dissipates, and ATP synthase loses its driving force.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setActiveStep("organize")}
                  className="font-mono text-[11.5px] text-faded hover:text-parchment"
                >
                  ← Back to Study Guide
                </button>
                <button
                  onClick={() => {
                    setSelectedAnswer(null);
                    setShowRationale(false);
                  }}
                  className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-brasspale hover:underline"
                >
                  <RefreshCw size={12} /> Reset Question
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
