import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Shuffle, Sparkles } from 'lucide-react';

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
  selectedDisciplines,
  suggestedCombinations,
  onToggleDiscipline,
  onQuickSelect,
  onSurpriseMe,
  onNext,
  isLoading
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black text-white flex items-center justify-center p-6">
      <Card className="bg-gray-900 border-gray-700 p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Choose Your Disciplines
          </h1>
          <p className="text-gray-300">Select the areas you want to explore</p>
        </div>

        {/* Discipline Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Disciplines</h3>
          <div className="flex flex-wrap gap-2 justify-center">
            {disciplines.map(discipline => (
              <Button
                key={discipline.id}
                variant={selectedDisciplines.includes(discipline.id) ? "default" : "outline"}
                style={{ backgroundColor: selectedDisciplines.includes(discipline.id) ? discipline.color : 'transparent' }}
                className={`text-white px-3 py-1 rounded-full ${selectedDisciplines.includes(discipline.id) ? '' : 'border-gray-600'}`}
                onClick={() => onToggleDiscipline(discipline.id)}
                disabled={isLoading}
              >
                {discipline.icon} {discipline.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Quick Select Suggestions */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Quick Select</h3>
          <div className="flex flex-col gap-2 items-center">
            {suggestedCombinations.map((combination, index) => (
              <Button
                key={index}
                variant="secondary"
                className="w-full md:w-auto border-gray-600"
                onClick={() => onQuickSelect(combination)}
                disabled={isLoading}
              >
                {combination.map(disciplineId => {
                  const discipline = disciplines.find(d => d.id === disciplineId);
                  return discipline ? discipline.name : null;
                }).join(' + ')}
              </Button>
            ))}
          </div>
        </div>

        {/* Surprise Me Button */}
        <div className="mb-6 text-center">
          <Button
            onClick={() => onSurpriseMe(disciplines.map(d => d.id), 12)}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Shuffle className="w-4 h-4 mr-2 animate-spin" />
                Surprising...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Surprise Me
              </>
            )}
          </Button>
        </div>

        {/* Next Button */}
        <div className="text-center">
          <Button
            onClick={onNext}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8"
            disabled={isLoading}
          >
            {selectedDisciplines.length > 0 ? (
              <>
                <Play className="w-4 h-4 mr-2" />
                Next
              </>
            ) : (
              "Choose Disciplines to Continue"
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};
