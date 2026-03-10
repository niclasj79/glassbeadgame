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

  async generateConcepts(
    disciplines: string[], 
    count: number = 12, 
    selectedConcepts?: { [disciplineId: string]: string }
  ): Promise<Concept[]> {
    try {
      // If specific concepts were selected, use those
      if (selectedConcepts) {
        return this.generateFromSelectedConcepts(disciplines, selectedConcepts);
      }
      
      // Fetch concepts from Supabase based on selected disciplines
      const dbConcepts = await conceptDatabaseService.fetchConcepts(disciplines);

      if (!dbConcepts || dbConcepts.length === 0) {
        return this.fallbackGenerator.generateFallbackConcepts(disciplines, count);
      }

      const concepts: Concept[] = [];
      const conceptsPerDiscipline = Math.ceil(count / disciplines.length);
      
      // Select multiple concepts per discipline to fill the arena
      for (const disciplineId of disciplines) {
        let disciplineConcepts = dbConcepts.filter(concept => 
          concept.discipline_id === disciplineId && 
          !this.usedConcepts.has(concept.text)
        );

        if (disciplineConcepts.length === 0) {
          this.usedConcepts.clear();
          disciplineConcepts = dbConcepts.filter(concept => 
            concept.discipline_id === disciplineId
          );
        }

        // Shuffle and pick up to conceptsPerDiscipline
        const shuffled = [...disciplineConcepts].sort(() => Math.random() - 0.5);
        const toSelect = shuffled.slice(0, conceptsPerDiscipline);

        for (const selectedConcept of toSelect) {
          if (concepts.length >= count) break;
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
        if (concepts.length >= count) break;
      }

      // Generate connections between ALL concepts
      this.generateConnections(concepts);

      return concepts;
    } catch (error) {
      console.error('Error in generateConcepts:', error);
      return this.fallbackGenerator.generateFallbackConcepts(disciplines, Math.min(count, disciplines.length));
    }
  }

  private generateFromSelectedConcepts(
    disciplines: string[], 
    selectedConcepts: { [disciplineId: string]: string }
  ): Concept[] {
    const concepts: Concept[] = [];

    disciplines.forEach(disciplineId => {
      const conceptText = selectedConcepts[disciplineId];
      if (conceptText) {
        const position = PositionGenerator.generateSpherePosition();
        const energy = PositionGenerator.generateEnergy();

        concepts.push({
          id: `selected-${disciplineId}-${Date.now()}-${Math.random()}`,
          text: conceptText,
          discipline: disciplineId,
          ...position,
          energy,
          connections: []
        });
      }
    });

    // Generate connections between ALL concepts
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
}

export const conceptGenerator = new ConceptGenerator();
