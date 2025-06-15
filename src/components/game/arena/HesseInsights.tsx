
import React from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, BookOpen, Sparkles } from 'lucide-react';

interface HesseInsightsProps {
  conceptualText: string | null;
  dimensionalText: string | null;
  isGenerating: boolean;
  error: string | null;
  className?: string;
}

export const HesseInsights: React.FC<HesseInsightsProps> = ({
  conceptualText,
  dimensionalText,
  isGenerating,
  error,
  className = ""
}) => {
  const hasContent = conceptualText || dimensionalText;

  if (!hasContent && !isGenerating && !error) {
    return (
      <Card className={`bg-gray-900/80 border-gray-700 backdrop-blur-sm p-3 md:p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-2 md:mb-3">
          <BookOpen className="h-4 w-4 md:h-5 md:w-5 text-amber-400" />
          <h3 className="text-base md:text-lg font-semibold text-white">Hesse Insights</h3>
        </div>
        <p className="text-xs md:text-sm text-gray-400 italic">
          Position concepts in the 3D space and wait 20 seconds for Hermann Hesse-style insights to emerge...
        </p>
      </Card>
    );
  }

  return (
    <Card className={`bg-gray-900/80 border-gray-700 backdrop-blur-sm ${className}`}>
      <div className="p-3 md:p-4">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <BookOpen className="h-4 w-4 md:h-5 md:w-5 text-amber-400" />
          <h3 className="text-base md:text-lg font-semibold text-white">Hesse Insights</h3>
          {isGenerating && (
            <Loader2 className="h-4 w-4 text-amber-400 animate-spin ml-auto" />
          )}
        </div>

        {error && (
          <div className="mb-3 md:mb-4 p-2 md:p-3 bg-red-900/50 border border-red-700 rounded-lg">
            <p className="text-red-300 text-xs md:text-sm">{error}</p>
          </div>
        )}

        <ScrollArea className="max-h-60 md:max-h-80">
          <div className="space-y-3 md:space-y-4">
            {conceptualText && (
              <div>
                <div className="flex items-center gap-2 mb-1 md:mb-2">
                  <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-blue-400" />
                  <h4 className="text-xs md:text-sm font-medium text-blue-300">Conceptual Synthesis</h4>
                </div>
                <p className="text-xs md:text-sm text-gray-300 leading-relaxed italic">
                  "{conceptualText}"
                </p>
              </div>
            )}

            {dimensionalText && (
              <div>
                <div className="flex items-center gap-2 mb-1 md:mb-2">
                  <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-purple-400" />
                  <h4 className="text-xs md:text-sm font-medium text-purple-300">Dimensional Expression & Collective Symbiosis</h4>
                </div>
                <p className="text-xs md:text-sm text-gray-300 leading-relaxed italic">
                  "{dimensionalText}"
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {isGenerating && (
          <div className="mt-3 md:mt-4 p-2 md:p-3 bg-amber-900/30 border border-amber-700/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 md:h-4 md:w-4 text-amber-400 animate-spin" />
              <p className="text-amber-300 text-xs md:text-sm">Generating Hermann Hesse-style insights based on dimensional positioning...</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
