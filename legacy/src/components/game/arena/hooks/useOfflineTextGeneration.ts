
import { useState, useRef, useCallback, useEffect } from 'react';
import { Concept } from '../types';

interface OfflineInsight {
  id: string;
  conceptualText: string;
  dimensionalText: string;
  generatedAt: string;
}

interface OfflineTextConfig {
  cooldownPeriod: number;
}

const DEFAULT_CONFIG: OfflineTextConfig = {
  cooldownPeriod: 15000 // 15 seconds
};

// Predefined Hesse-style insight templates
const CONCEPTUAL_TEMPLATES = [
  "In the interplay between {concept1} and {concept2}, we discover the eternal dance of synthesis that mirrors the Glass Bead Game's deepest purpose.",
  "The positioning of {concept1} alongside {concept2} reveals hidden harmonies that exist beyond the boundaries of individual disciplines.",
  "Through {concept1} and {concept2}, we witness the crystalline structure of knowledge forming itself into new patterns of understanding.",
  "The relationship between {concept1} and {concept2} embodies the very essence of intellectual symbiosis that Hesse envisioned.",
  "In this configuration, {concept1} and {concept2} create a resonance that speaks to the universal language underlying all human knowledge."
];

const DIMENSIONAL_TEMPLATES = [
  "The spatial arrangement expresses a meditation on the relationship between beauty and truth, where {concept1} serves as a bridge toward deeper understanding.",
  "This dimensional configuration suggests that knowledge, like light, refracts differently through various disciplinary prisms while maintaining its essential unity.",
  "The three-dimensional positioning creates a mandala of meaning, where each concept finds its place in the greater symphony of human thought.",
  "Through this spatial synthesis, we observe how concepts migrate across disciplinary boundaries, seeking their natural philosophical home.",
  "The arrangement reveals the geography of ideas, where proximity in space reflects affinity in essence."
];

export const useOfflineTextGeneration = (
  sessionId: string | null,
  config: Partial<OfflineTextConfig> = {}
) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const [currentInsight, setCurrentInsight] = useState<OfflineInsight | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const lastGenerationRef = useRef<number>(0);
  const usedTemplatesRef = useRef<Set<string>>(new Set());

  // Generate insight using templates
  const generateInsights = useCallback(async (concepts: Concept[]) => {
    if (!sessionId || concepts.length === 0) return;

    // Respect cooldown period
    const now = Date.now();
    if (now - lastGenerationRef.current < finalConfig.cooldownPeriod) {
      return;
    }

    setIsGenerating(true);
    setError(null);
    lastGenerationRef.current = now;

    try {
      // Simulate generation delay for realism
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      // Select two most energetic or recently moved concepts
      const sortedConcepts = [...concepts].sort((a, b) => b.energy - a.energy);
      const concept1 = sortedConcepts[0];
      const concept2 = sortedConcepts[1] || sortedConcepts[0];

      // Select unused templates or reset if all used
      let availableConceptual = CONCEPTUAL_TEMPLATES.filter(t => !usedTemplatesRef.current.has(t));
      let availableDimensional = DIMENSIONAL_TEMPLATES.filter(t => !usedTemplatesRef.current.has(t));
      
      if (availableConceptual.length === 0) {
        usedTemplatesRef.current.clear();
        availableConceptual = [...CONCEPTUAL_TEMPLATES];
      }
      if (availableDimensional.length === 0) {
        availableDimensional = [...DIMENSIONAL_TEMPLATES];
      }

      // Generate texts
      const conceptualTemplate = availableConceptual[Math.floor(Math.random() * availableConceptual.length)];
      const dimensionalTemplate = availableDimensional[Math.floor(Math.random() * availableDimensional.length)];
      
      usedTemplatesRef.current.add(conceptualTemplate);
      usedTemplatesRef.current.add(dimensionalTemplate);

      const conceptualText = conceptualTemplate
        .replace('{concept1}', concept1.text)
        .replace('{concept2}', concept2.text);
      
      const dimensionalText = dimensionalTemplate
        .replace('{concept1}', concept1.text);

      const insight: OfflineInsight = {
        id: `offline-${Date.now()}`,
        conceptualText,
        dimensionalText,
        generatedAt: new Date().toISOString()
      };

      setCurrentInsight(insight);
      console.log('Generated offline insight:', insight.id);

    } catch (err) {
      console.error('Error generating offline insight:', err);
      setError('Failed to generate insight');
    } finally {
      setIsGenerating(false);
    }
  }, [sessionId, finalConfig.cooldownPeriod]);

  // Preload function (no-op for offline)
  const preloadInsights = useCallback(() => {
    // No-op for offline mode
  }, []);

  // Get cached insight (no-op for offline)
  const getCachedInsight = useCallback(() => {
    return null;
  }, []);

  return {
    currentInsight,
    isGenerating,
    error,
    generateInsights,
    preloadInsights,
    getCachedInsight
  };
};
