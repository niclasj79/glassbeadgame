
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Concept } from '../concept/types';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface SessionInfoProps {
  disciplines: any[];
  selectedDisciplines: string[];
  concepts: Concept[];
}

export const SessionInfo: React.FC<SessionInfoProps> = ({
  disciplines,
  selectedDisciplines,
  concepts
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const activeDisciplines = disciplines.filter(d => selectedDisciplines.includes(d.id));

  const toggleMinimized = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <div className="absolute bottom-4 left-4 max-w-sm">
      <Card className="bg-gray-900/80 border-gray-700 backdrop-blur-sm transition-all duration-300 ease-in-out">
        {/* Header with minimize/maximize button */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700/50">
          <h3 className="text-sm font-semibold text-white">Active Concepts</h3>
          <Button
            onClick={toggleMinimized}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-700/50"
          >
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
        </div>

        {/* Expandable content */}
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isMinimized ? 'max-h-0' : 'max-h-80'
        }`}>
          <div className="p-4 space-y-3 overflow-y-auto">
            {/* Concepts by Discipline */}
            {activeDisciplines.map(discipline => {
              const disciplineConcepts = concepts.filter(c => c.discipline === discipline.id);
              return (
                <div key={discipline.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: discipline.color }}
                    />
                    <span className="text-xs font-medium text-white">{discipline.name}</span>
                  </div>
                  <div className="ml-5 space-y-1">
                    {disciplineConcepts.slice(0, 3).map(concept => (
                      <div key={concept.id} className="text-xs text-gray-300">
                        {concept.text}
                      </div>
                    ))}
                    {disciplineConcepts.length > 3 && (
                      <div className="text-xs text-gray-500 italic">
                        +{disciplineConcepts.length - 3} more...
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Minimized state indicator */}
        {isMinimized && (
          <div className="px-3 pb-2">
            <div className="flex gap-1">
              {activeDisciplines.map(discipline => (
                <div
                  key={discipline.id}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: discipline.color }}
                  title={discipline.name}
                />
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
