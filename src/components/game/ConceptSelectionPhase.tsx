
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Play, Shuffle } from 'lucide-react';
import { conceptDatabase } from './concept/conceptData';

interface ConceptSelectionPhaseProps {
  disciplines: any[];
  selectedDisciplines: string[];
  onConceptsSelected: (selectedConcepts: { [disciplineId: string]: string }) => void;
  onBack: () => void;
  isLoading: boolean;
}

export const ConceptSelectionPhase: React.FC<ConceptSelectionPhaseProps> = ({
  disciplines,
  selectedDisciplines,
  onConceptsSelected,
  onBack,
  isLoading
}) => {
  const [conceptOptions, setConceptOptions] = useState<{ [disciplineId: string]: string[] }>({});
  const [selectedConcepts, setSelectedConcepts] = useState<{ [disciplineId: string]: string }>({});

  // Generate 4 random concepts for each discipline
  useEffect(() => {
    const options: { [disciplineId: string]: string[] } = {};
    
    selectedDisciplines.forEach(disciplineId => {
      const availableConcepts = conceptDatabase[disciplineId as keyof typeof conceptDatabase] || [];
      const shuffled = [...availableConcepts].sort(() => 0.5 - Math.random());
      options[disciplineId] = shuffled.slice(0, 4);
    });
    
    setConceptOptions(options);
  }, [selectedDisciplines]);

  const handleConceptSelect = (disciplineId: string, concept: string) => {
    setSelectedConcepts(prev => ({
      ...prev,
      [disciplineId]: concept
    }));
  };

  const handleContinue = () => {
    onConceptsSelected(selectedConcepts);
  };

  const canContinue = selectedDisciplines.every(disciplineId => selectedConcepts[disciplineId]);

  const getDiscipline = (disciplineId: string) => {
    return disciplines.find(d => d.id === disciplineId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black text-white flex items-center justify-center p-6">
      <Card className="bg-gray-900 border-gray-700 p-8 max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Select Your Concepts
          </h1>
          <p className="text-gray-300">Choose one concept from each discipline to explore</p>
        </div>

        <div className="space-y-8">
          {selectedDisciplines.map(disciplineId => {
            const discipline = getDiscipline(disciplineId);
            const options = conceptOptions[disciplineId] || [];
            const selected = selectedConcepts[disciplineId];

            return (
              <div key={disciplineId} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: discipline?.color }}
                  />
                  <h3 className="text-xl font-semibold">
                    {discipline?.icon} {discipline?.name}
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-7">
                  {options.map((concept, index) => (
                    <Button
                      key={index}
                      variant={selected === concept ? "default" : "outline"}
                      className={`p-4 h-auto text-left justify-start ${
                        selected === concept 
                          ? `bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600` 
                          : `border-gray-600 hover:border-purple-400 hover:bg-purple-900/20`
                      }`}
                      onClick={() => handleConceptSelect(disciplineId, concept)}
                    >
                      <div className="text-sm font-medium">{concept}</div>
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-700">
          <Button
            variant="outline"
            onClick={onBack}
            className="border-gray-600 text-gray-400 hover:bg-gray-700"
            disabled={isLoading}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="text-center">
            <p className="text-sm text-gray-400 mb-2">
              {Object.keys(selectedConcepts).length} of {selectedDisciplines.length} concepts selected
            </p>
            <Button
              onClick={handleContinue}
              disabled={!canContinue || isLoading}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 px-8 py-3"
            >
              {isLoading ? (
                <>
                  <Shuffle className="w-5 h-5 mr-2 animate-spin" />
                  Starting Session...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Start Contemplation
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
