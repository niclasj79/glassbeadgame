
import React from 'react';
import { Concept, DimensionalMapping } from './types';
import { DimensionalDisplay } from './DimensionalDisplay';
import { SynthesisEngine } from './SynthesisEngine';

interface ArenaUIProps {
  selectedConcept: string | null;
  concepts: Concept[];
  dimensionalMapping: DimensionalMapping;
  showDimensionalOverlay: boolean;
}

export const ArenaUI: React.FC<ArenaUIProps> = ({
  selectedConcept,
  concepts,
  dimensionalMapping,
  showDimensionalOverlay,
}) => {
  return (
    <>
      {/* Dimensional Display - Hidden on small screens */}
      <div className="hidden md:block">
        <DimensionalDisplay
          selectedConcept={selectedConcept}
          concepts={concepts}
          dimensionalMapping={dimensionalMapping}
        />
      </div>
      
      {/* Synthesis Engine - Made responsive */}
      <div className="hidden lg:block">
        <SynthesisEngine
          concepts={concepts}
          className="absolute bottom-4 left-4 max-w-md"
        />
      </div>
      
      {/* Controls Hint - Made responsive */}
      <div className="absolute bottom-4 right-4 bg-gray-800/90 backdrop-blur-sm p-2 md:p-3 rounded border border-gray-600 max-w-xs">
        <div className="text-xs text-gray-300 space-y-1">
          <div className="hidden md:block">• Drag concepts to reposition them</div>
          <div className="md:hidden">• Touch concepts to move them</div>
          <div className="hidden md:block">• Click empty space and drag to rotate</div>
          <div className="md:hidden">• Use two fingers to rotate</div>
          <div className="hidden md:block">• Press 'D' to toggle dimensional overlay</div>
          <div>• Position concepts to express meaning</div>
        </div>
      </div>
      
      {/* Dimensional Status - Made responsive */}
      {showDimensionalOverlay && (
        <div className="absolute top-4 left-4 bg-gray-800/90 backdrop-blur-sm p-2 md:p-3 rounded border border-gray-600 max-w-xs">
          <h4 className="text-sm font-semibold text-white mb-2">The Big Three</h4>
          <div className="text-xs text-gray-300 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-red-400"></div>
              <span className="truncate">{dimensionalMapping.x.positive} ↔ {dimensionalMapping.x.negative}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-green-400"></div>
              <span className="truncate">{dimensionalMapping.y.positive} ↔ {dimensionalMapping.y.negative}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-blue-400"></div>
              <span className="truncate">{dimensionalMapping.z.positive} ↔ {dimensionalMapping.z.negative}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
