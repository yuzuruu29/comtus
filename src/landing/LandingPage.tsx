import { useEffect, useState } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Preloader from "./Preloader";
import CustomCursor from "../components/CustomCursor";
import TorchLayer from "./TorchLayer";
import Nav from "./Nav";
import CantorShowcase from "./CantorShowcase";
import CognitiveTelemetryGrid from "./CognitiveTelemetryGrid";
import ScholarConsoleDeck from "./ScholarConsoleDeck";
import OpenRouterByokSection from "./OpenRouterByokSection";
import FAQSection from "./FAQSection";
import Statement from "./Statement";
import FinalCTA from "./FinalCTA";
import Footer from "./Footer";
import OnboardingModal from "./OnboardingModal";
import SectionDivider from "./SectionDivider";
import { LandingPlayProvider } from "./LandingPlay";
import { applyLandingPixel } from "./pixelMotion";
import "./pixel-landing.css";
import "./cantor-theme.css";

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const [ready, setReady] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    applyLandingPixel(true);
    return () => applyLandingPixel(false);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.1 });
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    lenis.on("scroll", ScrollTrigger.update);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = ready ? "" : "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [ready]);

  return (
    <LandingPlayProvider>
      <div className="relative min-h-screen bg-[#F5F3EF] text-[#0B132B]">
        {!ready && <Preloader onDone={() => setReady(true)} />}
        <CustomCursor />
        <TorchLayer ready={ready} />
        <div className="grain" aria-hidden />
        <Nav ready={ready} onStartStudying={() => setOnboardingOpen(true)} />

        <main>
          {/* Chapter 1: Cantor8 High-Precision Cognitive Infrastructure */}
          <section id="hero" aria-label="Comtus Cognitive Infrastructure Showcase">
            <CantorShowcase />
            <CognitiveTelemetryGrid />
            <ScholarConsoleDeck />
          </section>

          <SectionDivider />

          {/* Chapter 2: Free AI Models & BYOK Workbench */}
          <section id="byok-guide" aria-label="Free AI Models & BYOK Guide">
            <OpenRouterByokSection />
          </section>

          <SectionDivider />

          {/* Chapter 3: Frequently Asked Questions */}
          <section id="faq" aria-label="Frequently Asked Questions">
            <FAQSection />
          </section>

          <SectionDivider />

          {/* Chapter 4: Final Manifesto & Call to Action */}
          <section id="manifesto-cta" aria-label="Manifesto & Call to Action">
            <Statement />
            <FinalCTA />
          </section>
        </main>

        <Footer />

        <OnboardingModal isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
      </div>
    </LandingPlayProvider>
  );
}

