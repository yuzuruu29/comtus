import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { detectPlatform, isDeskShell } from "./lib/desktop";
import { useThemeEffect } from "./lib/theme";
import { loadChunk } from "./lib/lazyChunk";
import { ErrorBoundary } from "./lib/ErrorBoundary";
import { MotionPrefs } from "./studio/fx";

const LandingPage = lazy(() => loadChunk(() => import("./landing/LandingPage")));
const StudioApp = lazy(() => loadChunk(() => import("./studio/StudioApp")));
const HostedCheckout = lazy(() => loadChunk(() => import("./checkout/HostedCheckout")));
const AboutPage = lazy(() => loadChunk(() => import("./landing/StaticPages")).then((m) => ({ default: m.AboutPage })));
const PrivacyPage = lazy(() => loadChunk(() => import("./landing/StaticPages")).then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => loadChunk(() => import("./landing/StaticPages")).then((m) => ({ default: m.TermsPage })));
const ResponsibleAIPage = lazy(() => loadChunk(() => import("./landing/StaticPages")).then((m) => ({ default: m.ResponsibleAIPage })));
const ContactPage = lazy(() => loadChunk(() => import("./landing/StaticPages")).then((m) => ({ default: m.ContactPage })));
const StudyCompanionPage = lazy(() => loadChunk(() => import("./landing/StaticPages")).then((m) => ({ default: m.StudyCompanionPage })));
const NotFoundPage = lazy(() => loadChunk(() => import("./landing/StaticPages")).then((m) => ({ default: m.NotFoundPage })));
const OpenRouterCallback = lazy(() => loadChunk(() => import("./auth/OpenRouterCallback")));
// Dev-only screenshot surface for the src/ui primitive kit — never routed to in production.
const KitPreview = import.meta.env.DEV
  ? lazy(() => loadChunk(() => import("./ui/__preview__/KitPreview")))
  : null;

export default function App() {
  const deskShell = isDeskShell();
  useThemeEffect();

  useEffect(() => {
    document.documentElement.dataset.platform = detectPlatform();
  }, []);

  return (
    <MotionPrefs>
      <Suspense
        fallback={
          <div className="flex min-h-[100svh] items-center justify-center bg-ground">
            <div className="h-8 w-8 animate-pulse rounded-[var(--radius-pill)] bg-brass/40" />
          </div>
        }
      >
        <ErrorBoundary>
          <Routes>
            <Route
              path="/"
              element={deskShell ? <Navigate to="/studio" replace /> : <LandingPage />}
            />
            <Route path="/studio" element={<StudioApp />} />
            {KitPreview && <Route path="/studio/kit" element={<KitPreview />} />}
            <Route path="/studio/:notebookId" element={<StudioApp />} />
            <Route
              path="/checkout"
              element={deskShell ? <Navigate to="/studio" replace /> : <HostedCheckout />}
            />
            <Route path="/auth/openrouter/callback" element={<OpenRouterCallback />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/responsible-ai" element={<ResponsibleAIPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/study-companion" element={<StudyCompanionPage />} />
            <Route
              path="*"
              element={deskShell ? <Navigate to="/studio" replace /> : <NotFoundPage />}
            />
          </Routes>
        </ErrorBoundary>
        {!deskShell && <Analytics />}
      </Suspense>
    </MotionPrefs>
  );
}
