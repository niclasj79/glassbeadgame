
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ChevronDown, ChevronRight, Book, ExternalLink, Target, Lightbulb } from 'lucide-react';

interface TheoreticalDepthProps {
  disciplines: any[];
  selectedDisciplines: string[];
  explorationDepth: number;
}

interface ConceptArea {
  name: string;
  description: string;
  depth: number;
  concepts: string[];
  keyInsight: string;
}

export const TheoreticalDepth: React.FC<TheoreticalDepthProps> = ({
  disciplines,
  selectedDisciplines,
  explorationDepth
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [focusArea, setFocusArea] = useState<string | null>(null);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  // Restructured theoretical foundations - exactly 5 areas per discipline, ~10 concepts per area
  const theoreticalFoundations = {
    mathematics: {
      title: "Mathematical Foundations",
      areas: [
        {
          name: "Abstract Algebra",
          description: "Study of algebraic structures and their properties",
          depth: 85,
          concepts: ["Groups", "Rings", "Fields", "Vector Spaces", "Homomorphisms", "Isomorphisms", "Galois Theory", "Linear Algebra", "Matrix Theory", "Eigenvalues"],
          keyInsight: "Algebraic structures reveal deep patterns across mathematical domains"
        },
        {
          name: "Analysis & Topology",
          description: "Continuous mathematics and spatial relationships",
          depth: 78,
          concepts: ["Real Analysis", "Complex Analysis", "Functional Analysis", "Measure Theory", "Topology", "Differential Geometry", "Manifolds", "Continuity", "Convergence", "Compactness"],
          keyInsight: "Continuity and limit processes underlie all mathematical analysis"
        },
        {
          name: "Logic & Foundations",
          description: "Mathematical reasoning and foundational principles",
          depth: 92,
          concepts: ["Set Theory", "Predicate Logic", "Model Theory", "Proof Theory", "Recursion Theory", "Computational Complexity", "Gödel's Theorems", "Axiom Systems", "Consistency", "Completeness"],
          keyInsight: "Logic provides the foundation for all mathematical reasoning"
        },
        {
          name: "Number Theory",
          description: "Properties and relationships of integers",
          depth: 71,
          concepts: ["Prime Numbers", "Modular Arithmetic", "Diophantine Equations", "Elliptic Curves", "Cryptography", "Algebraic Number Theory", "Analytic Number Theory", "Riemann Hypothesis", "Zeta Functions", "L-functions"],
          keyInsight: "Number theory connects abstract mathematics to practical applications"
        },
        {
          name: "Applied Mathematics",
          description: "Mathematical methods for real-world problems",
          depth: 88,
          concepts: ["Differential Equations", "Optimization", "Statistics", "Probability", "Game Theory", "Numerical Methods", "Dynamical Systems", "Chaos Theory", "Fractals", "Mathematical Modeling"],
          keyInsight: "Mathematics provides powerful tools for understanding complex systems"
        }
      ]
    },
    music: {
      title: "Musical Theory",
      areas: [
        {
          name: "Harmonic Theory",
          description: "Structure and progression of musical harmony",
          depth: 82,
          concepts: ["Triads", "Seventh Chords", "Voice Leading", "Harmonic Rhythm", "Tonal Functions", "Modulation", "Circle of Fifths", "Chord Progressions", "Cadences", "Non-Chord Tones"],
          keyInsight: "Harmonic relationships create the emotional backbone of music"
        },
        {
          name: "Rhythmic Systems",
          description: "Temporal organization and rhythmic patterns",
          depth: 75,
          concepts: ["Meter", "Syncopation", "Polyrhythms", "Time Signatures", "Rhythmic Cycles", "Groove", "Cross-rhythms", "Metric Modulation", "Additive Rhythms", "Temporal Perception"],
          keyInsight: "Rhythm creates the fundamental pulse that drives musical expression"
        },
        {
          name: "Melodic Construction",
          description: "Linear organization of musical pitches",
          depth: 79,
          concepts: ["Scales", "Modes", "Melodic Contour", "Phrase Structure", "Motivic Development", "Sequence", "Interval Relationships", "Pitch Sets", "Melodic Analysis", "Linear Counterpoint"],
          keyInsight: "Melody provides the horizontal dimension of musical thought"
        },
        {
          name: "Formal Structures",
          description: "Large-scale organization of musical works",
          depth: 86,
          concepts: ["Binary Form", "Ternary Form", "Sonata Form", "Rondo", "Theme and Variations", "Fugue", "Suite", "Symphony", "Concerto", "Musical Narrative"],
          keyInsight: "Musical forms provide architectural frameworks for compositional expression"
        },
        {
          name: "Acoustic Foundations",
          description: "Physical and psychoacoustic principles of sound",
          depth: 73,
          concepts: ["Harmonic Series", "Timbre", "Psychoacoustics", "Frequency Analysis", "Resonance", "Acoustic Spaces", "Digital Audio", "Synthesis", "Spectral Analysis", "Spatial Audio"],
          keyInsight: "Understanding sound physics enhances musical composition and performance"
        }
      ]
    },
    philosophy: {
      title: "Philosophical Foundations",
      areas: [
        {
          name: "Metaphysics",
          description: "Nature of reality, existence, and being",
          depth: 89,
          concepts: ["Ontology", "Substance", "Causation", "Identity", "Time", "Space", "Possibility", "Necessity", "Properties", "Relations"],
          keyInsight: "Metaphysics explores the fundamental structure of reality"
        },
        {
          name: "Epistemology",
          description: "Nature of knowledge, truth, and belief",
          depth: 84,
          concepts: ["Knowledge", "Justification", "Truth", "Skepticism", "Empiricism", "Rationalism", "Perception", "Memory", "Testimony", "A Priori Knowledge"],
          keyInsight: "Epistemology examines how we acquire and validate knowledge"
        },
        {
          name: "Ethics & Morality",
          description: "Principles of right and wrong, good and evil",
          depth: 91,
          concepts: ["Virtue Ethics", "Deontology", "Consequentialism", "Moral Relativism", "Applied Ethics", "Metaethics", "Moral Psychology", "Justice", "Rights", "Responsibility"],
          keyInsight: "Ethics provides frameworks for moral reasoning and action"
        },
        {
          name: "Logic & Reasoning",
          description: "Principles of valid inference and argument",
          depth: 87,
          concepts: ["Formal Logic", "Informal Logic", "Fallacies", "Induction", "Deduction", "Abduction", "Modal Logic", "Fuzzy Logic", "Argumentation Theory", "Critical Thinking"],
          keyInsight: "Logic provides tools for clear thinking and valid reasoning"
        },
        {
          name: "Philosophy of Mind",
          description: "Nature of consciousness, mental states, and cognition",
          depth: 76,
          concepts: ["Consciousness", "Qualia", "Mental Causation", "Personal Identity", "Free Will", "Intentionality", "Mental Content", "Cognitive Science", "Artificial Intelligence", "Embodied Cognition"],
          keyInsight: "Philosophy of mind explores the relationship between mind and reality"
        }
      ]
    },
    physics: {
      title: "Physical Principles",
      areas: [
        {
          name: "Quantum Mechanics",
          description: "Behavior of matter and energy at atomic scales",
          depth: 94,
          concepts: ["Wave Function", "Superposition", "Entanglement", "Uncertainty Principle", "Quantum States", "Measurement Problem", "Quantum Field Theory", "Spin", "Quantum Computing", "Bell's Theorem"],
          keyInsight: "Quantum mechanics reveals the probabilistic nature of reality at fundamental scales"
        },
        {
          name: "Relativity",
          description: "Space, time, and gravity in Einstein's framework",
          depth: 88,
          concepts: ["Special Relativity", "General Relativity", "Spacetime", "Time Dilation", "Length Contraction", "Equivalence Principle", "Black Holes", "Gravitational Waves", "Cosmology", "Curved Spacetime"],
          keyInsight: "Relativity shows that space and time are dynamic and interconnected"
        },
        {
          name: "Thermodynamics",
          description: "Heat, energy, and statistical mechanics",
          depth: 81,
          concepts: ["Laws of Thermodynamics", "Entropy", "Temperature", "Heat Engines", "Statistical Mechanics", "Phase Transitions", "Critical Phenomena", "Boltzmann Distribution", "Free Energy", "Irreversibility"],
          keyInsight: "Thermodynamics reveals the statistical nature of macroscopic phenomena"
        },
        {
          name: "Field Theory",
          description: "Classical and quantum field descriptions of nature",
          depth: 85,
          concepts: ["Electric Fields", "Magnetic Fields", "Electromagnetic Waves", "Gauge Theory", "Symmetries", "Conservation Laws", "Field Equations", "Particle Physics", "Standard Model", "Unified Theories"],
          keyInsight: "Fields provide a unified description of forces and particles"
        },
        {
          name: "Complex Systems",
          description: "Emergent behavior in multi-component systems",
          depth: 72,
          concepts: ["Chaos Theory", "Nonlinear Dynamics", "Emergence", "Self-Organization", "Phase Transitions", "Scaling Laws", "Network Theory", "Complexity Science", "Fractals", "Adaptive Systems"],
          keyInsight: "Complex systems exhibit emergent properties not present in individual components"
        }
      ]
    },
    art: {
      title: "Artistic Theory",
      areas: [
        {
          name: "Visual Composition",
          description: "Principles of visual organization and design",
          depth: 77,
          concepts: ["Balance", "Proportion", "Rhythm", "Unity", "Contrast", "Emphasis", "Movement", "Pattern", "Hierarchy", "Visual Flow"],
          keyInsight: "Composition creates visual harmony and guides viewer perception"
        },
        {
          name: "Color Theory",
          description: "Properties and relationships of color in art",
          depth: 83,
          concepts: ["Color Wheel", "Complementary Colors", "Color Temperature", "Saturation", "Value", "Color Harmony", "Psychological Effects", "Cultural Associations", "Color Mixing", "Digital Color"],
          keyInsight: "Color creates emotional and psychological responses in viewers"
        },
        {
          name: "Form & Space",
          description: "Three-dimensional relationships and spatial illusion",
          depth: 74,
          concepts: ["Perspective", "Proportion", "Scale", "Volume", "Mass", "Negative Space", "Depth Cues", "Spatial Relationships", "Geometric Forms", "Organic Forms"],
          keyInsight: "Form and space create the illusion of three-dimensional reality"
        },
        {
          name: "Art History & Context",
          description: "Cultural and historical development of artistic expression",
          depth: 86,
          concepts: ["Art Movements", "Cultural Context", "Artistic Influence", "Style Evolution", "Patronage", "Iconography", "Art Criticism", "Aesthetic Theory", "Cross-Cultural Art", "Contemporary Practices"],
          keyInsight: "Art reflects and shapes cultural values and historical consciousness"
        },
        {
          name: "Media & Technique",
          description: "Materials, tools, and methods of artistic creation",
          depth: 69,
          concepts: ["Drawing", "Painting", "Sculpture", "Printmaking", "Digital Art", "Mixed Media", "Installation", "Performance", "Video Art", "New Media"],
          keyInsight: "Technical mastery enables authentic artistic expression"
        }
      ]
    },
    history: {
      title: "Historical & Political Foundations",
      areas: [
        {
          name: "Political Theory",
          description: "Concepts of governance, power, and political organization",
          depth: 88,
          concepts: ["Democracy", "Authoritarianism", "Liberalism", "Conservatism", "Socialism", "Political Authority", "Legitimacy", "Sovereignty", "Citizenship", "Political Obligation"],
          keyInsight: "Political theory examines the foundations of legitimate governance"
        },
        {
          name: "Social Movements",
          description: "Collective action and social change processes",
          depth: 82,
          concepts: ["Civil Rights", "Labor Movements", "Feminism", "Environmental Movements", "Revolution", "Reform", "Protest", "Social Networks", "Collective Action", "Identity Politics"],
          keyInsight: "Social movements drive historical change through collective action"
        },
        {
          name: "Historical Methodology",
          description: "Methods and approaches to understanding the past",
          depth: 79,
          concepts: ["Primary Sources", "Historical Evidence", "Historiography", "Narrative", "Causation", "Periodization", "Comparative History", "Microhistory", "Oral History", "Digital Humanities"],
          keyInsight: "Historical methodology reveals how we construct understanding of the past"
        },
        {
          name: "Cultural Evolution",
          description: "Development and transmission of cultural practices",
          depth: 84,
          concepts: ["Cultural Diffusion", "Innovation", "Tradition", "Cultural Exchange", "Globalization", "Cultural Identity", "Language Evolution", "Religious Change", "Technological Impact", "Cultural Memory"],
          keyInsight: "Culture evolves through complex processes of transmission and adaptation"
        },
        {
          name: "Power Structures",
          description: "Systems of authority and control throughout history",
          depth: 91,
          concepts: ["State Formation", "Empire", "Bureaucracy", "Military Power", "Economic Systems", "Social Hierarchy", "Elite Networks", "Resistance", "Hegemony", "Institutional Change"],
          keyInsight: "Power structures shape historical development and social organization"
        }
      ]
    }
  };

  const getActiveDisciplineAreas = () => {
    return selectedDisciplines.map(disciplineId => {
      const discipline = disciplines.find(d => d.id === disciplineId);
      const areas = theoreticalFoundations[disciplineId as keyof typeof theoreticalFoundations];
      return { discipline, areas };
    }).filter(item => item.areas);
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
          potential: 70 + Math.random() * 30,
          description: `Cross-disciplinary synthesis reveals emergent patterns between ${disc1} and ${disc2}.`
        });
      }
    }
    return opportunities.slice(0, 6); // Limit to 6 most relevant
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Knowledge Foundations</h2>
        <div className="flex gap-2">
          <Badge variant="outline" className="border-purple-400 text-purple-400">
            {selectedDisciplines.length} Active Domains
          </Badge>
          <Badge variant="outline" className="border-blue-400 text-blue-400">
            {getActiveDisciplineAreas().reduce((total, item) => total + item.areas.areas.length, 0)} Knowledge Areas
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="foundations" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-gray-800">
          <TabsTrigger value="foundations">Knowledge Areas</TabsTrigger>
          <TabsTrigger value="synthesis">Synthesis Potential</TabsTrigger>
        </TabsList>

        <TabsContent value="foundations" className="space-y-6">
          {getActiveDisciplineAreas().map(({ discipline, areas }) => (
            <Card key={discipline?.id} className="bg-gray-800 border-gray-700">
              <div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: discipline?.color }}
                  >
                    {discipline?.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white">{areas.title}</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {areas.areas.map((area, index) => (
                    <div key={index} className="border border-gray-700 rounded-lg p-4">
                      <div 
                        className="flex items-center justify-between cursor-pointer mb-3"
                        onClick={() => toggleSection(`${discipline?.id}-${index}`)}
                      >
                        <div className="flex items-center gap-3">
                          {expandedSections.has(`${discipline?.id}-${index}`) ? 
                            <ChevronDown className="w-4 h-4 text-gray-400" /> : 
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          }
                          <div>
                            <h4 className="font-semibold text-white">{area.name}</h4>
                            <p className="text-sm text-gray-400">{area.description}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-gray-700">
                          {area.depth}%
                        </Badge>
                      </div>

                      <Progress value={area.depth} className="h-2 mb-3" />

                      {expandedSections.has(`${discipline?.id}-${index}`) && (
                        <div className="space-y-3">
                          <div className="bg-gray-900 p-3 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Lightbulb className="w-4 h-4 text-yellow-400" />
                              <span className="text-sm font-medium text-yellow-400">Key Insight</span>
                            </div>
                            <p className="text-sm text-gray-300">{area.keyInsight}</p>
                          </div>

                          <div>
                            <h5 className="text-sm font-semibold text-gray-400 mb-2">Core Concepts:</h5>
                            <div className="grid grid-cols-2 gap-1">
                              {area.concepts.map((concept, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs border-blue-400 text-blue-400 justify-start">
                                  {concept}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white"
                            onClick={() => setFocusArea(area.name)}
                          >
                            <Target className="w-4 h-4 mr-2" />
                            Focus on {area.name}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}

          {getActiveDisciplineAreas().length === 0 && (
            <Card className="bg-gray-800 border-gray-700 p-8 text-center">
              <Book className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">
                Select disciplines to explore their theoretical foundations
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="synthesis" className="space-y-4">
          <Card className="bg-gray-800 border-gray-700 p-4">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              Cross-Disciplinary Synthesis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getSynthesisOpportunities().map((opportunity, index) => (
                <div key={index} className="border border-gray-700 rounded-lg p-4 hover:bg-gray-750 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-white">{opportunity.title}</h4>
                    <Badge 
                      variant="secondary" 
                      className={opportunity.potential > 80 ? "bg-green-700 text-green-300" : "bg-blue-700 text-blue-300"}
                    >
                      {Math.round(opportunity.potential)}%
                    </Badge>
                  </div>
                  <p className="text-gray-300 text-sm mb-3">{opportunity.description}</p>
                  <Progress value={opportunity.potential} className="h-2" />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {focusArea && (
        <Card className="bg-gradient-to-r from-purple-900 to-blue-900 border-purple-400 p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Target className="w-4 h-4" />
              Focused Study: {focusArea}
            </h4>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setFocusArea(null)}
              className="border-purple-400 text-purple-400"
            >
              Exit Focus
            </Button>
          </div>
          <p className="text-gray-300 text-sm">
            Deep exploration mode activated. This would provide interactive learning materials, 
            research connections, and practical applications for {focusArea}.
          </p>
        </Card>
      )}
    </div>
  );
};
