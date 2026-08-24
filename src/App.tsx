import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { detectPlatform, isDeskShell } from "./lib/desktop";
import { useThemeEffect } from "./lib/theme";

const LandingPage = lazy(() => import("./landing/LandingPage"));
const StudioApp = lazy(() => import("./studio/StudioApp"));
const HostedCheckout = lazy(() => import("./checkout/HostedCheckout"));
const AboutPage = lazy(() => import("./landing/StaticPages").then((m) => ({ default: m.AboutPage })));
const PrivacyPage = lazy(() => import("./landing/StaticPages").then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import("./landing/StaticPages").then((m) => ({ default: m.TermsPage })));
const ResponsibleAIPage = lazy(() => import("./landing/StaticPages").then((m) => ({ default: m.ResponsibleAIPage })));
const ContactPage = lazy(() => import("./landing/StaticPages").then((m) => ({ default: m.ContactPage })));
const StudyCompanionPage = lazy(() => import("./landing/StaticPages").then((m) => ({ default: m.StudyCompanionPage })));

export default function App() {
  const deskShell = isDeskShell();
  useThemeEffect();

  useEffect(() => {
    document.documentElement.dataset.platform = detectPlatform();
  }, []);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100svh] items-center justify-center bg-ground">
          <div className="h-8 w-8 animate-pulse rounded-full bg-brass/40" />
        </div>
      }
    >
      <Routes>
        <Route
          path="/"
          element={deskShell ? <Navigate to="/studio" replace /> : <LandingPage />}
        />
        <Route path="/studio/:notebookId?" element={<StudioApp />} />
        <Route
          path="/checkout"
          element={deskShell ? <Navigate to="/studio" replace /> : <HostedCheckout />}
        />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/responsible-ai" element={<ResponsibleAIPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/study-companion" element={<StudyCompanionPage />} />
      </Routes>
      {!deskShell && <Analytics />}
    </Suspense>
  );
}
