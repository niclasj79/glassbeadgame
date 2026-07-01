
import React from 'react';
import { Concept } from './concept/types';
import { PositionGenerator } from './concept/positionGenerator';
import { synthesisGenerator } from './concept/synthesisGenerator';
import { conceptDatabase } from './concept/conceptData';

export type { Concept } from './concept/types';

export class OfflineConceptGenerator {
  private usedConcepts: Set<string> = new Set();

  async generateConcepts(disciplines: string[], count: number = 12): Promise<Concept[]> {
    try {
      const concepts: Concept[] = [];
      const conceptsPerDiscipline = Math.ceil(count / disciplines.length);
      
      // Select multiple concepts per discipline from local data
      for (const disciplineId of disciplines) {
        const availableConcepts = conceptDatabase[disciplineId as keyof typeof conceptDatabase] || [];
        
        let unusedConcepts = availableConcepts.filter(concept => !this.usedConcepts.has(concept));
        
        if (unusedConcepts.length === 0) {
          this.usedConcepts.clear();
          unusedConcepts = [...availableConcepts];
        }

        const shuffled = [...unusedConcepts].sort(() => Math.random() - 0.5);
        const toSelect = shuffled.slice(0, conceptsPerDiscipline);

        for (const conceptText of toSelect) {
          if (concepts.length >= count) break;
          this.usedConcepts.add(conceptText);

          const position = PositionGenerator.generateSpherePosition();
          const energy = PositionGenerator.generateEnergy();

          concepts.push({
            id: `concept-${disciplineId}-${concepts.length}-${Date.now()}`,
            text: conceptText,
            discipline: disciplineId,
            ...position,
            energy,
            connections: []
          });
        }
        if (concepts.length >= count) break;
      }

      // Generate connections between ALL concepts
      this.generateConnections(concepts);

      console.log(`Generated ${concepts.length} offline concepts for disciplines:`, disciplines);
      return concepts;
    } catch (error) {
      console.error('Error in offline generateConcepts:', error);
      
      // Fallback to basic concept generation
      return this.generateFallbackConcepts(disciplines, count);
    }
  }

  private generateFallbackConcepts(disciplines: string[], count: number): Concept[] {
    const concepts: Concept[] = [];
    const conceptsPerDiscipline = Math.ceil(count / disciplines.length);
    
    for (const disciplineId of disciplines) {
      for (let i = 0; i < conceptsPerDiscipline && concepts.length < count; i++) {
      const position = PositionGenerator.generateSpherePosition();
      const energy = PositionGenerator.generateEnergy();

      concepts.push({
          id: `fallback-${disciplineId}-${concepts.length}-${Date.now()}`,
          text: `${disciplineId.charAt(0).toUpperCase() + disciplineId.slice(1)} Concept ${concepts.length + 1}`,
          discipline: disciplineId,
          ...position,
          energy,
          connections: []
        });
      }
    }

    this.generateConnections(concepts);
    return concepts;
  }

  private generateConnections(concepts: Concept[]): void {
    // Connect each concept to every other concept
    for (let i = 0; i < concepts.length; i++) {
      for (let j = i + 1; j < concepts.length; j++) {
        const concept1 = concepts[i];
        const concept2 = concepts[j];
        
        // Add bidirectional connections
        if (!concept1.connections.includes(concept2.id)) {
          concept1.connections.push(concept2.id);
        }
        if (!concept2.connections.includes(concept1.id)) {
          concept2.connections.push(concept1.id);
        }
      }
    }
  }

  generateCrossConnections(concepts: Concept[], disciplines: string[]): string[] {
    return synthesisGenerator.generateCrossConnections(concepts, disciplines);
  }

  clearUsedConcepts(): void {
    this.usedConcepts.clear();
  }
}

export const offlineConceptGenerator = new OfflineConceptGenerator();
