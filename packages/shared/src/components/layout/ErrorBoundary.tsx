import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State { error: Error | null }

/**
 * Last line of defence for both apps. Without it, any error thrown while rendering unmounts the
 * whole React tree and the Android app shows a blank white WebView. With it, the user sees a
 * short message and can reload or go home.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; homePath?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Kept in the console (visible in logcat / devtools); swap for a backend log call if needed.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const home = this.props.homePath ?? '/';
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <div className="text-4xl">⚠️</div>
        <h1 className="text-lg font-bold text-foreground">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This screen hit an unexpected error. Your data is safe. Please reload, or go back to the home screen.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.location.reload()}
            className="h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">Reload</button>
          <button type="button" onClick={() => { window.location.href = home; }}
            className="h-11 rounded-xl border border-border px-5 text-sm font-semibold">Go home</button>
        </div>
      </div>
    );
  }
}
