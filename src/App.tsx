import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { detectPlatform, isDeskShell } from "./lib/desktop";
import { useThemeEffect } from "./lib/theme";

const LandingPage = lazy(() => import("./landing/LandingPage"));
const StudioApp = lazy(() => import("./studio/StudioApp"));
const HostedCheckout = lazy(() => import("./checkout/HostedCheckout"));

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
      </Routes>
      {!deskShell && <Analytics />}
    </Suspense>
  );
}
