import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-wide error boundary. Shows a readable "Something went wrong" card with a
 * Reload button instead of a blank page. It deliberately does NOT auto-retry, so
 * it can never re-enter a render loop (a known-bug lesson carried over).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Read the actual error: surface it to the console rather than swallowing it.
    console.error("ErrorBoundary caught an error:", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="error-card" role="alert">
          <div className="error-card__inner">
            <h1>Something went wrong</h1>
            <p>
              The castle builder hit an unexpected error and stopped to avoid
              losing your work. Reloading usually fixes it.
            </p>
            <pre className="error-card__detail">{this.state.error.message}</pre>
            <button type="button" onClick={this.handleReload}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
