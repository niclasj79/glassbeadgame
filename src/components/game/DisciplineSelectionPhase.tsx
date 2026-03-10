
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shuffle, Sparkles, ArrowLeft, Play } from 'lucide-react';

interface DisciplineSelectionPhaseProps {
  disciplines: any[];
  selectedDisciplines: string[];
  suggestedCombinations: string[][];
  onToggleDiscipline: (disciplineId: string) => void;
  onQuickSelect: (combination: string[]) => void;
  onSurpriseMe: (selectedDisciplines: string[], conceptCount: number) => Promise<void>;
  onNext: (selectedDisciplines: string[]) => void;
  onBack?: () => void;
  isLoading: boolean;
}

export const DisciplineSelectionPhase: React.FC<DisciplineSelectionPhaseProps> = ({
  disciplines,
  suggestedCombinations,
  onQuickSelect,
  onSurpriseMe,
  onNext,
  onBack,
  isLoading
}) => {
  const [manuallySelected, setManuallySelected] = useState<string[]>([]);

  const handleToggleDiscipline = (disciplineId: string) => {
    setManuallySelected(prev => 
      prev.includes(disciplineId) 
        ? prev.filter(id => id !== disciplineId)
        : [...prev, disciplineId]
    );
  };

  const handleManualNext = () => {
    if (manuallySelected.length > 0) {
      onNext(manuallySelected);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'hsl(240, 60%, 3%)' }}>
      <Card className="bg-gray-900 border-gray-700 p-8 max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Choose Your Path
          </h1>
          <p className="text-gray-300">Select disciplines to explore or let chance guide you</p>
        </div>

        {/* Quick Select Suggestions */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-center">Quick Combinations</h3>
          <div className="flex flex-col gap-3 items-center">
            {suggestedCombinations.map((combination, index) => (
              <Button
                key={index}
                variant="secondary"
                className="w-full max-w-md border-gray-600 bg-gray-800 hover:bg-gray-700 text-white"
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

        {/* Manual Selection */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-center">Or Choose Manually</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
            {disciplines.map(discipline => (
              <Button
                key={discipline.id}
                variant={manuallySelected.includes(discipline.id) ? "default" : "outline"}
                className={`p-4 h-auto ${
                  manuallySelected.includes(discipline.id)
                    ? `bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600`
                    : `border-gray-600 hover:border-purple-400 hover:bg-purple-900/20`
                }`}
                onClick={() => handleToggleDiscipline(discipline.id)}
                disabled={isLoading}
              >
                <div className="text-center">
                  <div className="text-lg mb-1">{discipline.icon}</div>
                  <div className="text-xs">{discipline.name}</div>
                </div>
              </Button>
            ))}
          </div>
          
          {manuallySelected.length > 0 && (
            <div className="text-center mt-4">
              <Button
                onClick={handleManualNext}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 px-6 py-2"
                disabled={isLoading}
              >
                <Play className="w-4 h-4 mr-2" />
                Continue with {manuallySelected.length} discipline{manuallySelected.length > 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </div>

        {/* Surprise Me Button */}
        <div className="text-center mb-6">
          <Button
            onClick={() => onSurpriseMe(disciplines.map(d => d.id), 12)}
            className="bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 px-8 py-3 text-lg"
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
                Surprise Me (Quick Start)
              </>
            )}
          </Button>
          <p className="text-sm text-gray-400 mt-2">
            Skip concept selection and jump straight in
          </p>
        </div>

        {/* Back Button */}
        <div className="flex justify-between items-center">
          {onBack && (
            <Button
              variant="outline"
              onClick={onBack}
              className="border-gray-600 text-gray-400 hover:bg-gray-700"
              disabled={isLoading}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          
          <div className="flex-1"></div>
          
          <div className="text-sm text-gray-500">
            <p>Reload for new combinations</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
