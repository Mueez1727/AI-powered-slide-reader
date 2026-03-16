import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * React Error Boundary — catches render-time errors and displays
 * a friendly fallback UI instead of a blank screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-[60vh] items-center justify-center px-4"
          role="alert"
          aria-live="assertive"
        >
          <div className="glass-card max-w-md w-full p-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/20">
              <AlertTriangle className="h-7 w-7 text-red-500" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Something went wrong
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.state.error && (
              <details className="text-left">
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  Error details
                </summary>
                <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-gray-100 dark:bg-gray-800 p-3 text-xs text-red-600 dark:text-red-400">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex justify-center gap-3 pt-2">
              <button onClick={this.handleReset} className="btn-secondary text-sm">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try Again
              </button>
              <button
                onClick={() => (window.location.href = '/dashboard')}
                className="btn-primary text-sm"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
