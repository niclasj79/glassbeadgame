
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Concept, DimensionalMapping } from './types';
import { calculateDimensionalValues } from './utils';

interface DimensionalDisplayProps {
  selectedConcept: string | null;
  concepts: Concept[];
  dimensionalMapping: DimensionalMapping;
}

export const DimensionalDisplay: React.FC<DimensionalDisplayProps> = ({
  selectedConcept,
  concepts,
  dimensionalMapping
}) => {
  if (!selectedConcept) return null;

  const concept = concepts.find(c => c.id === selectedConcept);
  if (!concept) return null;

  const dimensionalValues = calculateDimensionalValues(concept.x, concept.y, concept.z);

  const formatValue = (value: number) => Math.round(value * 100);

  return (
    <Card className="absolute top-4 right-4 bg-gray-800/90 backdrop-blur-sm p-4 border border-gray-600 max-w-xs">
      <h4 className="font-semibold mb-3 text-white">Concept Dimensions</h4>
      
      <div className="space-y-3">
        <div className="text-sm">
          <div className="text-gray-300 mb-1">{concept.text}</div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-red-300">{dimensionalMapping.x.label}</span>
            <Badge variant="outline" className="border-red-400 text-red-300">
              {formatValue(dimensionalValues.analytical_intuitive)}%
            </Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-xs text-green-300">{dimensionalMapping.y.label}</span>
            <Badge variant="outline" className="border-green-400 text-green-300">
              {formatValue(dimensionalValues.theoretical_practical)}%
            </Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-xs text-blue-300">{dimensionalMapping.z.label}</span>
            <Badge variant="outline" className="border-blue-400 text-blue-300">
              {formatValue(dimensionalValues.abstract_concrete)}%
            </Badge>
          </div>
        </div>
        
        <div className="text-xs text-gray-400 mt-3">
          Position: ({Math.round(concept.x)}, {Math.round(concept.y)}, {Math.round(concept.z)})
        </div>
      </div>
    </Card>
  );
};
