
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shuffle } from 'lucide-react';

interface QuickCombinationsProps {
  disciplines: any[];
  suggestedCombinations: string[][];
  onQuickSelect: (combination: string[]) => void;
}

export const QuickCombinations: React.FC<QuickCombinationsProps> = ({
  disciplines,
  suggestedCombinations,
  onQuickSelect
}) => {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Shuffle className="w-5 h-5" />
        Quick Combinations
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {suggestedCombinations.map((combination, index) => (
          <Button
            key={index}
            variant="outline"
            onClick={() => onQuickSelect(combination)}
            className="p-4 h-auto border-gray-600 hover:border-purple-400 hover:bg-purple-900/20"
          >
            <div className="flex flex-wrap gap-2 justify-center">
              {combination.map(disciplineId => {
                const discipline = disciplines.find(d => d.id === disciplineId);
                return discipline ? (
                  <Badge 
                    key={disciplineId}
                    style={{ backgroundColor: discipline.color }}
                    className="text-white"
                  >
                    {discipline.icon} {discipline.name}
                  </Badge>
                ) : null;
              })}
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};
