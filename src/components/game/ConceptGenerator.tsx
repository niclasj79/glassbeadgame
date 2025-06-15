
import React from 'react';
import { Concept } from './concept/types';
import { conceptDatabaseService } from './concept/conceptDatabase';
import { PositionGenerator } from './concept/positionGenerator';
import { synthesisGenerator } from './concept/synthesisGenerator';
import { FallbackConceptGenerator } from './concept/fallbackGenerator';

export type { Concept } from './concept/types';

export class ConceptGenerator {
  private usedConcepts: Set<string> = new Set();
  private fallbackGenerator = new FallbackConceptGenerator();

  async generateConcepts(disciplines: string[], count: number = 12): Promise<Concept[]> {
    try {
      // Limit to one concept per discipline
      const actualCount = Math.min(count, disciplines.length);
      
      // Fetch concepts from Supabase based on selected disciplines
      const dbConcepts = await conceptDatabaseService.fetchConcepts(disciplines);

      if (!dbConcepts || dbConcepts.length === 0) {
        return this.fallbackGenerator.generateFallbackConcepts(disciplines, actualCount);
      }

      const concepts: Concept[] = [];
      
      // Select one concept per discipline
      for (let i = 0; i < disciplines.length && i < actualCount; i++) {
        const disciplineId = disciplines[i];
        const disciplineConcepts = dbConcepts.filter(concept => 
          concept.discipline_id === disciplineId && 
          !this.usedConcepts.has(concept.text)
        );

        if (disciplineConcepts.length === 0) {
          // If no unused concepts for this discipline, reset and try again
          this.usedConcepts.clear();
          const allDisciplineConcepts = dbConcepts.filter(concept => 
            concept.discipline_id === disciplineId
          );
          if (allDisciplineConcepts.length > 0) {
            disciplineConcepts.push(allDisciplineConcepts[0]);
          }
        }

        if (disciplineConcepts.length > 0) {
          const selectedConcept = disciplineConcepts[Math.floor(Math.random() * disciplineConcepts.length)];
          this.usedConcepts.add(selectedConcept.text);

          const position = PositionGenerator.generateSpherePosition();
          const energy = PositionGenerator.generateEnergy();

          concepts.push({
            id: selectedConcept.id,
            text: selectedConcept.text,
            discipline: selectedConcept.discipline_id,
            ...position,
            energy,
            connections: []
          });
        }
      }

      // Generate connections between ALL concepts
      this.generateConnections(concepts);

      return concepts;
    } catch (error) {
      console.error('Error in generateConcepts:', error);
      return this.fallbackGenerator.generateFallbackConcepts(disciplines, Math.min(count, disciplines.length));
    }
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
}

export const conceptGenerator = new ConceptGenerator();
