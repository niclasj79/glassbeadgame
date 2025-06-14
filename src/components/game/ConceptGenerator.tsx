
import React from 'react';

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

const conceptDatabase = {
  mathematics: [
    'Fibonacci Sequence', 'Golden Ratio', 'Infinite Series', 'Topology', 'Prime Numbers',
    'Chaos Theory', 'Fractals', 'Set Theory', 'Number Theory', 'Geometry',
    'Calculus', 'Statistics', 'Probability', 'Graph Theory', 'Abstract Algebra'
  ],
  music: [
    'Harmonic Resonance', 'Counterpoint', 'Modulation', 'Rhythm Patterns', 'Melody Structure',
    'Timbre', 'Dynamics', 'Consonance', 'Dissonance', 'Musical Form',
    'Improvisation', 'Polyrhythm', 'Modal Scales', 'Overtones', 'Syncopation'
  ],
  philosophy: [
    'Consciousness', 'Free Will', 'Ethics', 'Truth', 'Beauty',
    'Justice', 'Reality', 'Knowledge', 'Existence', 'Meaning',
    'Dialectics', 'Phenomenology', 'Ontology', 'Epistemology', 'Metaphysics'
  ],
  physics: [
    'Quantum Entanglement', 'Wave-Particle Duality', 'Relativity', 'Thermodynamics', 'Electromagnetic Fields',
    'String Theory', 'Dark Matter', 'Energy Conservation', 'Momentum', 'Gravity',
    'Nuclear Forces', 'Particle Physics', 'Cosmology', 'Fluid Dynamics', 'Optics'
  ],
  art: [
    'Color Theory', 'Composition', 'Perspective', 'Light and Shadow', 'Texture',
    'Form', 'Movement', 'Balance', 'Contrast', 'Harmony',
    'Symbolism', 'Abstract Expression', 'Realism', 'Surrealism', 'Minimalism'
  ],
  history: [
    'Cultural Evolution', 'Social Movements', 'Power Structures', 'Revolution', 'Democracy',
    'Civilization', 'Trade Routes', 'Diplomacy', 'Warfare', 'Renaissance',
    'Enlightenment', 'Industrial Revolution', 'Globalization', 'Colonialism', 'Human Rights'
  ]
};

export class ConceptGenerator {
  private usedConcepts: Set<string> = new Set();

  generateConcepts(disciplines: string[], count: number = 12): Concept[] {
    const concepts: Concept[] = [];
    const sphereRadius = 180;

    for (let i = 0; i < count; i++) {
      const disciplineId = disciplines[Math.floor(Math.random() * disciplines.length)];
      const availableConcepts = conceptDatabase[disciplineId as keyof typeof conceptDatabase] || [];
      const unusedConcepts = availableConcepts.filter(concept => !this.usedConcepts.has(concept));
      
      if (unusedConcepts.length === 0) {
        // Reset if we've used all concepts
        this.usedConcepts.clear();
        unusedConcepts.push(...availableConcepts);
      }

      const conceptText = unusedConcepts[Math.floor(Math.random() * unusedConcepts.length)];
      this.usedConcepts.add(conceptText);

      // Generate position on sphere surface
      const phi = Math.random() * Math.PI * 2; // Azimuth
      const theta = Math.acos(2 * Math.random() - 1); // Polar angle (uniform distribution)
      
      const x = sphereRadius * Math.sin(theta) * Math.cos(phi);
      const y = sphereRadius * Math.sin(theta) * Math.sin(phi);
      const z = sphereRadius * Math.cos(theta);

      concepts.push({
        id: `concept-${i}-${Date.now()}`,
        text: conceptText,
        discipline: disciplineId,
        x,
        y,
        z,
        energy: 0.3 + Math.random() * 0.7,
        connections: []
      });
    }

    // Generate some random connections
    const connectionCount = Math.floor(count * 0.3);
    for (let i = 0; i < connectionCount; i++) {
      const concept1 = concepts[Math.floor(Math.random() * concepts.length)];
      const concept2 = concepts[Math.floor(Math.random() * concepts.length)];
      
      if (concept1.id !== concept2.id && !concept1.connections.includes(concept2.id)) {
        concept1.connections.push(concept2.id);
        concept2.connections.push(concept1.id);
      }
    }

    return concepts;
  }

  generateCrossConnections(concepts: Concept[], disciplines: string[]): string[] {
    const connections = [];
    const crossDisciplinaryConcepts = concepts.filter(c => 
      disciplines.includes(c.discipline)
    );

    for (let i = 0; i < crossDisciplinaryConcepts.length - 1; i++) {
      for (let j = i + 1; j < crossDisciplinaryConcepts.length; j++) {
        const concept1 = crossDisciplinaryConcepts[i];
        const concept2 = crossDisciplinaryConcepts[j];
        
        if (concept1.discipline !== concept2.discipline && Math.random() > 0.7) {
          connections.push(`${concept1.text} ↔ ${concept2.text}: ${this.generateSynthesisInsight(concept1, concept2)}`);
        }
      }
    }

    return connections;
  }

  private generateSynthesisInsight(concept1: Concept, concept2: Concept): string {
    const insights = [
      `Both reveal patterns of ${['harmony', 'structure', 'emergence', 'transformation', 'resonance'][Math.floor(Math.random() * 5)]}`,
      `Shared ${['rhythm', 'geometry', 'balance', 'tension', 'flow'][Math.floor(Math.random() * 5)]} creates new understanding`,
      `Convergence through ${['symmetry', 'dynamics', 'interaction', 'synthesis', 'evolution'][Math.floor(Math.random() * 5)]}`,
      `Universal ${['principles', 'patterns', 'forces', 'relationships', 'expressions'][Math.floor(Math.random() * 5)]} manifest differently`,
      `Bridge formed by ${['intuition', 'logic', 'creativity', 'analysis', 'imagination'][Math.floor(Math.random() * 5)]}`
    ];
    
    return insights[Math.floor(Math.random() * insights.length)];
  }
}

export const conceptGenerator = new ConceptGenerator();
