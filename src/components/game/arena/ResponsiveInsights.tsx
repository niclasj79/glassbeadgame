
import React, { useState } from 'react';
import { HesseInsights } from './HesseInsights';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResponsiveInsightsProps {
  currentInsight: any;
  isGenerating: boolean;
  error: string | null;
}

export const ResponsiveInsights: React.FC<ResponsiveInsightsProps> = ({
  currentInsight,
  isGenerating,
  error
}) => {
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-700">
        <button
          onClick={() => setInsightsExpanded(!insightsExpanded)}
          className="w-full p-3 flex items-center justify-between text-white"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium">Hesse Insights</span>
          </div>
          {insightsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        {insightsExpanded && (
          <div className="border-t border-gray-700">
            <HesseInsights
              conceptualText={currentInsight?.conceptualText || null}
              dimensionalText={currentInsight?.dimensionalText || null}
              isGenerating={isGenerating}
              error={error}
              className="border-0 bg-transparent"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <HesseInsights
      conceptualText={currentInsight?.conceptualText || null}
      dimensionalText={currentInsight?.dimensionalText || null}
      isGenerating={isGenerating}
      error={error}
      className="max-w-md flex-shrink-0"
    />
  );
};
