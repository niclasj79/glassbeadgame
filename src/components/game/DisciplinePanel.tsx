
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface DisciplinePanelProps {
  selectedDisciplines: string[];
  disciplines: any[];
  onDisciplineInteract: (disciplineId: string) => void;
}

export const DisciplinePanel: React.FC<DisciplinePanelProps> = ({
  selectedDisciplines,
  disciplines,
  onDisciplineInteract
}) => {
  const activeDisciplines = disciplines.filter(d => selectedDisciplines.includes(d.id));

  const getDisciplineData = (disciplineId: string) => {
    const baseData = {
      mathematics: {
        concepts: ['Topology', 'Group Theory', 'Category Theory', 'Fractals'],
        energy: Math.random() * 100,
        resonance: Math.random() * 100,
        connections: Math.floor(Math.random() * 10)
      },
      music: {
        concepts: ['Harmonic Series', 'Counterpoint', 'Spectral Analysis', 'Rhythmic Patterns'],
        energy: Math.random() * 100,
        resonance: Math.random() * 100,
        connections: Math.floor(Math.random() * 10)
      },
      philosophy: {
        concepts: ['Phenomenology', 'Dialectics', 'Hermeneutics', 'Ontology'],
        energy: Math.random() * 100,
        resonance: Math.random() * 100,
        connections: Math.floor(Math.random() * 10)
      },
      physics: {
        concepts: ['Quantum Mechanics', 'Relativity', 'Thermodynamics', 'Field Theory'],
        energy: Math.random() * 100,
        resonance: Math.random() * 100,
        connections: Math.floor(Math.random() * 10)
      },
      art: {
        concepts: ['Color Theory', 'Composition', 'Perspective', 'Symbolism'],
        energy: Math.random() * 100,
        resonance: Math.random() * 100,
        connections: Math.floor(Math.random() * 10)
      }
    };
    return baseData[disciplineId as keyof typeof baseData] || baseData.mathematics;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white mb-3">Active Disciplines</h3>
      
      {activeDisciplines.map(discipline => {
        const data = getDisciplineData(discipline.id);
        
        return (
          <Card key={discipline.id} className="bg-gray-800 border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: discipline.color }}
                >
                  {discipline.icon}
                </div>
                <h4 className="font-semibold text-white">{discipline.name}</h4>
              </div>
              <Badge variant="outline" className="text-xs">
                {data.connections} connections
              </Badge>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Energy</span>
                  <span className="text-white">{Math.round(data.energy)}%</span>
                </div>
                <Progress value={data.energy} className="h-2" />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Resonance</span>
                  <span className="text-white">{Math.round(data.resonance)}%</span>
                </div>
                <Progress value={data.resonance} className="h-2" />
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-2">Active Concepts:</p>
                <div className="flex flex-wrap gap-1">
                  {data.concepts.map(concept => (
                    <Badge 
                      key={concept} 
                      variant="secondary" 
                      className="text-xs bg-gray-700 text-gray-300"
                    >
                      {concept}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-3 border-gray-600 text-gray-300 hover:bg-gray-700"
                onClick={() => onDisciplineInteract(discipline.id)}
              >
                Modulate Field
              </Button>
            </div>
          </Card>
        );
      })}

      {activeDisciplines.length === 0 && (
        <Card className="bg-gray-800 border-gray-700 p-6 text-center">
          <p className="text-gray-400">
            Select disciplines above to activate their energy fields
          </p>
        </Card>
      )}
    </div>
  );
};
