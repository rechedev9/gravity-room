import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { captureException } from '@/lib/sentry';

interface FallbackProps {
  readonly error: Error;
  readonly reset: () => void;
}

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback: ReactNode | ((props: FallbackProps) => ReactNode);
  readonly onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    captureException(error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private readonly reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') {
        return fallback({ error: this.state.error, reset: this.reset });
      }
      return fallback;
    }

    return this.props.children;
  }
}
