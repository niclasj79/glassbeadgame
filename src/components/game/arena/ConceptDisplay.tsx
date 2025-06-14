
import React from 'react';
import { Concept } from './types';

interface ConceptDisplayProps {
  selectedConcept: string | null;
  concepts: Concept[];
}

export const ConceptDisplay: React.FC<ConceptDisplayProps> = ({
  selectedConcept,
  concepts
}) => {
  if (!selectedConcept) return null;

  const concept = concepts.find(c => c.id === selectedConcept);
  if (!concept) return null;

  return (
    <div className="absolute top-4 right-4 bg-gray-800 p-4 rounded-lg border border-gray-600 max-w-xs">
      <h4 className="font-semibold mb-2">Selected Concept</h4>
      <p className="text-sm text-gray-300">
        {concept.text}
      </p>
    </div>
  );
};
