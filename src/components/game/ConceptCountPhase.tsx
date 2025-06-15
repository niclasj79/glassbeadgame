
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Loader2 } from 'lucide-react';

interface ConceptCountPhaseProps {
  disciplines: any[];
  selectedDisciplines: string[];
  conceptCount: number;
  onConceptCountChange: (count: number) => void;
  onBack: () => void;
  onStart: () => void;
  isLoading?: boolean;
}

export const ConceptCountPhase: React.FC<ConceptCountPhaseProps> = ({
  disciplines,
  selectedDisciplines,
  conceptCount,
  onConceptCountChange,
  onBack,
  onStart,
  isLoading = false
}) => {
  const maxConcepts = selectedDisciplines.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black text-white flex items-center justify-center p-6">
      <Card className="bg-gray-900 border-gray-700 p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Concept Focus
          </h1>
          <p className="text-gray-300">One profound concept per discipline</p>
        </div>

        {/* Selected Disciplines Display */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Selected Disciplines</h3>
          <div className="flex flex-wrap gap-2 justify-center">
            {selectedDisciplines.map(disciplineId => {
              const discipline = disciplines.find(d => d.id === disciplineId);
              return discipline ? (
                <Badge 
                  key={disciplineId}
                  style={{ backgroundColor: discipline.color }}
                  className="text-white px-3 py-1"
                >
                  {discipline.icon} {discipline.name}
                </Badge>
              ) : null;
            })}
          </div>
        </div>

        {/* Concept Count Display */}
        <div className="mb-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-400">{maxConcepts}</div>
            <div className="text-sm text-gray-400">concepts (one per discipline)</div>
          </div>
          <div className="text-center text-sm text-gray-400 mt-2">
            Each discipline will contribute its most resonant concept
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            onClick={onBack}
            className="border-gray-600"
            disabled={isLoading}
          >
            Back
          </Button>
          <Button
            onClick={onStart}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading Concepts...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Enter the Arena
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};
