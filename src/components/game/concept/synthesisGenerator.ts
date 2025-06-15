
import { Concept } from './types';

export class SynthesisGenerator {
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

export const synthesisGenerator = new SynthesisGenerator();
