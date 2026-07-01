
import { useCallback } from 'react';
import { getDisciplineFrequencies, createTone, getLayerFrequencies } from '../utils/audioUtils';

export const useAudioFunctions = (
  audioContextRef: React.MutableRefObject<AudioContext | null>,
  masterGainRef: React.MutableRefObject<GainNode | null>,
  oscillatorsRef: React.MutableRefObject<Map<string, OscillatorNode>>,
  gainNodesRef: React.MutableRefObject<Map<string, GainNode>>,
  isAudioEnabled: boolean,
  isInitialized: boolean,
  stopAmbientLayer: (layer: string) => void
) => {
  const playDisciplineSound = useCallback((disciplineId: string, intensity: number = 0.5) => {
    if (!isAudioEnabled || !isInitialized || !audioContextRef.current || !masterGainRef.current) return;
    
    const frequencies = getDisciplineFrequencies(disciplineId);
    const baseFreq = frequencies[0];
    const harmonicFreq = frequencies[1];
    
    // Play base tone
    createTone(audioContextRef.current, masterGainRef.current, baseFreq, 'sine', 800);
    
    // Play harmonic based on intensity
    if (intensity > 0.3) {
      setTimeout(() => createTone(audioContextRef.current!, masterGainRef.current!, harmonicFreq, 'triangle', 600), 200);
    }
    
    // Play high harmonic for high intensity
    if (intensity > 0.7) {
      setTimeout(() => createTone(audioContextRef.current!, masterGainRef.current!, frequencies[2], 'sawtooth', 400), 400);
    }
  }, [isAudioEnabled, isInitialized, audioContextRef, masterGainRef]);

  const playSynthesisSound = useCallback((disciplines: string[], resonance: number) => {
    if (!isAudioEnabled || disciplines.length === 0 || !isInitialized || !audioContextRef.current || !masterGainRef.current) return;
    
    disciplines.forEach((disciplineId, index) => {
      const frequencies = getDisciplineFrequencies(disciplineId);
      const delay = index * 150;
      
      setTimeout(() => {
        frequencies.forEach((freq, freqIndex) => {
          const modifiedFreq = freq * (1 + resonance * 0.1);
          setTimeout(() => createTone(audioContextRef.current!, masterGainRef.current!, modifiedFreq, 'sine', 1200), freqIndex * 100);
        });
      }, delay);
    });
    
    // Add synthesis chord
    setTimeout(() => {
      const synthFreqs = [440, 554.37, 659.25]; // A-C#-E
      synthFreqs.forEach((freq, index) => {
        setTimeout(() => createTone(audioContextRef.current!, masterGainRef.current!, freq, 'triangle', 2000), index * 50);
      });
    }, disciplines.length * 150);
  }, [isAudioEnabled, isInitialized, audioContextRef, masterGainRef]);

  const playAmbientLayer = useCallback((layer: string) => {
    if (!isAudioEnabled || !audioContextRef.current || !masterGainRef.current || !isInitialized) return;
    
    const layerFreqs = getLayerFrequencies();
    const frequency = layerFreqs[layer as keyof typeof layerFreqs] || 110;
    
    if (oscillatorsRef.current.has(layer)) {
      stopAmbientLayer(layer);
    }
    
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
    
    gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.02, audioContextRef.current.currentTime + 2);
    
    oscillator.connect(gainNode);
    gainNode.connect(masterGainRef.current);
    
    oscillator.start();
    
    oscillatorsRef.current.set(layer, oscillator);
    gainNodesRef.current.set(layer, gainNode);
  }, [isAudioEnabled, isInitialized, audioContextRef, masterGainRef, oscillatorsRef, gainNodesRef, stopAmbientLayer]);

  return {
    playDisciplineSound,
    playSynthesisSound,
    playAmbientLayer
  };
};
