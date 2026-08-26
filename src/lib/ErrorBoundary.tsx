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

  render() {
    if (this.state.failed) {
      return (
        <div
          role="alert"
          className="flex min-h-[100svh] flex-col items-center justify-center gap-4 bg-ground px-6 text-center"
        >
          <p className="max-w-sm text-body leading-relaxed text-muted">
            The lamp flickered — this page couldn't load, likely because the
            app just updated while it was open.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-[var(--radius-control)] border border-brass/40 px-4 py-2 text-[12px] text-brasspale hover:border-brass/70"
          >
            Reload Comtus
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
