import { useState, useCallback, useRef, useEffect } from 'react';
import { Concept, SynthesisDiscovery, ProximityPair, GameScore } from '../types';
import { supabase } from '@/integrations/supabase/client';

const PROXIMITY_THRESHOLD = 80; // 3D distance threshold for resonance
const COOLDOWN_MS = 3000; // Cooldown between synthesis checks for same pair

function getRank(score: number): string {
  if (score >= 500) return 'Grand Master';
  if (score >= 300) return 'Master Synthesizer';
  if (score >= 150) return 'Resonance Weaver';
  if (score >= 80) return 'Pattern Seeker';
  if (score >= 30) return 'Apprentice';
  return 'Novice';
}

export const useProximitySynthesis = (
  concepts: Concept[],
  disciplines: any[]
) => {
  const [discoveries, setDiscoveries] = useState<SynthesisDiscovery[]>([]);
  const [activePairs, setActivePairs] = useState<ProximityPair[]>([]);
  const [latestDiscovery, setLatestDiscovery] = useState<SynthesisDiscovery | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [score, setScore] = useState<GameScore>({
    totalResonance: 0,
    discoveriesCount: 0,
    uniquePairsCount: 0,
    rank: 'Novice'
  });

  const discoveredPairsRef = useRef<Set<string>>(new Set());
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const pendingRef = useRef<string | null>(null);

  const getPairKey = (id1: string, id2: string) => [id1, id2].sort().join('::');

  // Check proximity between all cross-discipline concept pairs
  const checkProximity = useCallback(() => {
    const pairs: ProximityPair[] = [];

    for (let i = 0; i < concepts.length; i++) {
      for (let j = i + 1; j < concepts.length; j++) {
        const c1 = concepts[i];
        const c2 = concepts[j];
        if (c1.discipline === c2.discipline) continue;

        const dx = c1.x - c2.x;
        const dy = c1.y - c2.y;
        const dz = c1.z - c2.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < PROXIMITY_THRESHOLD * 1.5) {
          pairs.push({
            concept1: c1,
            concept2: c2,
            distance,
            proximity: Math.max(0, 1 - distance / (PROXIMITY_THRESHOLD * 1.5))
          });
        }
      }
    }

    setActivePairs(pairs);
    return pairs;
  }, [concepts]);

  // Trigger synthesis for a close pair
  const triggerSynthesis = useCallback(async (pair: ProximityPair) => {
    const key = getPairKey(pair.concept1.id, pair.concept2.id);

    // Skip if already discovered or on cooldown or already generating
    if (discoveredPairsRef.current.has(key)) return;
    const lastCheck = cooldownRef.current.get(key) || 0;
    if (Date.now() - lastCheck < COOLDOWN_MS) return;
    if (pendingRef.current === key) return;

    cooldownRef.current.set(key, Date.now());
    pendingRef.current = key;
    setIsGeneratingInsight(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-synthesis', {
        body: {
          concept1: pair.concept1.text,
          concept2: pair.concept2.text,
          discipline1: pair.concept1.discipline,
          discipline2: pair.concept2.discipline,
        }
      });

      if (error) throw error;

      const insight = data?.insight || `${pair.concept1.text} and ${pair.concept2.text} resonate across disciplines.`;
      const noveltyBonus = pair.concept1.discipline !== pair.concept2.discipline ? 20 : 5;
      const proximityBonus = Math.floor(pair.proximity * 30);
      const resonanceScore = noveltyBonus + proximityBonus;

      const discovery: SynthesisDiscovery = {
        id: crypto.randomUUID(),
        concept1Id: pair.concept1.id,
        concept2Id: pair.concept2.id,
        concept1Text: pair.concept1.text,
        concept2Text: pair.concept2.text,
        discipline1: pair.concept1.discipline,
        discipline2: pair.concept2.discipline,
        insight,
        resonanceScore,
        timestamp: Date.now()
      };

      discoveredPairsRef.current.add(key);
      setDiscoveries(prev => [...prev, discovery]);
      setLatestDiscovery(discovery);
      setScore(prev => {
        const newTotal = prev.totalResonance + resonanceScore;
        return {
          totalResonance: newTotal,
          discoveriesCount: prev.discoveriesCount + 1,
          uniquePairsCount: discoveredPairsRef.current.size,
          rank: getRank(newTotal)
        };
      });

      // Auto-dismiss after 15s (longer so users can read)
      setTimeout(() => {
        setLatestDiscovery(prev => prev?.id === discovery.id ? null : prev);
      }, 15000);

    } catch (err) {
      console.error('Synthesis generation failed:', err);
      // Fallback: still create a discovery with local insight
      const fallbackInsight = `The interplay between ${pair.concept1.text} and ${pair.concept2.text} reveals unexpected connections across ${pair.concept1.discipline} and ${pair.concept2.discipline}.`;
      const discovery: SynthesisDiscovery = {
        id: crypto.randomUUID(),
        concept1Id: pair.concept1.id,
        concept2Id: pair.concept2.id,
        concept1Text: pair.concept1.text,
        concept2Text: pair.concept2.text,
        discipline1: pair.concept1.discipline,
        discipline2: pair.concept2.discipline,
        insight: fallbackInsight,
        resonanceScore: 15,
        timestamp: Date.now()
      };
      discoveredPairsRef.current.add(key);
      setDiscoveries(prev => [...prev, discovery]);
      setLatestDiscovery(discovery);
      setScore(prev => {
        const newTotal = prev.totalResonance + 15;
        return {
          totalResonance: newTotal,
          discoveriesCount: prev.discoveriesCount + 1,
          uniquePairsCount: discoveredPairsRef.current.size,
          rank: getRank(newTotal)
        };
      });
      setTimeout(() => {
        setLatestDiscovery(prev => prev?.id === discovery.id ? null : prev);
      }, 6000);
    } finally {
      setIsGeneratingInsight(false);
      pendingRef.current = null;
    }
  }, []);

  // Run proximity checks periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const pairs = checkProximity();
      // Auto-trigger synthesis for the closest pair within threshold
      const closePair = pairs.find(p => p.distance < PROXIMITY_THRESHOLD);
      if (closePair && !isGeneratingInsight) {
        triggerSynthesis(closePair);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [checkProximity, triggerSynthesis, isGeneratingInsight]);

  return {
    discoveries,
    activePairs,
    latestDiscovery,
    isGeneratingInsight,
    score,
    dismissDiscovery: () => setLatestDiscovery(null),
  };
};
