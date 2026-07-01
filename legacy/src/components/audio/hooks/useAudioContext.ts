
import { useRef, useEffect } from 'react';

export const useAudioContext = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<Map<string, OscillatorNode>>(new Map());
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const masterGainRef = useRef<GainNode | null>(null);

  const initializeAudioContext = async (masterVolume: number) => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.connect(audioContextRef.current.destination);
      masterGainRef.current.gain.value = masterVolume;
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      console.log('Audio system initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      return false;
    }
  };

  const updateMasterVolume = (volume: number) => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = volume;
    }
  };

  const stopAmbientLayer = (layer: string) => {
    const oscillator = oscillatorsRef.current.get(layer);
    const gainNode = gainNodesRef.current.get(layer);
    
    if (oscillator && gainNode && audioContextRef.current) {
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 1);
      oscillator.stop(audioContextRef.current.currentTime + 1);
      oscillatorsRef.current.delete(layer);
      gainNodesRef.current.delete(layer);
    }
  };

  const stopAllAmbientLayers = () => {
    oscillatorsRef.current.forEach((_, layer) => stopAmbientLayer(layer));
  };

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    audioContextRef,
    oscillatorsRef,
    gainNodesRef,
    masterGainRef,
    initializeAudioContext,
    updateMasterVolume,
    stopAmbientLayer,
    stopAllAmbientLayers
  };
};
