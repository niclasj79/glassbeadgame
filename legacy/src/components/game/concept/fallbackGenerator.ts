
import { Concept } from './types';
import { conceptDatabase } from './conceptData';
import { PositionGenerator } from './positionGenerator';

export class FallbackConceptGenerator {
  private usedConcepts: Set<string> = new Set();

  generateFallbackConcepts(disciplines: string[], count: number): Concept[] {
    const concepts: Concept[] = [];
    const conceptsPerDiscipline = Math.ceil(count / disciplines.length);

    // Generate multiple concepts per discipline
    for (const disciplineId of disciplines) {
      const availableConcepts = conceptDatabase[disciplineId as keyof typeof conceptDatabase] || [];
      let unusedConcepts = availableConcepts.filter(concept => !this.usedConcepts.has(concept));
      
      if (unusedConcepts.length === 0) {
        this.usedConcepts.clear();
        unusedConcepts = [...availableConcepts];
      }

      const shuffled = [...unusedConcepts].sort(() => Math.random() - 0.5);
      const toSelect = shuffled.slice(0, conceptsPerDiscipline);

      for (let i = 0; i < toSelect.length && concepts.length < count; i++) {
        this.usedConcepts.add(toSelect[i]);

        const position = PositionGenerator.generateSpherePosition();
        const energy = PositionGenerator.generateEnergy();

        concepts.push({
          id: `concept-${concepts.length}-${Date.now()}`,
          text: toSelect[i],
          discipline: disciplineId,
          ...position,
          energy,
          connections: []
        });
      }
      if (concepts.length >= count) break;
    }

    return concepts;
  }

  clearUsedConcepts(): void {
    this.usedConcepts.clear();
  }
}
