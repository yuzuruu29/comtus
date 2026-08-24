import { useEffect, useState } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Preloader from "./Preloader";
import CustomCursor from "../components/CustomCursor";
import TorchLayer from "./TorchLayer";
import Nav from "./Nav";
import Hero from "./Hero";
import Marquee from "./Marquee";
import ProductDemo from "./ProductDemo";
import LearningLoop from "./LearningLoop";
import UseCases from "./UseCases";
import WhyComtus from "./WhyComtus";
import OpenRouterByokSection from "./OpenRouterByokSection";
import StudioShowcase from "./StudioShowcase";
import BringStack from "./BringStack";
import Boards from "./Boards";
import DesktopApp from "./DesktopApp";
import AcademicIntegrity from "./AcademicIntegrity";
import TrustPrivacy from "./TrustPrivacy";
import FAQSection from "./FAQSection";
import Statement from "./Statement";
import FinalCTA from "./FinalCTA";
import Footer from "./Footer";
import OnboardingModal from "./OnboardingModal";

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const [ready, setReady] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  // Lenis smooth scroll, driven by GSAP's ticker.
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

  // While the preloader holds the page, keep the scroll locked.
  useEffect(() => {
    document.documentElement.style.overflow = ready ? "" : "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [ready]);

  return (
    <div className="relative">
      {!ready && <Preloader onDone={() => setReady(true)} />}
      <CustomCursor />
      <TorchLayer ready={ready} />
      <div className="grain" aria-hidden />
      <Nav ready={ready} onStartStudying={() => setOnboardingOpen(true)} />
      <main>
        <Hero ready={ready} onStartStudying={() => setOnboardingOpen(true)} />
        <Marquee />
        <ProductDemo />
        <LearningLoop />
        <UseCases />
        <WhyComtus />
        <OpenRouterByokSection />
        <StudioShowcase />
        <BringStack />
        <Boards />
        <DesktopApp />
        <AcademicIntegrity />
        <TrustPrivacy />
        <FAQSection />
        <Statement />
        <FinalCTA />
      </main>
      <Footer />
      <OnboardingModal isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </div>
  );
}
