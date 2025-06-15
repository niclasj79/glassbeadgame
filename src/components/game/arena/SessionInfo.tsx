
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
    <div className="absolute top-4 left-4 space-y-4 max-w-xs">
      {/* Active Disciplines */}
      <Card className="bg-gray-900/90 border-gray-700 p-4 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-white mb-3">Active Disciplines</h3>
        <div className="flex flex-wrap gap-2">
          {activeDisciplines.map(discipline => (
            <Badge
              key={discipline.id}
              className="text-white border-0"
              style={{ backgroundColor: discipline.color }}
            >
              {discipline.icon} {discipline.name}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Concept Count */}
      <Card className="bg-gray-900/90 border-gray-700 p-4 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-white mb-2">Session Info</h3>
        <div className="text-sm text-gray-300">
          <p>{concepts.length} concepts in play</p>
          <p>{activeDisciplines.length} disciplines active</p>
        </div>
      </Card>

      {/* Concepts by Discipline */}
      <Card className="bg-gray-900/90 border-gray-700 p-4 backdrop-blur-sm max-h-60 overflow-y-auto">
        <h3 className="text-sm font-semibold text-white mb-3">Active Concepts</h3>
        <div className="space-y-2">
          {activeDisciplines.map(discipline => {
            const disciplineConcepts = concepts.filter(c => c.discipline === discipline.id);
            return (
              <div key={discipline.id}>
                <div className="flex items-center gap-2 mb-1">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: discipline.color }}
                  />
                  <span className="text-xs font-medium text-white">{discipline.name}</span>
                </div>
                <div className="ml-5 space-y-1">
                  {disciplineConcepts.map(concept => (
                    <div key={concept.id} className="text-xs text-gray-400">
                      {concept.text}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
