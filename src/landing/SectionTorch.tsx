import { useState, useEffect, useRef } from "react";
import { torchManager } from "../lib/torchState";
import PixelTorch from "../components/PixelTorch";

interface SectionTorchProps {
  sectionId: string;
  className?: string;
}

export default function SectionTorch({ sectionId, className = "" }: SectionTorchProps) {
  const [isLit, setIsLit] = useState(() => torchManager.isLit(sectionId));
  const [isIgniting, setIsIgniting] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    torchManager.registerSection(sectionId);
    const unsubscribe = torchManager.subscribe(() => {
      const lit = torchManager.isLit(sectionId);
      setIsLit((prev) => {
        if (lit && !prev) {
          setIsIgniting(true);
          window.setTimeout(() => setIsIgniting(false), 900);
        }
        return lit;
      });
    });
    return () => {
      unsubscribe();
      torchManager.unregisterSection(sectionId);
    };
  }, [sectionId]);

  const handleIgnite = () => {
    if (!isLit) {
      setIsIgniting(true);
      torchManager.ignite(sectionId);
      window.setTimeout(() => setIsIgniting(false), 900);
    }
  };

  return (
    <div
      ref={elementRef}
      data-torch-sconce={sectionId}
      onClick={handleIgnite}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleIgnite();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={isLit ? `Section ${sectionId} torch is lit` : `Light section ${sectionId} torch`}
      title={isLit ? "Torch rekindled · Study light burning" : "Touch with your cursor torch to rekindle"}
      className={`group relative inline-flex shrink-0 items-center justify-center p-1 rounded-xl transition-all duration-500 cursor-pointer ${
        isLit
          ? "bg-brass/[0.1] border border-brass/40 shadow-[0_0_18px_rgba(227,176,75,0.25)]"
          : "bg-white/[0.02] border border-white/[0.08] hover:border-brass/40 hover:bg-brass/[0.04]"
      } ${className}`}
    >
      <PixelTorch
        size={26}
        isLit={isLit}
        isIgniting={isIgniting}
        variant="sconce"
      />

      {/* Subtle status tag on hover */}
      <span
        className={`absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] uppercase tracking-wider transition-all duration-300 pointer-events-none opacity-0 group-hover:opacity-100 ${
          isLit ? "text-brasspale" : "text-faded"
        }`}
      >
        {isLit ? "Rekindled" : "Rekindle"}
      </span>
    </div>
  );
}
