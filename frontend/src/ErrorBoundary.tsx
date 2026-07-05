import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Catches render errors so a component fault never white-screens the app. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("Praxis caught a render error:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="px-panel max-w-md p-6 text-center">
          <div className="px-eyebrow text-[var(--color-neg)]">something broke</div>
          <h1 className="px-display mt-2 text-xl text-[var(--color-fg)]">
            This view hit an error
          </h1>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            The rest of Praxis is fine — reload to recover.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--color-signal)] px-4 py-2 text-sm font-semibold text-[#05201b] transition hover:brightness-110"
          >
            Reload Praxis
          </button>
          <pre className="px-mono mt-4 max-h-32 overflow-auto rounded-lg border border-[var(--color-hair)] bg-[var(--color-ink-2)] p-2 text-left text-[10px] text-[var(--color-fg-faint)]">
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
        </div>
      </div>
    );
  }
}
