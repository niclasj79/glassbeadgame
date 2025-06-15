
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Concept } from '../types';

interface TextInsight {
  id: string;
  conceptualText: string;
  dimensionalText: string;
  generatedAt: string;
}

export const useTextGeneration = (sessionId: string | null) => {
  const [currentInsight, setCurrentInsight] = useState<TextInsight | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastGenerationRef = useRef<number>(0);

  const generateInsights = async (concepts: Concept[]) => {
    if (!sessionId || concepts.length === 0) return;

    // Throttle generation to prevent too frequent calls
    const now = Date.now();
    if (now - lastGenerationRef.current < 20000) return; // 20 second cooldown

    setIsGenerating(true);
    setError(null);
    lastGenerationRef.current = now;

    try {
      console.log('Generating Hesse insights for', concepts.length, 'concepts');
      
      const { data, error: functionError } = await supabase.functions.invoke('generate-hesse-insights', {
        body: {
          sessionId,
          concepts: concepts.map(c => ({
            id: c.id,
            text: c.text,
            discipline: c.discipline,
            x: c.x,
            y: c.y,
            z: c.z,
            energy: c.energy
          }))
        }
      });

      if (functionError) {
        throw functionError;
      }

      const newInsight: TextInsight = {
        id: data.insightId,
        conceptualText: data.conceptualText,
        dimensionalText: data.dimensionalText,
        generatedAt: new Date().toISOString()
      };

      setCurrentInsight(newInsight);
      console.log('Generated new insight:', newInsight.id);

    } catch (err) {
      console.error('Error generating insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setIsGenerating(false);
    }
  };

  const loadLatestInsight = async () => {
    if (!sessionId) return;

    try {
      const { data, error } = await supabase
        .from('text_insights')
        .select('id, conceptual_text, dimensional_text, generated_at')
        .eq('session_id', sessionId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw error;
      }

      if (data) {
        setCurrentInsight({
          id: data.id,
          conceptualText: data.conceptual_text,
          dimensionalText: data.dimensional_text,
          generatedAt: data.generated_at
        });
      }
    } catch (err) {
      console.error('Error loading latest insight:', err);
    }
  };

  // Load existing insight when session changes
  useEffect(() => {
    if (sessionId) {
      loadLatestInsight();
    } else {
      setCurrentInsight(null);
    }
  }, [sessionId]);

  return {
    currentInsight,
    isGenerating,
    error,
    generateInsights
  };
};
