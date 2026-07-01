
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

export interface ConceptDatabaseEntry {
  id: string;
  text: string;
  discipline_id: string;
  disciplines: {
    id: string;
    name: string;
    color: string;
    icon: string;
  };
}
