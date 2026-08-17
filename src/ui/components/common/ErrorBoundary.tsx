import { Component, ReactNode } from 'react';
import { logClientError } from '../../api/client';

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(error: Error, info: unknown) {
    logClientError('ui', error.message, { stack: error.stack, info: String(info) });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <div className="error-card">
            <div className="err-icon">😕</div>
            <h2 style={{ marginBottom: 8 }}>Algo salió mal</h2>
            <p className="muted" style={{ marginBottom: 18 }}>
              Ocurrió un error inesperado. Podés intentar de nuevo.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onReset?.();
              }}
            >
              🔄 Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}