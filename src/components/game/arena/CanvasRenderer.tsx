
import React, { useRef, useEffect, useState } from 'react';
import { Concept, DimensionalMapping } from './types';
import { useInteractions } from './useInteractions';
import { BackgroundRenderer } from './renderers/BackgroundRenderer';
import { SphereRenderer } from './renderers/SphereRenderer';
import { ConceptRenderer } from './renderers/ConceptRenderer';
import { ConnectionRenderer } from './renderers/ConnectionRenderer';
import { DimensionalRenderer } from './renderers/DimensionalRenderer';
import { DimensionalDisplay } from './DimensionalDisplay';
import { SynthesisEngine } from './SynthesisEngine';

interface CanvasRendererProps {
  concepts: Concept[];
  disciplines: any[];
  isPaused: boolean;
  selectedConcept: string | null;
  onConceptClick: (conceptId: string) => void;
  onConceptMove: (conceptId: string, newX: number, newY: number, newZ: number) => void;
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  concepts,
  disciplines,
  isPaused,
  selectedConcept,
  onConceptClick,
  onConceptMove
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [showDimensionalOverlay, setShowDimensionalOverlay] = useState(true);

  const dimensionalMapping: DimensionalMapping = {
    x: { label: "Analytical ↔ Intuitive", description: "From analytical reasoning to intuitive understanding" },
    y: { label: "Theoretical ↔ Practical", description: "From theoretical concepts to practical applications" },
    z: { label: "Abstract ↔ Concrete", description: "From abstract ideas to concrete manifestations" }
  };

  const {
    rotationRef,
    dragState,
    interactionMode,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    getCursor
  } = useInteractions(concepts, onConceptClick, onConceptMove);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const draw = () => {
      // Render background
      BackgroundRenderer.render(ctx, canvas);
      
      // Render dimensional grid and axes (if enabled)
      if (showDimensionalOverlay) {
        DimensionalRenderer.render(ctx, canvas, rotationRef, dimensionalMapping);
      }
      
      // Render sphere wireframe
      SphereRenderer.render(ctx, canvas, rotationRef);
      
      // Render connections first (so they appear behind concepts)
      ConnectionRenderer.render(ctx, canvas, concepts, rotationRef);
      
      // Render concepts on top
      ConceptRenderer.render(ctx, canvas, concepts, disciplines, selectedConcept, dragState, rotationRef);
    };

    const animate = () => {
      if (!isPaused) {
        draw();
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [concepts, disciplines, isPaused, selectedConcept, rotationRef, dragState, showDimensionalOverlay]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setShowDimensionalOverlay(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ cursor: getCursor() }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      
      {/* Dimensional Display */}
      <DimensionalDisplay
        selectedConcept={selectedConcept}
        concepts={concepts}
        dimensionalMapping={dimensionalMapping}
      />
      
      {/* Synthesis Engine */}
      <SynthesisEngine
        concepts={concepts}
        className="absolute bottom-4 left-4 max-w-md"
      />
      
      {/* Controls Hint */}
      <div className="absolute bottom-4 right-4 bg-gray-800/90 backdrop-blur-sm p-3 rounded border border-gray-600">
        <div className="text-xs text-gray-300 space-y-1">
          <div>• Drag concepts to reposition them</div>
          <div>• Click empty space and drag to rotate</div>
          <div>• Press 'D' to toggle dimensional overlay</div>
          <div>• Position concepts to express meaning</div>
        </div>
      </div>
      
      {/* Dimensional Status */}
      {showDimensionalOverlay && (
        <div className="absolute top-4 left-4 bg-gray-800/90 backdrop-blur-sm p-3 rounded border border-gray-600">
          <h4 className="text-sm font-semibold text-white mb-2">Dimensional Space</h4>
          <div className="text-xs text-gray-300 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-red-400"></div>
              <span>{dimensionalMapping.x.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-green-400"></div>
              <span>{dimensionalMapping.y.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-blue-400"></div>
              <span>{dimensionalMapping.z.label}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
