
import React from 'react';
import { Card, CardProps } from './card';
import { TouchFeedback } from './touch-feedback';
import { LoadingOverlay } from './loading-overlay';
import { cn } from '@/lib/utils';

interface EnhancedCardProps extends CardProps {
  loading?: boolean;
  loadingMessage?: string;
  interactive?: boolean;
  touchFeedback?: boolean;
  focusable?: boolean;
  role?: string;
  'aria-label'?: string;
}

export const EnhancedCard: React.FC<EnhancedCardProps> = ({
  children,
  loading = false,
  loadingMessage,
  interactive = false,
  touchFeedback = false,
  focusable = false,
  className,
  role,
  'aria-label': ariaLabel,
  ...props
}) => {
  const CardComponent = (
    <Card
      className={cn(
        interactive && "cursor-pointer hover:shadow-lg transition-shadow duration-200",
        focusable && "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        className
      )}
      tabIndex={focusable ? 0 : undefined}
      role={role || (interactive ? 'button' : undefined)}
      aria-label={ariaLabel}
      {...props}
    >
      <LoadingOverlay isLoading={loading} message={loadingMessage}>
        {children}
      </LoadingOverlay>
    </Card>
  );

  if (touchFeedback && interactive) {
    return (
      <TouchFeedback feedbackType="scale">
        {CardComponent}
      </TouchFeedback>
    );
  }

  return CardComponent;
};
