import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

const LandingPage = lazy(() => import("./landing/LandingPage"));
const StudioApp = lazy(() => import("./studio/StudioApp"));

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100svh] items-center justify-center bg-night">
          <div className="h-8 w-8 animate-pulse rounded-full bg-brass/40" />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<LandingPage />} />
        {/* One route for both shelf and workspace: navigating between them
            re-renders the same mounted StudioApp instead of unmounting the
            lazy element — and a rapid browser-back right after opening a
            notebook no longer races a route-element swap. */}
        <Route path="/studio/:notebookId?" element={<StudioApp />} />
      </Routes>
    </Suspense>
  );
}
