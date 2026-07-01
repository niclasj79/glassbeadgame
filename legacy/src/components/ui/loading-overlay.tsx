
import React from 'react';
import { LoadingSpinner } from './loading-spinner';
import { cn } from '@/lib/utils';

interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  message?: string;
  className?: string;
  blur?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  children,
  message = 'Loading...',
  className,
  blur = true
}) => {
  return (
    <div className={cn("relative", className)}>
      {children}
      {isLoading && (
        <div 
          className={cn(
            "absolute inset-0 z-50 flex flex-col items-center justify-center",
            "bg-black/20 backdrop-blur-sm",
            blur && "backdrop-blur-md"
          )}
          role="status"
          aria-live="polite"
        >
          <div className="bg-white/90 dark:bg-gray-900/90 rounded-lg p-6 shadow-lg">
            <LoadingSpinner size="lg" />
            <p className="mt-3 text-sm text-gray-700 dark:text-gray-300 font-medium">
              {message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
