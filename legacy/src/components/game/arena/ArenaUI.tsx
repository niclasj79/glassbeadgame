import React from 'react';
import { Concept, DimensionalMapping } from './types';
import { DimensionalDisplay } from './DimensionalDisplay';

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
      {showDimensionalOverlay && (
        <div className="hidden md:block">
          <DimensionalDisplay
            selectedConcept={selectedConcept}
            concepts={concepts}
            dimensionalMapping={dimensionalMapping}
          />
        </div>
      )}

      {/* Minimal controls hint */}
      <div className="absolute bottom-4 right-4 game-surface backdrop-blur-sm p-2 rounded-lg max-w-xs opacity-60 hover:opacity-100 transition-opacity">
        <div className="text-xs game-text-dim space-y-0.5">
          <div className="hidden md:block">Drag beads together to discover connections</div>
          <div className="md:hidden">Touch & drag beads together</div>
          <div className="hidden md:block text-xs opacity-60">Press 'D' for dimensional overlay</div>
        </div>
      </div>

      {/* Dimensional Status */}
      {showDimensionalOverlay && (
        <div className="absolute top-16 left-4 game-surface backdrop-blur-sm p-2 rounded-lg max-w-xs">
          <h4 className="text-xs font-semibold game-text-bright mb-1">Dimensions</h4>
          <div className="text-xs game-text-dim space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-0.5 bg-red-400" />
              <span>{dimensionalMapping.x.positive} ↔ {dimensionalMapping.x.negative}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-0.5 bg-green-400" />
              <span>{dimensionalMapping.y.positive} ↔ {dimensionalMapping.y.negative}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-0.5 bg-blue-400" />
              <span>{dimensionalMapping.z.positive} ↔ {dimensionalMapping.z.negative}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
