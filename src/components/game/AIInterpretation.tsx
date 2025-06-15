
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Download, Share2, RotateCcw } from 'lucide-react';

interface AIInterpretationProps {
  sessionData: SessionData;
  onNewSession: () => void;
  onBackToMenu: () => void;
}

interface SessionData {
  disciplines: string[];
  concepts: any[];
  interactions: Interaction[];
  duration: number;
  sessionType: string;
}

interface Interaction {
  conceptId: string;
  action: string;
  timestamp: number;
}

export const AIInterpretation: React.FC<AIInterpretationProps> = ({
  sessionData,
  onNewSession,
  onBackToMenu
}) => {
  const [interpretation, setInterpretation] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    generateInterpretation();
  }, [sessionData]);

  const generateInterpretation = async () => {
    setIsGenerating(true);
    
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    const interpretation = generateConceptualInterpretation(sessionData);
    setInterpretation(interpretation);
    setIsGenerating(false);
  };

  const generateConceptualInterpretation = (data: SessionData): string => {
    const { disciplines, concepts, interactions, duration, sessionType } = data;
    
    // Analyze conceptual movements and relationships
    const moveInteractions = interactions.filter(i => i.action === 'move');
    const conceptMovements = new Map();
    
    moveInteractions.forEach(interaction => {
      const concept = concepts.find(c => c.id === interaction.conceptId);
      if (concept) {
        if (!conceptMovements.has(concept.text)) {
          conceptMovements.set(concept.text, []);
        }
        conceptMovements.get(concept.text).push(interaction);
      }
    });

    const activeConcepts = Array.from(conceptMovements.keys());
    const disciplineNames = disciplines.map(d => d.charAt(0).toUpperCase() + d.slice(1));
    
    // Generate real-world analogies
    const realWorldAnalogies = [
      "the formation of a complex ecosystem where predator-prey relationships establish dynamic equilibrium",
      "the emergence of a jazz ensemble where individual musicians create spontaneous harmonic structures",
      "the crystallization of a mineral where atomic forces arrange themselves into geometric patterns",
      "the development of a city where economic, social, and cultural forces shape urban morphology",
      "the evolution of a symphony where musical themes undergo transformation and recombination",
      "the formation of a weather system where atmospheric pressures create emergent meteorological phenomena",
      "the growth of a coral reef where biological and chemical processes build complex architectural forms",
      "the emergence of a language where phonetic, semantic, and syntactic elements coalesce into meaning",
      "the development of a river delta where geological and hydrological forces create branching networks",
      "the formation of a neural network where synaptic connections establish pathways of information flow"
    ];

    const selectedAnalogy = realWorldAnalogies[Math.floor(Math.random() * realWorldAnalogies.length)];
    
    // Generate movement descriptions
    const movementDescriptions = [
      "gravitational convergence toward points of conceptual density",
      "orbital trajectories that trace the boundaries between different knowledge domains",
      "tidal movements that reveal the underlying currents connecting disparate ideas",
      "crystalline arrangements that express the inherent symmetries between concepts",
      "fluid dynamics where ideas flow along paths of least intellectual resistance",
      "magnetic field patterns that make visible the invisible forces between concepts",
      "seismic shifts that redistribute the conceptual landscape",
      "atmospheric circulation where ideas condense, evaporate, and precipitate in new configurations"
    ];

    const selectedMovement = movementDescriptions[Math.floor(Math.random() * movementDescriptions.length)];

    // Generate the interpretation
    const interpretations = [
      `This performance manifested as a three-dimensional meditation on the relationships between ${activeConcepts.slice(0, 3).join(', ')}${activeConcepts.length > 3 ? ', and others' : ''}. The spatial choreography revealed ${selectedMovement}, creating a conceptual architecture that mirrors ${selectedAnalogy}. 

      The movement patterns suggest an underlying tension between ${disciplineNames[0]} and ${disciplineNames[1] || disciplineNames[0]}, where concepts migrated through dimensional space seeking equilibrium between opposing forces of ${sessionData.concepts[0]?.discipline === 'philosophy' ? 'abstract reasoning and concrete application' : 'analytical precision and intuitive understanding'}. 

      Like the way ${selectedAnalogy.split(' ').slice(0, 8).join(' ')}, the conceptual constellation formed during this session exhibited emergent properties that transcended the sum of its individual elements. The ${Math.floor(duration / 60)}-minute duration allowed for a complete cycle of intellectual transformation, where initial conceptual positions gave way to more sophisticated arrangements.

      This performance can be understood as a living demonstration of how knowledge structures themselves when freed from the constraints of linear thinking. The concepts did not merely coexist in space but actively influenced each other's positioning, creating what we might call a 'cognitive field' - a zone where ideas exert mutual influence across the three fundamental dimensions of truth, beauty, and goodness.`,

      `The session unfolded as an exploration of the hidden geometries that connect ${activeConcepts.slice(0, 2).join(' and ')}, revealing patterns analogous to ${selectedAnalogy}. Through ${interactions.length} distinct interactions, the performance traced ${selectedMovement}, suggesting that these concepts share an underlying structural affinity that becomes visible only when they are allowed to move freely through multidimensional space.

      The trajectory of ${activeConcepts[0] || 'the primary concept'} through the arena created a pathway that illuminated the relationship between ${disciplineNames[0]} and ${disciplineNames[1] || 'unified knowledge'}. This movement pattern resembles the way ${selectedAnalogy.split('where')[1] || 'complex systems self-organize into stable yet dynamic configurations'}, indicating that the session achieved a state of conceptual resonance.

      What emerged was not simply a mapping of ideas, but a dynamic sculpture of thought - a temporal form that existed only during the session's duration yet expressed truths about the nature of interdisciplinary connection. The concepts' final positions suggested a configuration of maximum mutual illumination, where each idea's meaning was amplified by its spatial relationship to the others.

      This performance demonstrates how intellectual synthesis occurs not through logical deduction alone, but through the kind of three-dimensional play that allows concepts to discover their natural affinities and tensions. The result is a unique cognitive artifact that captures a moment of understanding impossible to achieve through traditional linear analysis.`,

      `In this ${duration}-second performance, the interplay between ${activeConcepts.join(', ')} created a conceptual field that exhibited properties similar to ${selectedAnalogy}. The spatial dynamics revealed ${selectedMovement}, suggesting an underlying order that emerges when disciplinary boundaries dissolve and ideas are allowed to find their natural relationships.

      The movement patterns traced by these concepts through the three dimensions created what we might call a 'knowledge topology' - a landscape where proximity indicates conceptual affinity and distance reveals intellectual tension. The session's choreography suggested that ${activeConcepts[0]} serves as a kind of conceptual attractor, drawing ${activeConcepts.slice(1).join(' and ')} into new configurations of meaning.

      This arrangement mirrors ${selectedAnalogy} in its capacity to generate emergent properties that cannot be predicted from the individual components alone. The performance created a temporary intellectual ecosystem where ideas evolved in real-time, adapting to their conceptual environment and forming new relationships based on their essential natures rather than their traditional academic classifications.

      The final configuration represents a stable yet dynamic equilibrium - a moment where the concepts achieved maximum mutual illumination while maintaining their individual integrity. This session demonstrates how the Glass Bead Game functions as both analytical tool and creative medium, revealing the hidden architectures that connect human knowledge across all domains of understanding.`
    ];

    return interpretations[Math.floor(Math.random() * interpretations.length)];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black text-white flex items-center justify-center">
        <Card className="bg-gray-900 border-gray-700 p-8 max-w-2xl w-full text-center">
          <div className="animate-spin w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2">
            <Brain className="w-6 h-6" />
            Analyzing Conceptual Movements
          </h2>
          <p className="text-gray-300">
            Interpreting the three-dimensional relationships and emergent patterns...
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Performance Analysis
          </h1>
          <div className="text-gray-300 mb-6">
            <span className="text-lg">Duration: {formatDuration(sessionData.duration)}</span>
            <span className="mx-4">•</span>
            <span className="text-lg">{sessionData.interactions.length} Interactions</span>
            <span className="mx-4">•</span>
            <span className="text-lg capitalize">{sessionData.sessionType}</span>
          </div>
        </div>

        <Card className="bg-gray-900/80 border-gray-700 p-8 mb-6 backdrop-blur-sm">
          <div className="prose prose-invert max-w-none">
            <div className="text-lg leading-relaxed text-gray-200 whitespace-pre-line">
              {interpretation}
            </div>
          </div>
        </Card>

        <Card className="bg-gray-900/80 border-gray-700 p-6 mb-6 backdrop-blur-sm">
          <h3 className="text-xl font-semibold mb-4 text-white">Engaged Disciplines</h3>
          <div className="flex flex-wrap gap-3">
            {sessionData.disciplines.map(discipline => (
              <div key={discipline} className="bg-gradient-to-r from-purple-600/30 to-blue-600/30 border border-purple-400/50 px-4 py-2 rounded-full">
                <span className="text-white font-medium">
                  {discipline.charAt(0).toUpperCase() + discipline.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex justify-center gap-4">
          <Button
            onClick={onNewSession}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-6 py-3"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            New Session
          </Button>
          <Button
            variant="outline"
            onClick={() => navigator.share && navigator.share({ 
              title: 'Glass Bead Game Performance', 
              text: interpretation.slice(0, 200) + '...' 
            })}
            className="border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white px-6 py-3"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button
            variant="outline"
            onClick={onBackToMenu}
            className="border-gray-400 text-gray-400 hover:bg-gray-400 hover:text-white px-6 py-3"
          >
            Main Menu
          </Button>
        </div>
      </div>
    </div>
  );
};
