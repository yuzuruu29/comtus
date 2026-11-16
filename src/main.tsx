import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App";
import { isTauri } from "./lib/desktop";
import { followLampLight } from "./ui/lampLight";
import "./index.css";
import "./styles/lamp.css";

const Router = isTauri() ? HashRouter : BrowserRouter;
followLampLight();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator && !isTauri()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
} else if ("serviceWorker" in navigator) {
  // A service worker left over from a prod build/preview on this origin
  // serves stale modules over dev HMR — evict it.
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
}
