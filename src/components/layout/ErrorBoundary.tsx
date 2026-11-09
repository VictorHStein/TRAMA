import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/**
 * Catches render-time exceptions and shows the error visibly so we never
 * end up staring at a blank page in development.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('Render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 24,
          color: '#e6edf7',
          background: '#1a0a0a',
          minHeight: '100vh',
          fontFamily: 'monospace',
          overflow: 'auto',
        }}>
          <h1 style={{ color: '#f87171', marginBottom: 16 }}>Erro na renderização</h1>
          <pre style={{ background: '#0a0202', padding: 16, borderRadius: 6, color: '#fda4af', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {this.state.error.message}
          </pre>
          <pre style={{ marginTop: 12, background: '#0a0202', padding: 16, borderRadius: 6, color: '#fb923c', fontSize: 11, whiteSpace: 'pre-wrap' }}>
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
