
import { useEffect, useRef, useCallback } from 'react';

interface AccessibilityOptions {
  announceChanges?: boolean;
  focusManagement?: boolean;
  keyboardNavigation?: boolean;
}

export const useAccessibility = (options: AccessibilityOptions = {}) => {
  const {
    announceChanges = true,
    focusManagement = true,
    keyboardNavigation = true
  } = options;

  const announceRef = useRef<HTMLDivElement | null>(null);
  const focusStackRef = useRef<HTMLElement[]>([]);

  // Create announcement region for screen readers
  useEffect(() => {
    if (!announceChanges) return;

    const announceElement = document.createElement('div');
    announceElement.setAttribute('aria-live', 'polite');
    announceElement.setAttribute('aria-atomic', 'true');
    announceElement.className = 'sr-only';
    announceElement.id = 'accessibility-announcements';
    
    document.body.appendChild(announceElement);
    announceRef.current = announceElement;

    return () => {
      if (announceRef.current) {
        document.body.removeChild(announceRef.current);
      }
    };
  }, [announceChanges]);

  // Announce messages to screen readers
  const announce = useCallback((message: string) => {
    if (announceRef.current) {
      announceRef.current.textContent = message;
      
      // Clear after a delay to allow for re-announcement of the same message
      setTimeout(() => {
        if (announceRef.current) {
          announceRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  // Focus management utilities
  const saveFocus = useCallback(() => {
    if (!focusManagement) return;
    
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement !== document.body) {
      focusStackRef.current.push(activeElement);
    }
  }, [focusManagement]);

  const restoreFocus = useCallback(() => {
    if (!focusManagement) return;
    
    const lastFocused = focusStackRef.current.pop();
    if (lastFocused && lastFocused.focus) {
      try {
        lastFocused.focus();
      } catch (error) {
        console.warn('Failed to restore focus:', error);
      }
    }
  }, [focusManagement]);

  const focusFirst = useCallback((container: HTMLElement) => {
    if (!focusManagement) return false;
    
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    if (firstElement) {
      firstElement.focus();
      return true;
    }
    return false;
  }, [focusManagement]);

  // Keyboard navigation helpers
  const handleKeyNavigation = useCallback((
    event: KeyboardEvent,
    handlers: Record<string, () => void>
  ) => {
    if (!keyboardNavigation) return;
    
    const handler = handlers[event.key];
    if (handler) {
      event.preventDefault();
      handler();
    }
  }, [keyboardNavigation]);

  return {
    announce,
    saveFocus,
    restoreFocus,
    focusFirst,
    handleKeyNavigation
  };
};
