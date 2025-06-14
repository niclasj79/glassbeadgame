
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

export interface MouseRef {
  x: number;
  y: number;
  isDown: boolean;
}

export interface RotationRef {
  x: number;
  y: number;
}
