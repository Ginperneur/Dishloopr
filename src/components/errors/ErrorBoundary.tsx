import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // Fire-and-forget crash report (non-blocking)
    try {
      supabase
        .from('error_logs')
        .insert({
          message: error.message?.slice(0, 2000) || 'Unknown error',
          stack: error.stack?.slice(0, 8000) || null,
          component_stack: errorInfo.componentStack?.slice(0, 8000) || null,
          route: typeof window !== 'undefined' ? window.location.pathname + window.location.search : null,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          app_version: (import.meta.env.VITE_APP_VERSION as string | undefined) || null,
        })
        .then(({ error: logErr }) => {
          if (logErr) console.warn('Failed to log error:', logErr.message);
        });
    } catch (e) {
      // never let logging break the boundary
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Er ging iets mis</h2>
            <p className="text-muted-foreground mb-6">
              Er is een onverwachte fout opgetreden. Probeer de pagina te vernieuwen.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleRetry} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Opnieuw proberen
              </Button>
              <Button onClick={() => window.location.href = '/'}>
                Naar home
              </Button>
            </div>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-6 p-4 bg-muted rounded-lg text-left text-xs overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
