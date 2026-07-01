
import React from 'react';
import { SessionInfo } from './SessionInfo';
import { ResponsiveInsights } from './ResponsiveInsights';
import { Concept } from './types';
import { isFeatureEnabled } from '@/config/featureFlags';

interface BottomUIProps {
  disciplines: any[];
  selectedDisciplines: string[];
  concepts: Concept[];
  currentInsight: any;
  isGenerating: boolean;
  error: string | null;
}

export const BottomUI: React.FC<BottomUIProps> = ({
  disciplines,
  selectedDisciplines,
  concepts,
  currentInsight,
  isGenerating,
  error
}) => {
  const showInsights = isFeatureEnabled('hesseInsights');

  return (
    <div className="flex flex-col md:flex-row justify-between items-end gap-2 md:gap-4 p-2 md:p-4">
      {/* Session Info - Hidden on mobile */}
      <div className="hidden md:block">
        <SessionInfo
          disciplines={disciplines}
          selectedDisciplines={selectedDisciplines}
          concepts={concepts}
        />
      </div>
      
      {/* Hesse Insights - Only show if feature is enabled */}
      {showInsights && (
        <div className="w-full md:max-w-md md:flex-shrink-0">
          <ResponsiveInsights
            currentInsight={currentInsight}
            isGenerating={isGenerating}
            error={error}
          />
        </div>
      )}
    </div>
  );
};
