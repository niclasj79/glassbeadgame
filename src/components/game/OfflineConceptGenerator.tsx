
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
      // Limit to one concept per discipline
      const actualCount = Math.min(count, disciplines.length);
      
      const concepts: Concept[] = [];
      
      // Select one concept per discipline from local data
      for (let i = 0; i < disciplines.length && i < actualCount; i++) {
        const disciplineId = disciplines[i];
        const availableConcepts = conceptDatabase[disciplineId as keyof typeof conceptDatabase] || [];
        
        // Filter out used concepts
        const unusedConcepts = availableConcepts.filter(concept => !this.usedConcepts.has(concept));
        
        // Reset if no unused concepts available
        if (unusedConcepts.length === 0) {
          this.usedConcepts.clear();
          unusedConcepts.push(...availableConcepts);
        }

        if (unusedConcepts.length > 0) {
          const selectedConceptText = unusedConcepts[Math.floor(Math.random() * unusedConcepts.length)];
          this.usedConcepts.add(selectedConceptText);

          const position = PositionGenerator.generateSpherePosition();
          const energy = PositionGenerator.generateEnergy();

          concepts.push({
            id: `concept-${disciplineId}-${i}-${Date.now()}`,
            text: selectedConceptText,
            discipline: disciplineId,
            ...position,
            energy,
            connections: []
          });
        }
      }

      // Generate connections between ALL concepts
      this.generateConnections(concepts);

      console.log(`Generated ${concepts.length} offline concepts for disciplines:`, disciplines);
      return concepts;
    } catch (error) {
      console.error('Error in offline generateConcepts:', error);
      
      // Fallback to basic concept generation
      return this.generateFallbackConcepts(disciplines, Math.min(count, disciplines.length));
    }
  }

  private generateFallbackConcepts(disciplines: string[], count: number): Concept[] {
    const concepts: Concept[] = [];
    
    for (let i = 0; i < count && i < disciplines.length; i++) {
      const disciplineId = disciplines[i];
      const position = PositionGenerator.generateSpherePosition();
      const energy = PositionGenerator.generateEnergy();

      concepts.push({
        id: `fallback-${disciplineId}-${i}-${Date.now()}`,
        text: `${disciplineId.charAt(0).toUpperCase() + disciplineId.slice(1)} Concept ${i + 1}`,
        discipline: disciplineId,
        ...position,
        energy,
        connections: []
      });
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
