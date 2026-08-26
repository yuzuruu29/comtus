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
import { LandingPlayProvider, useLandingPlay } from "./LandingPlay";
import LandingEgg from "./LandingEgg";
import { applyLandingPixel } from "./pixelMotion";
import "./pixel-landing.css";

gsap.registerPlugin(ScrollTrigger);

function IgniteFlash() {
  const { pokeCount, lampLit } = useLandingPlay();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!lampLit) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShow(true);
    const id = window.setTimeout(() => setShow(false), 700);
    return () => window.clearTimeout(id);
  }, [pokeCount, lampLit]);

  if (!show) return null;
  return <div className="landing-ignite" aria-hidden />;
}

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
      <div className="relative">
        {!ready && <Preloader onDone={() => setReady(true)} />}
        <CustomCursor />
        <TorchLayer ready={ready} />
        <div className="grain" aria-hidden />
        <div className="landing-scan" aria-hidden />
        <IgniteFlash />
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
        <LandingEgg />
        <OnboardingModal isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
      </div>
    </LandingPlayProvider>
  );
}
