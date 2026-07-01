
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Book } from 'lucide-react';

interface DisciplineSelectorProps {
  disciplines: any[];
  selectedDisciplines: string[];
  onDisciplineSelect: (disciplineId: string) => void;
}

export const DisciplineSelector: React.FC<DisciplineSelectorProps> = ({
  disciplines,
  selectedDisciplines,
  onDisciplineSelect
}) => {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Book className="w-5 h-5" />
        Select Knowledge Domains
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {disciplines.map(discipline => (
          <Card 
            key={discipline.id}
            className={`p-4 cursor-pointer transition-all duration-300 hover:scale-105 ${
              selectedDisciplines.includes(discipline.id)
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 border-2 border-white shadow-lg'
                : 'bg-gray-800 hover:bg-gray-700 border border-gray-600'
            }`}
            onClick={() => onDisciplineSelect(discipline.id)}
          >
            <div className="text-center">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-2"
                style={{ backgroundColor: discipline.color }}
              >
                {discipline.icon}
              </div>
              <span className="text-sm font-medium">{discipline.name}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
