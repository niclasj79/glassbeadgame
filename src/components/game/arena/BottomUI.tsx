
import React from 'react';
import { SessionInfo } from './SessionInfo';
import { ResponsiveInsights } from './ResponsiveInsights';
import { Concept } from './types';

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
  return (
    <div className="absolute bottom-2 md:bottom-4 left-2 md:left-4 right-2 md:right-4 flex flex-col md:flex-row justify-between items-end gap-2 md:gap-4">
      {/* Session Info - Hidden on mobile */}
      <div className="hidden md:block">
        <SessionInfo
          disciplines={disciplines}
          selectedDisciplines={selectedDisciplines}
          concepts={concepts}
        />
      </div>
      
      {/* Hesse Insights - Responsive wrapper */}
      <div className="w-full md:max-w-md md:flex-shrink-0">
        <ResponsiveInsights
          currentInsight={currentInsight}
          isGenerating={isGenerating}
          error={error}
        />
      </div>
    </div>
  );
};
