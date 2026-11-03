import { Component, type ReactNode } from "react";

/** Last-resort boundary for lazy-route chunk failures (a deploy landing
 *  mid-session). loadChunk() normally self-heals with one reload; this keeps
 *  a repeat failure from white-screening the entire tree. */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    const body = JSON.stringify({
      message: error.message.slice(0, 500),
      stack: (error.stack ?? "").slice(0, 2000),
    });
    const origin = ((import.meta.env.VITE_API_ORIGIN as string) || "").replace(/\/+$/, "");
    void fetch(`${origin}/api/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }).catch(() => undefined);
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          role="alert"
          className="flex min-h-[100svh] flex-col items-center justify-center gap-4 bg-ground px-6 text-center"
        >
          <p className="max-w-sm text-body leading-relaxed text-muted">
            Comtus encountered a brief sync issue loading this view, likely because
            the app updated while it was open.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-[var(--radius-control)] border border-brass/40 px-4 py-2 text-small text-brass hover:border-brass/70"
          >
            Reload Comtus
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
