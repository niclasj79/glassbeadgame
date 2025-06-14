
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Shuffle, ArrowRight, Sparkles } from 'lucide-react';

interface SessionStartFlowProps {
  disciplines: any[];
  onSessionStart: (selectedDisciplines: string[], conceptCount: number) => void;
}

export const SessionStartFlow: React.FC<SessionStartFlowProps> = ({
  disciplines,
  onSessionStart
}) => {
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [suggestedCombinations, setSuggestedCombinations] = useState<string[][]>([]);
  const [phase, setPhase] = useState<'disciplines' | 'concepts'>('disciplines');
  const [conceptCount, setConceptCount] = useState(12);

  useEffect(() => {
    // Generate 3 random discipline combinations
    const combinations = [];
    for (let i = 0; i < 3; i++) {
      const shuffled = [...disciplines].sort(() => 0.5 - Math.random());
      combinations.push(shuffled.slice(0, 2 + Math.floor(Math.random() * 2)).map(d => d.id));
    }
    setSuggestedCombinations(combinations);
  }, [disciplines]);

  const handleQuickSelect = (combination: string[]) => {
    setSelectedDisciplines(combination);
    setPhase('concepts');
  };

  const handleSurpriseMe = () => {
    // Randomly select 2-4 disciplines
    const shuffled = [...disciplines].sort(() => 0.5 - Math.random());
    const randomDisciplines = shuffled.slice(0, 2 + Math.floor(Math.random() * 3));
    const randomConceptCount = 10 + Math.floor(Math.random() * 11); // 10-20 concepts
    
    onSessionStart(randomDisciplines.map(d => d.id), randomConceptCount);
  };

  const handleCustomStart = () => {
    if (selectedDisciplines.length > 0) {
      if (phase === 'disciplines') {
        setPhase('concepts');
      } else {
        onSessionStart(selectedDisciplines, conceptCount);
      }
    }
  };

  const handleStartWithConcepts = () => {
    onSessionStart(selectedDisciplines, conceptCount);
  };

  const toggleDiscipline = (disciplineId: string) => {
    setSelectedDisciplines(prev => 
      prev.includes(disciplineId)
        ? prev.filter(id => id !== disciplineId)
        : [...prev, disciplineId]
    );
  };

  const handleBack = () => {
    setPhase('disciplines');
    setSelectedDisciplines([]);
  };

  if (phase === 'concepts') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black text-white flex items-center justify-center p-6">
        <Card className="bg-gray-900 border-gray-700 p-8 max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
              How Many Concepts?
            </h1>
            <p className="text-gray-300">Choose the number of concepts to explore</p>
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

          {/* Concept Count Selection */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Button
                variant="outline"
                onClick={() => setConceptCount(Math.max(8, conceptCount - 2))}
                className="border-gray-600"
              >
                -
              </Button>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">{conceptCount}</div>
                <div className="text-sm text-gray-400">concepts</div>
              </div>
              <Button
                variant="outline"
                onClick={() => setConceptCount(Math.min(25, conceptCount + 2))}
                className="border-gray-600"
              >
                +
              </Button>
            </div>
            <div className="text-center text-sm text-gray-400">
              {conceptCount < 12 ? 'Focused exploration' : 
               conceptCount < 18 ? 'Balanced discovery' : 'Rich complexity'}
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={handleBack}
              className="border-gray-600"
            >
              Back
            </Button>
            <Button
              onClick={handleStartWithConcepts}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8"
            >
              <Play className="w-4 h-4 mr-2" />
              Enter the Arena
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black text-white flex items-center justify-center p-6">
      <Card className="bg-gray-900 border-gray-700 p-8 max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Choose Your Disciplines
          </h1>
          <p className="text-gray-300">Select disciplines to explore their interconnections</p>
        </div>

        {/* Surprise Me Option */}
        <div className="mb-8 text-center">
          <Button
            onClick={handleSurpriseMe}
            className="bg-gradient-to-r from-pink-600 to-orange-600 hover:from-pink-700 hover:to-orange-700 px-8 py-4 text-lg"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            I'm feeling serendipitous. Surprise me!
          </Button>
          <p className="text-sm text-gray-400 mt-2">Let chance guide your exploration</p>
        </div>

        <div className="border-t border-gray-700 pt-8">
          {/* Quick Combinations */}
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
                  onClick={() => handleQuickSelect(combination)}
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

          {/* Custom Selection */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Or Build Your Own</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {disciplines.map(discipline => (
                <Button
                  key={discipline.id}
                  variant={selectedDisciplines.includes(discipline.id) ? "default" : "outline"}
                  onClick={() => toggleDiscipline(discipline.id)}
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
              onClick={handleCustomStart}
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
