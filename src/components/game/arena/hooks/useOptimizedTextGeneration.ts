
import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Concept } from '../types';

interface TextInsight {
  id: string;
  conceptualText: string;
  dimensionalText: string;
  generatedAt: string;
  conceptSignature: string; // Hash of concept positions for caching
}

interface InsightCache {
  [signature: string]: TextInsight;
}

interface OptimizedTextConfig {
  enablePreloading: boolean;
  maxCacheSize: number;
  cooldownPeriod?: number;
}

const DEFAULT_CONFIG: OptimizedTextConfig = {
  enablePreloading: true,
  maxCacheSize: 50,
  cooldownPeriod: 15000 // 15 seconds
};

export const useOptimizedTextGeneration = (
  sessionId: string | null,
  config: Partial<OptimizedTextConfig> = {}
) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const [currentInsight, setCurrentInsight] = useState<TextInsight | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Advanced caching system
  const insightCache = useRef<InsightCache>({});
  const preloadQueue = useRef<Concept[][]>([]);
  const lastGenerationRef = useRef<number>(0);
  const isPreloading = useRef<boolean>(false);
  
  // Performance metrics
  const performanceMetrics = useRef({
    cacheHits: 0,
    generations: 0,
    preloadedInsights: 0,
    averageGenerationTime: 0
  });

  // Generate concept signature for caching
  const generateConceptSignature = useCallback((concepts: Concept[]): string => {
    const positions = concepts
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(c => `${c.id}:${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}`)
      .join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < positions.length; i++) {
      const char = positions.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }, []);

  // Get cached insight
  const getCachedInsight = useCallback((concepts: Concept[]): TextInsight | null => {
    const signature = generateConceptSignature(concepts);
    const cached = insightCache.current[signature];
    
    if (cached) {
      performanceMetrics.current.cacheHits++;
      setCurrentInsight(cached);
      return cached;
    }
    
    return null;
  }, [generateConceptSignature]);

  // Cache management
  const addToCache = useCallback((concepts: Concept[], insight: TextInsight) => {
    const signature = generateConceptSignature(concepts);
    
    // Implement LRU cache eviction
    const cacheKeys = Object.keys(insightCache.current);
    if (cacheKeys.length >= finalConfig.maxCacheSize) {
      // Remove oldest entry (simplified LRU)
      const oldestKey = cacheKeys[0];
      delete insightCache.current[oldestKey];
    }
    
    insightCache.current[signature] = {
      ...insight,
      conceptSignature: signature
    };
  }, [generateConceptSignature, finalConfig.maxCacheSize]);

  // Background preloading worker
  const processPreloadQueue = useCallback(async () => {
    if (isPreloading.current || preloadQueue.current.length === 0) return;
    
    isPreloading.current = true;
    
    while (preloadQueue.current.length > 0) {
      const concepts = preloadQueue.current.shift();
      if (!concepts || !sessionId) continue;
      
      // Check if already cached
      if (getCachedInsight(concepts)) continue;
      
      try {
        const startTime = performance.now();
        
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

        if (functionError) throw functionError;

        const insight: TextInsight = {
          id: data.insightId,
          conceptualText: data.conceptualText,
          dimensionalText: data.dimensionalText,
          generatedAt: new Date().toISOString(),
          conceptSignature: generateConceptSignature(concepts)
        };

        addToCache(concepts, insight);
        performanceMetrics.current.preloadedInsights++;
        
        const generationTime = performance.now() - startTime;
        performanceMetrics.current.averageGenerationTime = 
          (performanceMetrics.current.averageGenerationTime * 0.8) + (generationTime * 0.2);
        
        console.log(`Preloaded insight in ${generationTime.toFixed(2)}ms`);
        
        // Small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        console.error('Error preloading insight:', err);
      }
    }
    
    isPreloading.current = false;
  }, [sessionId, getCachedInsight, generateConceptSignature, addToCache]);

  // Preload insights for concept combinations
  const preloadInsights = useCallback((concepts: Concept[]) => {
    if (!finalConfig.enablePreloading) return;
    
    // Add various concept combinations to preload queue
    preloadQueue.current.push([...concepts]);
    
    // Preload with subsets for common interactions
    if (concepts.length > 3) {
      for (let i = 0; i < Math.min(3, concepts.length - 2); i++) {
        const subset = concepts.slice(i, i + 3);
        preloadQueue.current.push(subset);
      }
    }
    
    // Process queue in background
    processPreloadQueue();
  }, [finalConfig.enablePreloading, processPreloadQueue]);

  // Generate insights with caching
  const generateInsights = useCallback(async (concepts: Concept[]) => {
    if (!sessionId || concepts.length === 0) return;

    // Check cache first
    const cached = getCachedInsight(concepts);
    if (cached) {
      console.log('Using cached insight');
      return;
    }

    // Respect cooldown period
    const now = Date.now();
    if (now - lastGenerationRef.current < (finalConfig.cooldownPeriod || 15000)) {
      console.log('Generation on cooldown');
      return;
    }

    setIsGenerating(true);
    setError(null);
    lastGenerationRef.current = now;
    performanceMetrics.current.generations++;

    try {
      const startTime = performance.now();
      
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

      if (functionError) throw functionError;

      const insight: TextInsight = {
        id: data.insightId,
        conceptualText: data.conceptualText,
        dimensionalText: data.dimensionalText,
        generatedAt: new Date().toISOString(),
        conceptSignature: generateConceptSignature(concepts)
      };

      setCurrentInsight(insight);
      addToCache(concepts, insight);
      
      const generationTime = performance.now() - startTime;
      performanceMetrics.current.averageGenerationTime = 
        (performanceMetrics.current.averageGenerationTime * 0.8) + (generationTime * 0.2);
      
      console.log(`Generated new insight in ${generationTime.toFixed(2)}ms`);

    } catch (err) {
      console.error('Error generating insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setIsGenerating(false);
    }
  }, [sessionId, getCachedInsight, generateConceptSignature, addToCache, finalConfig.cooldownPeriod]);

  // Load latest insight on session start
  useEffect(() => {
    if (sessionId) {
      // In a performance-optimized version, this could be cached as well
      console.log('Session started, insight system ready');
    } else {
      setCurrentInsight(null);
    }
  }, [sessionId]);

  // Performance monitoring
  const getPerformanceReport = useCallback(() => {
    const metrics = performanceMetrics.current;
    const cacheHitRate = metrics.cacheHits / (metrics.cacheHits + metrics.generations);
    
    return {
      cacheHitRate: (cacheHitRate * 100).toFixed(1) + '%',
      totalGenerations: metrics.generations,
      preloadedInsights: metrics.preloadedInsights,
      averageGenerationTime: metrics.averageGenerationTime.toFixed(2) + 'ms',
      cacheSize: Object.keys(insightCache.current).length
    };
  }, []);

  return {
    currentInsight,
    isGenerating,
    error,
    generateInsights,
    preloadInsights,
    getCachedInsight,
    getPerformanceReport,
    performanceMetrics: performanceMetrics.current
  };
};
