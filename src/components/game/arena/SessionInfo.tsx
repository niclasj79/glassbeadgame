
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Concept } from '../concept/types';

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
  const activeDisciplines = disciplines.filter(d => selectedDisciplines.includes(d.id));

  return (
    <div className="absolute bottom-4 left-4 max-w-sm">
      {/* Active Concepts Panel - Now at bottom left */}
      <Card className="bg-gray-900/70 border-gray-700 p-4 backdrop-blur-sm max-h-80 overflow-y-auto">
        <h3 className="text-sm font-semibold text-white mb-3">Active Concepts</h3>
        
        {/* Active Disciplines Summary */}
        <div className="flex flex-wrap gap-2 mb-4">
          {activeDisciplines.map(discipline => (
            <Badge
              key={discipline.id}
              className="text-white border-0 text-xs"
              style={{ backgroundColor: discipline.color }}
            >
              {discipline.icon} {discipline.name}
            </Badge>
          ))}
        </div>

        {/* Concepts by Discipline */}
        <div className="space-y-3">
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
                  <span className="text-xs text-gray-400">({disciplineConcepts.length})</span>
                </div>
                <div className="ml-5 space-y-1">
                  {disciplineConcepts.slice(0, 3).map(concept => (
                    <div key={concept.id} className="text-xs text-gray-300">
                      {concept.text}
                    </div>
                  ))}
                  {disciplineConcepts.length > 3 && (
                    <div className="text-xs text-gray-500 italic">
                      +{disciplineConcepts.length - 3} more concepts...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
