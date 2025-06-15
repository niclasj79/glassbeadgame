
import { useState, useCallback, useRef } from 'react';

interface ErrorState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  lastErrorTime: number;
}

interface ErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: Error) => void;
  onRecovery?: () => void;
}

export const useErrorRecovery = (options: ErrorRecoveryOptions = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onError,
    onRecovery
  } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    error: null,
    retryCount: 0,
    lastErrorTime: 0
  });

  const retryTimeoutRef = useRef<number>();

  const handleError = useCallback((error: Error) => {
    console.error('Error handled by useErrorRecovery:', error);
    
    setErrorState(prev => ({
      hasError: true,
      error,
      retryCount: prev.retryCount + 1,
      lastErrorTime: Date.now()
    }));

    if (onError) {
      onError(error);
    }
  }, [onError]);

  const retry = useCallback(async (retryFn: () => Promise<void> | void) => {
    if (errorState.retryCount >= maxRetries) {
      console.warn('Max retries reached, cannot retry');
      return false;
    }

    try {
      // Clear any existing timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }

      // Wait for retry delay
      await new Promise(resolve => {
        retryTimeoutRef.current = window.setTimeout(resolve, retryDelay);
      });

      // Execute retry function
      await retryFn();

      // Success - reset error state
      setErrorState({
        hasError: false,
        error: null,
        retryCount: 0,
        lastErrorTime: 0
      });

      if (onRecovery) {
        onRecovery();
      }

      return true;
    } catch (retryError) {
      console.error('Retry failed:', retryError);
      handleError(retryError as Error);
      return false;
    }
  }, [errorState.retryCount, maxRetries, retryDelay, onRecovery, handleError]);

  const reset = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    setErrorState({
      hasError: false,
      error: null,
      retryCount: 0,
      lastErrorTime: 0
    });
  }, []);

  const canRetry = errorState.retryCount < maxRetries;

  return {
    errorState,
    handleError,
    retry,
    reset,
    canRetry
  };
};
