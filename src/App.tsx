import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { detectPlatform, isTauri } from "./lib/desktop";

const LandingPage = lazy(() => import("./landing/LandingPage"));
const StudioApp = lazy(() => import("./studio/StudioApp"));

export default function App() {
  const tauri = isTauri();

  useEffect(() => {
    document.documentElement.dataset.platform = detectPlatform();
  }, []);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100svh] items-center justify-center bg-night">
          <div className="h-8 w-8 animate-pulse rounded-full bg-brass/40" />
        </div>
      }
    >
      <Routes>
        <Route
          path="/"
          element={tauri ? <Navigate to="/studio" replace /> : <LandingPage />}
        />
        <Route path="/studio/:notebookId?" element={<StudioApp />} />
      </Routes>
      {!tauri && <Analytics />}
    </Suspense>
  );
}
