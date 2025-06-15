
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Shuffle, Sparkles } from 'lucide-react';

interface DisciplineSelectionPhaseProps {
  disciplines: any[];
  selectedDisciplines: string[];
  suggestedCombinations: string[][];
  onToggleDiscipline: (disciplineId: string) => void;
  onQuickSelect: (combination: string[]) => void;
  onSurpriseMe: (selectedDisciplines: string[], conceptCount: number) => Promise<void>;
  onNext: () => void;
  isLoading: boolean;
}

export const DisciplineSelectionPhase: React.FC<DisciplineSelectionPhaseProps> = ({
  disciplines,
  suggestedCombinations,
  onQuickSelect,
  onSurpriseMe,
  isLoading
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black text-white flex items-center justify-center p-6">
      <Card className="bg-gray-900 border-gray-700 p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Choose Your Path
          </h1>
          <p className="text-gray-300">Select a discipline combination or let chance guide you</p>
        </div>

        {/* Quick Select Suggestions */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-center">Suggested Combinations</h3>
          <div className="flex flex-col gap-3 items-center">
            {suggestedCombinations.map((combination, index) => (
              <Button
                key={index}
                variant="secondary"
                className="w-full border-gray-600 bg-gray-800 hover:bg-gray-700 text-white"
                onClick={() => onQuickSelect(combination)}
                disabled={isLoading}
              >
                {combination.map(disciplineId => {
                  const discipline = disciplines.find(d => d.id === disciplineId);
                  return discipline ? `${discipline.icon} ${discipline.name}` : null;
                }).join(' + ')}
              </Button>
            ))}
          </div>
        </div>

        {/* Surprise Me Button */}
        <div className="text-center">
          <Button
            onClick={() => onSurpriseMe(disciplines.map(d => d.id), 12)}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 px-8 py-3 text-lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Shuffle className="w-5 h-5 mr-2 animate-spin" />
                Preparing Your Journey...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Surprise Me
              </>
            )}
          </Button>
          <p className="text-sm text-gray-400 mt-2">
            Let the game choose your disciplines and concepts
          </p>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Reload the page to get new combinations</p>
        </div>
      </Card>
    </div>
  );
};
