import { useEffect, useState } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Preloader from "./Preloader";
import CustomCursor from "../components/CustomCursor";
import Nav from "./Nav";
import Hero from "./Hero";
import Marquee from "./Marquee";
import Method from "./Method";
import OpenRouterByokSection from "./OpenRouterByokSection";
import StudioShowcase from "./StudioShowcase";
import BringStack from "./BringStack";
import Boards from "./Boards";
import Statement from "./Statement";
import FinalCTA from "./FinalCTA";
import Footer from "./Footer";

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const [ready, setReady] = useState(false);

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
      <div className="grain" aria-hidden />
      <Nav ready={ready} />
      <main>
        <Hero ready={ready} />
        <Marquee />
        <Method />
        <OpenRouterByokSection />
        <StudioShowcase />
        <BringStack />
        <Boards />
        <Statement />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
