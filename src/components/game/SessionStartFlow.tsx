
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Shuffle, Clock } from 'lucide-react';

interface SessionStartFlowProps {
  disciplines: any[];
  onSessionStart: (selectedDisciplines: string[], sessionType: string) => void;
}

export const SessionStartFlow: React.FC<SessionStartFlowProps> = ({
  disciplines,
  onSessionStart
}) => {
  const [timeLeft, setTimeLeft] = useState(30);
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [suggestedCombinations, setSuggestedCombinations] = useState<string[][]>([]);
  const [sessionType, setSessionType] = useState<string>('exploration');

  useEffect(() => {
    // Generate 3 random discipline combinations
    const combinations = [];
    for (let i = 0; i < 3; i++) {
      const shuffled = [...disciplines].sort(() => 0.5 - Math.random());
      combinations.push(shuffled.slice(0, 2 + Math.floor(Math.random() * 2)).map(d => d.id));
    }
    setSuggestedCombinations(combinations);
  }, [disciplines]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleQuickSelect = (combination: string[]) => {
    setSelectedDisciplines(combination);
    onSessionStart(combination, sessionType);
  };

  const handleCustomStart = () => {
    if (selectedDisciplines.length > 0) {
      onSessionStart(selectedDisciplines, sessionType);
    }
  };

  const toggleDiscipline = (disciplineId: string) => {
    setSelectedDisciplines(prev => 
      prev.includes(disciplineId)
        ? prev.filter(id => id !== disciplineId)
        : [...prev, disciplineId]
    );
  };

  const sessionTypes = [
    { id: 'exploration', name: 'Exploration', description: 'Free-form discovery' },
    { id: 'synthesis', name: 'Synthesis', description: 'Focused connection-making' },
    { id: 'improvisation', name: 'Improvisation', description: 'Spontaneous expression' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black text-white flex items-center justify-center p-6">
      <Card className="bg-gray-900 border-gray-700 p-8 max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Begin Your Synthesis
          </h1>
          <div className="flex items-center justify-center gap-2 text-amber-400">
            <Clock className="w-5 h-5" />
            <span className="text-2xl font-mono">{timeLeft}s</span>
          </div>
          <p className="text-gray-300 mt-2">Quick decisions lead to unexpected discoveries</p>
        </div>

        {/* Session Type Selection */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Choose Your Approach</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sessionTypes.map(type => (
              <Button
                key={type.id}
                variant={sessionType === type.id ? "default" : "outline"}
                onClick={() => setSessionType(type.id)}
                className={`p-4 h-auto flex flex-col ${
                  sessionType === type.id 
                    ? 'bg-purple-600 hover:bg-purple-700' 
                    : 'border-gray-600'
                }`}
              >
                <div className="font-medium">{type.name}</div>
                <div className="text-xs text-gray-400">{type.description}</div>
              </Button>
            ))}
          </div>
        </div>

        {/* Quick Combinations */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shuffle className="w-5 h-5" />
            Instant Combinations
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
            <Play className="w-4 h-4 mr-2" />
            Enter the Arena
          </Button>
        </div>
      </Card>
    </div>
  );
};
