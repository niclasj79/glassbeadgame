
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Concept } from './types';
import { generateSpatialSynthesis } from './utils';

interface SynthesisEngineProps {
  concepts: Concept[];
  className?: string;
}

interface SynthesisInsight {
  id: string;
  text: string;
  concepts: [string, string];
  timestamp: number;
  relevance: number;
}

export const SynthesisEngine: React.FC<SynthesisEngineProps> = ({
  concepts,
  className = ""
}) => {
  const [insights, setInsights] = useState<SynthesisInsight[]>([]);
  const [lastUpdate, setLastUpdate] = useState(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdate < 2000) return; // Throttle updates

    const newInsights: SynthesisInsight[] = [];
    
    // Generate insights for close concept pairs
    for (let i = 0; i < concepts.length; i++) {
      for (let j = i + 1; j < concepts.length; j++) {
        const concept1 = concepts[i];
        const concept2 = concepts[j];
        
        const distance = Math.sqrt(
          (concept1.x - concept2.x) ** 2 + 
          (concept1.y - concept2.y) ** 2 + 
          (concept1.z - concept2.z) ** 2
        );
        
        if (distance < 80) { // Close concepts
          const synthesisText = generateSpatialSynthesis(concept1, concept2);
          if (synthesisText) {
            newInsights.push({
              id: `${concept1.id}-${concept2.id}`,
              text: synthesisText,
              concepts: [concept1.text, concept2.text],
              timestamp: now,
              relevance: 1 - (distance / 80)
            });
          }
        }
      }
    }
    
    // Sort by relevance and take top 5
    newInsights.sort((a, b) => b.relevance - a.relevance);
    setInsights(newInsights.slice(0, 5));
    setLastUpdate(now);
  }, [concepts, lastUpdate]);

  // Clean up old insights
  useEffect(() => {
    const interval = setInterval(() => {
      setInsights(prev => prev.filter(insight => 
        Date.now() - insight.timestamp < 30000 // Keep for 30 seconds
      ));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (insights.length === 0) return null;

  return (
    <Card className={`bg-gray-800/90 backdrop-blur-sm border-gray-600 p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-3">Spatial Syntheses</h3>
      
      <div className="space-y-3 max-h-60 overflow-y-auto">
        {insights.map(insight => (
          <div key={insight.id} className="space-y-2">
            <div className="flex gap-2">
              <Badge variant="outline" className="border-blue-400 text-blue-300 text-xs">
                {Math.round(insight.relevance * 100)}%
              </Badge>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {insight.text}
            </p>
          </div>
        ))}
      </div>
      
      {insights.length > 0 && (
        <div className="mt-3 text-xs text-gray-500">
          Syntheses update as you move concepts in 3D space
        </div>
      )}
    </Card>
  );
};
