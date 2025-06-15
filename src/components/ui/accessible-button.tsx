
import React, { forwardRef } from 'react';
import { Button, ButtonProps } from './button';
import { LoadingSpinner } from './loading-spinner';
import { cn } from '@/lib/utils';

interface AccessibleButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
  announceOnPress?: string;
  focusRing?: boolean;
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({ 
    children, 
    loading = false, 
    loadingText = 'Loading...', 
    announceOnPress,
    focusRing = true,
    className,
    disabled,
    onClick,
    ...props 
  }, ref) => {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (loading || disabled) return;
      
      // Announce action to screen readers
      if (announceOnPress) {
        const announcement = document.getElementById('accessibility-announcements');
        if (announcement) {
          announcement.textContent = announceOnPress;
        }
      }
      
      onClick?.(event);
    };

    return (
      <Button
        ref={ref}
        className={cn(
          focusRing && "focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
          "transition-all duration-200",
          className
        )}
        disabled={disabled || loading}
        onClick={handleClick}
        aria-busy={loading}
        aria-label={loading ? loadingText : undefined}
        {...props}
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <LoadingSpinner size="sm" label={loadingText} />
            <span>{loadingText}</span>
          </div>
        ) : (
          children
        )}
      </Button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';
