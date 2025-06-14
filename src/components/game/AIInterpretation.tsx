
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  const [insights, setInsights] = useState<string[]>([]);

  useEffect(() => {
    generateInterpretation();
  }, [sessionData]);

  const generateInterpretation = async () => {
    setIsGenerating(true);
    
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    const interpretation = generateTheoreticalInterpretation(sessionData);
    const insights = generateInsights(sessionData);
    
    setInterpretation(interpretation);
    setInsights(insights);
    setIsGenerating(false);
  };

  const generateTheoreticalInterpretation = (data: SessionData): string => {
    const { disciplines, concepts, interactions, duration, sessionType } = data;
    
    const disciplineNames = disciplines.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
    const interactionCount = interactions.length;
    const uniqueConcepts = new Set(interactions.map(i => i.conceptId)).size;
    
    const interpretations = {
      exploration: [
        `Your ${Math.floor(duration / 60)} minute exploration through ${disciplineNames} revealed a contemplative approach to knowledge synthesis. The ${interactionCount} interactions with ${uniqueConcepts} distinct concepts suggest a methodology of careful observation before engagement.`,
        `This session demonstrated a ${interactionCount < 20 ? 'measured' : 'dynamic'} exploration pattern, where ${disciplineNames} served as foundational territories for intellectual cartography. Your conceptual navigation reveals an underlying search for ${sessionType === 'exploration' ? 'connections' : 'synthesis'}.`,
        `The interplay between ${disciplineNames} in your ${duration}-second session created a unique cognitive landscape. Your interaction pattern suggests a ${interactionCount > 15 ? 'highly engaged' : 'contemplative'} approach to interdisciplinary thinking.`
      ],
      synthesis: [
        `Your synthesis session achieved ${uniqueConcepts} conceptual integrations across ${disciplineNames}, demonstrating mastery of Hermann Hesse's vision of intellectual synthesis. The ${interactionCount} interactions reveal a systematic approach to knowledge unification.`,
        `This ${Math.floor(duration / 60)}-minute synthesis generated novel connections between ${disciplineNames}, creating what we might term a 'cognitive constellation' - a unique arrangement of ideas that transcends individual disciplinary boundaries.`,
        `Your session exemplifies the Glass Bead Game's core principle: the discovery of universal patterns. The engagement with ${uniqueConcepts} concepts across ${disciplines.length} disciplines suggests an emerging synthesis methodology.`
      ],
      improvisation: [
        `Your improvisational session across ${disciplineNames} embodied the spontaneous creativity central to the Glass Bead Game. ${interactionCount} rapid interactions in ${duration} seconds demonstrates intuitive knowledge navigation.`,
        `This improvisation revealed the jazz-like nature of interdisciplinary thinking, where ${disciplineNames} served as your instrumental voices. The ${uniqueConcepts} unique conceptual engagements suggest a natural fluency in cross-domain synthesis.`,
        `Your ${duration}-second improvisational performance created unexpected harmonies between ${disciplineNames}. The pattern of ${interactionCount} interactions reveals an underlying structural intuition.`
      ]
    };

    const typeInterpretations = interpretations[sessionType as keyof typeof interpretations] || interpretations.exploration;
    return typeInterpretations[Math.floor(Math.random() * typeInterpretations.length)];
  };

  const generateInsights = (data: SessionData): string[] => {
    const insights = [
      `Cognitive Pattern: ${data.interactions.length > 20 ? 'High-velocity connector' : 'Contemplative synthesizer'}`,
      `Discipline Affinity: ${data.disciplines.length > 3 ? 'Multidisciplinary navigator' : 'Focused specialist'}`,
      `Interaction Style: ${data.duration > 300 ? 'Extended exploration' : 'Intensive burst'}`,
      `Conceptual Reach: ${new Set(data.interactions.map(i => i.conceptId)).size} unique concept engagements`,
      `Session Intensity: ${(data.interactions.length / (data.duration / 60)).toFixed(1)} interactions per minute`
    ];

    const philosophicalInsights = [
      'Demonstrated capacity for non-linear thinking',
      'Shows preference for emergent over planned connections',
      'Exhibits natural tendency toward synthesis over analysis',
      'Reveals intuitive understanding of disciplinary boundaries',
      'Suggests comfort with conceptual ambiguity'
    ];

    return [...insights, ...philosophicalInsights.slice(0, 2)];
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
            Generating Interpretation
          </h2>
          <p className="text-gray-300">
            Analyzing your session patterns and generating theoretical insights...
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
            Session Interpretation
          </h1>
          <div className="flex justify-center gap-4 mb-6">
            <Badge variant="outline" className="border-blue-400 text-blue-400">
              Duration: {formatDuration(sessionData.duration)}
            </Badge>
            <Badge variant="outline" className="border-green-400 text-green-400">
              {sessionData.interactions.length} Interactions
            </Badge>
            <Badge variant="outline" className="border-purple-400 text-purple-400">
              {sessionData.sessionType}
            </Badge>
          </div>
        </div>

        <Card className="bg-gray-900 border-gray-700 p-8 mb-6">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Brain className="w-6 h-6" />
            Theoretical Analysis
          </h2>
          <p className="text-lg leading-relaxed text-gray-200 mb-6">
            {interpretation}
          </p>
          
          <h3 className="text-xl font-semibold mb-4">Session Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, index) => (
              <div key={index} className="bg-gray-800 p-4 rounded-lg border border-gray-600">
                <p className="text-sm text-gray-300">{insight}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="bg-gray-900 border-gray-700 p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">Disciplinary Engagement</h3>
          <div className="flex flex-wrap gap-2">
            {sessionData.disciplines.map(discipline => (
              <Badge key={discipline} className="bg-purple-600 text-white">
                {discipline.charAt(0).toUpperCase() + discipline.slice(1)}
              </Badge>
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
              title: 'Glass Bead Game Session', 
              text: interpretation 
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
