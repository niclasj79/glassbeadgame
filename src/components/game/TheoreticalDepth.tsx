
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ChevronDown, ChevronRight, Book, ExternalLink } from 'lucide-react';

interface TheoreticalDepthProps {
  disciplines: any[];
  selectedDisciplines: string[];
  explorationDepth: number;
}

export const TheoreticalDepth: React.FC<TheoreticalDepthProps> = ({
  disciplines,
  selectedDisciplines,
  explorationDepth
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [activeTheory, setActiveTheory] = useState<string | null>(null);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const theoreticalFoundations = {
    mathematics: {
      title: "Mathematical Foundations",
      theories: [
        {
          name: "Category Theory",
          description: "The mathematics of mathematics, dealing with abstract structures and relationships between them.",
          depth: 95,
          connections: ["Topology", "Logic", "Computer Science"],
          insights: [
            "Functors map between categories while preserving structure",
            "Natural transformations provide systematic ways to transform functors",
            "Topos theory connects logic and geometry through categorical semantics"
          ]
        },
        {
          name: "Topology",
          description: "The study of spatial properties preserved under continuous deformations.",
          depth: 88,
          connections: ["Geometry", "Analysis", "Physics"],
          insights: [
            "Continuity transcends metric properties",
            "Compactness captures the essence of finiteness in infinite settings",
            "Homology reveals hidden structural invariants"
          ]
        }
      ]
    },
    music: {
      title: "Musical Theory",
      theories: [
        {
          name: "Harmonic Series",
          description: "The mathematical foundation of musical harmony based on frequency ratios.",
          depth: 82,
          connections: ["Physics", "Mathematics", "Cognition"],
          insights: [
            "Simple frequency ratios create consonant intervals",
            "The overtone series determines timbral character",
            "Harmonic rhythm governs musical flow and tension"
          ]
        },
        {
          name: "Spectral Music Theory",
          description: "Composition based on the acoustic properties of sound spectra.",
          depth: 76,
          connections: ["Acoustics", "Computer Science", "Psychology"],
          insights: [
            "Timbral evolution as musical structure",
            "Micro-intervals expand harmonic possibilities",
            "Spectral analysis reveals hidden musical relationships"
          ]
        }
      ]
    },
    philosophy: {
      title: "Philosophical Foundations",
      theories: [
        {
          name: "Phenomenology",
          description: "The study of consciousness and experience as experienced from the first-person perspective.",
          depth: 91,
          connections: ["Psychology", "Cognitive Science", "Neuroscience"],
          insights: [
            "Intentionality as the mark of consciousness",
            "The lived body as the foundation of perception",
            "Temporal synthesis in the structure of experience"
          ]
        },
        {
          name: "Dialectical Thinking",
          description: "The process of reasoning through contradictions to reach higher synthesis.",
          depth: 85,
          connections: ["Logic", "History", "Social Theory"],
          insights: [
            "Thesis-antithesis-synthesis as developmental pattern",
            "Contradiction as the motor of change",
            "Negation of negation reveals deeper truths"
          ]
        }
      ]
    },
    physics: {
      title: "Physical Principles",
      theories: [
        {
          name: "Quantum Field Theory",
          description: "The quantum mechanical description of fields and particle interactions.",
          depth: 97,
          connections: ["Mathematics", "Philosophy", "Information Theory"],
          insights: [
            "Particles as excitations of underlying fields",
            "Uncertainty principle limits simultaneous measurement",
            "Entanglement reveals non-local correlations"
          ]
        },
        {
          name: "Thermodynamics",
          description: "The statistical mechanics of macroscopic systems and entropy.",
          depth: 79,
          connections: ["Information Theory", "Biology", "Economics"],
          insights: [
            "Entropy as a measure of system disorder",
            "Emergent properties from statistical behavior",
            "Time's arrow from thermodynamic irreversibility"
          ]
        }
      ]
    },
    art: {
      title: "Artistic Theory",
      theories: [
        {
          name: "Color Theory",
          description: "The science and art of using color, based on the color wheel and color harmony.",
          depth: 73,
          connections: ["Psychology", "Physics", "Neuroscience"],
          insights: [
            "Complementary colors create visual tension",
            "Color temperature affects emotional response",
            "Simultaneous contrast alters color perception"
          ]
        },
        {
          name: "Compositional Dynamics",
          description: "The arrangement of visual elements to create balance, movement, and emphasis.",
          depth: 68,
          connections: ["Mathematics", "Psychology", "Philosophy"],
          insights: [
            "Golden ratio appears in natural and artistic forms",
            "Visual weight guides viewer attention",
            "Asymmetrical balance creates dynamic tension"
          ]
        }
      ]
    }
  };

  const getActiveDisciplineTheories = () => {
    return selectedDisciplines.map(disciplineId => {
      const discipline = disciplines.find(d => d.id === disciplineId);
      const theories = theoreticalFoundations[disciplineId as keyof typeof theoreticalFoundations];
      return { discipline, theories };
    }).filter(item => item.theories);
  };

  const getSynthesisOpportunities = () => {
    if (selectedDisciplines.length < 2) return [];
    
    const opportunities = [];
    for (let i = 0; i < selectedDisciplines.length; i++) {
      for (let j = i + 1; j < selectedDisciplines.length; j++) {
        const disc1 = selectedDisciplines[i];
        const disc2 = selectedDisciplines[j];
        opportunities.push({
          disciplines: [disc1, disc2],
          title: `${disc1.charAt(0).toUpperCase() + disc1.slice(1)} ↔ ${disc2.charAt(0).toUpperCase() + disc2.slice(1)}`,
          potential: Math.random() * 100,
          description: `Synthesis between ${disc1} and ${disc2} reveals new structural patterns.`
        });
      }
    }
    return opportunities;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Theoretical Foundations</h2>
        <Badge variant="outline" className="border-purple-400 text-purple-400">
          Exploration Depth: {explorationDepth}
        </Badge>
      </div>

      <Tabs defaultValue="foundations" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-800">
          <TabsTrigger value="foundations">Foundations</TabsTrigger>
          <TabsTrigger value="synthesis">Synthesis</TabsTrigger>
          <TabsTrigger value="emergence">Emergence</TabsTrigger>
        </TabsList>

        <TabsContent value="foundations" className="space-y-4">
          {getActiveDisciplineTheories().map(({ discipline, theories }) => (
            <Card key={discipline?.id} className="bg-gray-800 border-gray-700">
              <div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: discipline?.color }}
                  >
                    {discipline?.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white">{theories.title}</h3>
                </div>

                <div className="space-y-4">
                  {theories.theories.map((theory, index) => (
                    <div key={index} className="border border-gray-700 rounded-lg p-4">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => toggleSection(`${discipline?.id}-${index}`)}
                      >
                        <div className="flex items-center gap-3">
                          {expandedSections.has(`${discipline?.id}-${index}`) ? 
                            <ChevronDown className="w-4 h-4 text-gray-400" /> : 
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          }
                          <h4 className="font-semibold text-white">{theory.name}</h4>
                        </div>
                        <Badge variant="secondary" className="bg-gray-700">
                          {theory.depth}% explored
                        </Badge>
                      </div>

                      {expandedSections.has(`${discipline?.id}-${index}`) && (
                        <div className="mt-4 space-y-3">
                          <p className="text-gray-300">{theory.description}</p>
                          
                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-gray-400">Understanding Depth</span>
                              <span className="text-white">{theory.depth}%</span>
                            </div>
                            <Progress value={theory.depth} className="h-2" />
                          </div>

                          <div>
                            <h5 className="text-sm font-semibold text-gray-400 mb-2">Key Insights:</h5>
                            <ul className="space-y-1">
                              {theory.insights.map((insight, idx) => (
                                <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                                  <span className="text-purple-400 mt-1">•</span>
                                  {insight}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <h5 className="text-sm font-semibold text-gray-400 mb-2">Connections:</h5>
                            <div className="flex flex-wrap gap-2">
                              {theory.connections.map((connection, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs border-blue-400 text-blue-400">
                                  {connection}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            className="border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white"
                            onClick={() => setActiveTheory(theory.name)}
                          >
                            <Book className="w-4 h-4 mr-2" />
                            Deep Dive
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="synthesis" className="space-y-4">
          <Card className="bg-gray-800 border-gray-700 p-4">
            <h3 className="text-xl font-semibold text-white mb-4">Synthesis Opportunities</h3>
            <div className="space-y-3">
              {getSynthesisOpportunities().map((opportunity, index) => (
                <div key={index} className="border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-white">{opportunity.title}</h4>
                    <Badge variant="secondary" className="bg-green-700 text-green-300">
                      {Math.round(opportunity.potential)}% potential
                    </Badge>
                  </div>
                  <p className="text-gray-300 text-sm mb-3">{opportunity.description}</p>
                  <Progress value={opportunity.potential} className="h-2" />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="emergence" className="space-y-4">
          <Card className="bg-gray-800 border-gray-700 p-4">
            <h3 className="text-xl font-semibold text-white mb-4">Emergent Patterns</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-700 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">System Resonance</h4>
                <p className="text-gray-300 text-sm mb-3">
                  The selected disciplines create harmonic resonance patterns that reveal deeper structural connections.
                </p>
                <Progress value={85} className="h-2" />
              </div>
              
              <div className="border border-gray-700 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">Complexity Emergence</h4>
                <p className="text-gray-300 text-sm mb-3">
                  New properties emerge from the interaction of multiple knowledge domains.
                </p>
                <Progress value={72} className="h-2" />
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {activeTheory && (
        <Card className="bg-gradient-to-r from-purple-900 to-blue-900 border-purple-400 p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-white">Deep Dive: {activeTheory}</h4>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setActiveTheory(null)}
              className="border-purple-400 text-purple-400"
            >
              Close
            </Button>
          </div>
          <p className="text-gray-300 text-sm">
            Entering deep theoretical exploration mode. This would connect to external databases, 
            academic papers, and interactive simulations for comprehensive understanding.
          </p>
        </Card>
      )}
    </div>
  );
};
