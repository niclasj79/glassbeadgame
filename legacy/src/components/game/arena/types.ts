export interface SphericalArenaProps {
  disciplines: any[];
  selectedDisciplines: string[];
  concepts: Concept[];
  onConceptInteraction: (conceptId: string, action: string) => void;
  onSessionEnd: () => void;
}

export interface Concept {
  id: string;
  text: string;
  discipline: string;
  x: number;
  y: number;
  z: number;
  energy: number;
  connections: string[];
}

export interface TouchInfo {
  id: number;
  x: number;
  y: number;
}

export interface MouseRef {
  x: number;
  y: number;
  isDown: boolean;
  touchId?: number;
  activeTouches: TouchInfo[];
  twoFingerRotation: boolean;
}

export interface RotationRef {
  x: number;
  y: number;
}

export interface DragState {
  isDragging: boolean;
  conceptId: string | null;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  sphereX?: number;
  sphereY?: number;
  sphereZ?: number;
  touchDragMode: boolean;
}

export type InteractionMode = 'idle' | 'rotating' | 'selecting' | 'dragging' | 'two-finger-rotating';

export interface DimensionalAxis {
  positive: string;
  negative: string;
  description: string;
}

export interface DimensionalMapping {
  x: DimensionalAxis;
  y: DimensionalAxis;
  z: DimensionalAxis;
}

// Synthesis Discovery types
export interface SynthesisDiscovery {
  id: string;
  concept1Id: string;
  concept2Id: string;
  concept1Text: string;
  concept2Text: string;
  discipline1: string;
  discipline2: string;
  insight: string;
  resonanceScore: number;
  timestamp: number;
}

export interface ProximityPair {
  concept1: Concept;
  concept2: Concept;
  distance: number;
  proximity: number; // 0-1, 1 = very close
}

export interface GameScore {
  totalResonance: number;
  discoveriesCount: number;
  uniquePairsCount: number;
  rank: string;
}
