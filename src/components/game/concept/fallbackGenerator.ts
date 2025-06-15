
import { Concept } from './types';
import { conceptDatabase } from './conceptData';
import { PositionGenerator } from './positionGenerator';

export class FallbackConceptGenerator {
  private usedConcepts: Set<string> = new Set();

  generateFallbackConcepts(disciplines: string[], count: number): Concept[] {
    const concepts: Concept[] = [];
    const actualCount = Math.min(count, disciplines.length);

    // Generate one concept per discipline
    for (let i = 0; i < actualCount; i++) {
      const disciplineId = disciplines[i];
      const availableConcepts = conceptDatabase[disciplineId as keyof typeof conceptDatabase] || [];
      const unusedConcepts = availableConcepts.filter(concept => !this.usedConcepts.has(concept));
      
      if (unusedConcepts.length === 0) {
        this.usedConcepts.clear();
        unusedConcepts.push(...availableConcepts);
      }

      const conceptText = unusedConcepts[Math.floor(Math.random() * unusedConcepts.length)];
      this.usedConcepts.add(conceptText);

      const position = PositionGenerator.generateSpherePosition();
      const energy = PositionGenerator.generateEnergy();

      concepts.push({
        id: `concept-${i}-${Date.now()}`,
        text: conceptText,
        discipline: disciplineId,
        ...position,
        energy,
        connections: []
      });
    }

    return concepts;
  }

  clearUsedConcepts(): void {
    this.usedConcepts.clear();
  }
}
