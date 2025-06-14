
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { SurpriseMeButton } from './SurpriseMeButton';
import { QuickCombinations } from './QuickCombinations';

interface DisciplineSelectionPhaseProps {
  disciplines: any[];
  selectedDisciplines: string[];
  suggestedCombinations: string[][];
  onToggleDiscipline: (disciplineId: string) => void;
  onQuickSelect: (combination: string[]) => void;
  onSurpriseMe: (selectedDisciplines: string[], conceptCount: number) => void;
  onNext: () => void;
}

export const DisciplineSelectionPhase: React.FC<DisciplineSelectionPhaseProps> = ({
  disciplines,
  selectedDisciplines,
  suggestedCombinations,
  onToggleDiscipline,
  onQuickSelect,
  onSurpriseMe,
  onNext
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black text-white flex items-center justify-center p-6">
      <Card className="bg-gray-900 border-gray-700 p-8 max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Choose Your Disciplines
          </h1>
          <p className="text-gray-300">Select disciplines to explore their interconnections</p>
        </div>

        <SurpriseMeButton disciplines={disciplines} onSurpriseMe={onSurpriseMe} />

        <div className="border-t border-gray-700 pt-8">
          <QuickCombinations
            disciplines={disciplines}
            suggestedCombinations={suggestedCombinations}
            onQuickSelect={onQuickSelect}
          />

          {/* Custom Selection */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Or Build Your Own</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {disciplines.map(discipline => (
                <Button
                  key={discipline.id}
                  variant={selectedDisciplines.includes(discipline.id) ? "default" : "outline"}
                  onClick={() => onToggleDiscipline(discipline.id)}
                  className={`p-2 h-auto text-xs ${
                    selectedDisciplines.includes(discipline.id)
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'border-gray-600'
                  }`}
                >
                  <div className="text-center">
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-1"
                      style={{ backgroundColor: discipline.color }}
                    >
                      {discipline.icon}
                    </div>
                    <span>{discipline.name}</span>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={onNext}
              disabled={selectedDisciplines.length === 0}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8 py-3"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Next: Choose Concepts
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
