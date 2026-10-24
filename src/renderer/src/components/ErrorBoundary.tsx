import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logError } from '../api/client';
import { zh } from '../i18n/zh';

interface State {
  error: Error | null;
}

/** Catches render errors so a bug in one screen shows a friendly message instead of a blank window. */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logError(
      `render error${info.componentStack ? ` at${info.componentStack.split('\n').slice(0, 4).join(' ')}` : ''}`,
      error,
    );
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-screen" role="alert">
        <h1>😵 {zh.errors.title}</h1>
        <p>{zh.errors.body}</p>
        <div className="row">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset?.();
            }}
          >
            {zh.common.backToToday}
          </button>
          <button type="button" className="btn btn-secondary btn-lg" onClick={() => window.location.reload()}>
            {zh.errors.reload}
          </button>
        </div>
      </div>
    );
  }
}
