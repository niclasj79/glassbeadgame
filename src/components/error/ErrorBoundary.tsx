import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'component' | 'section' | 'page' | 'app';
  enableRecovery?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error caught by ${this.props.level || 'unknown'} ErrorBoundary:`, error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(error, errorInfo);
    }
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // In a real app, this would send to an error tracking service
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      level: this.props.level,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.log('Error logged:', errorData);
  };

  private handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private renderErrorUI() {
    const { level = 'component', enableRecovery = true } = this.props;
    const { error, retryCount } = this.state;
    const canRetry = retryCount < this.maxRetries && enableRecovery;

    const errorMessages = {
      component: 'A component has encountered an error',
      section: 'This section is temporarily unavailable',
      page: 'This page has encountered an error',
      app: 'The application has encountered a critical error'
    };

    const severity = {
      component: 'default',
      section: 'default',
      page: 'destructive',
      app: 'destructive'
    } as const;

    return (
      <Card className="p-6 m-4">
        <Alert variant={severity[level]}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            Error Occurred
            {retryCount > 0 && (
              <span className="text-sm font-normal">
                (Attempt {retryCount + 1}/{this.maxRetries + 1})
              </span>
            )}
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p>{errorMessages[level]}</p>
            {error && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {error.message}
                </pre>
              </details>
            )}
          </AlertDescription>
        </Alert>

        <div className="flex gap-2 mt-4">
          {canRetry && (
            <Button 
              onClick={this.handleRetry} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
          
          {level !== 'app' && (
            <Button 
              onClick={this.handleReset} 
              variant="outline"
              className="flex items-center gap-2"
            >
              Reset Component
            </Button>
          )}

          {(level === 'page' || level === 'app') && (
            <Button 
              onClick={this.handleGoHome}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Go Home
            </Button>
          )}
        </div>
      </Card>
    );
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Otherwise use default error UI
      return this.renderErrorUI();
    }

    return this.props.children;
  }
}
