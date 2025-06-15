
import { useCallback, useEffect, useRef } from 'react';
import { useAudioContext } from './useAudioContext';
import { useAudioState } from './useAudioState';
import { getDisciplineFrequencies } from '../utils/audioUtils';
import { memoryManager } from '../../game/arena/utils/memoryManager';

export const useAudioEngine = () => {
  const {
    audioContextRef,
    masterGainRef,
    initializeAudioContext,
    updateMasterVolume,
    stopAmbientLayer,
    stopAllAmbientLayers
  } = useAudioContext();

  const {
    isAudioEnabled,
    setIsAudioEnabled,
    masterVolume,
    setMasterVolumeState,
    isInitialized,
    setIsInitialized
  } = useAudioState();

  const backgroundOscillatorsRef = useRef<Map<string, { osc: OscillatorNode; gain: GainNode }>>(new Map());
  const pannerNodesRef = useRef<Map<string, PannerNode>>(new Map());
  const lastAudioActionRef = useRef<number>(0);

  // Throttle audio actions to prevent performance issues
  const isAudioActionAllowed = useCallback(() => {
    const now = Date.now();
    if (now - lastAudioActionRef.current < 50) { // 50ms throttle
      return false;
    }
    lastAudioActionRef.current = now;
    return true;
  }, []);

  // Pre-load audio engine
  const preloadAudio = useCallback(async () => {
    if (isInitialized) return true;
    
    try {
      const success = await initializeAudioContext(masterVolume);
      if (success) {
        setIsInitialized(true);
        console.log('Audio engine pre-loaded successfully');
        return true;
      }
    } catch (error) {
      console.error('Failed to pre-load audio engine:', error);
    }
    return false;
  }, [isInitialized, initializeAudioContext, masterVolume, setIsInitialized]);

  // Optimized background soundscape with reduced complexity
  const createBackgroundSoundscape = useCallback((concepts: any[], rotationX: number, rotationY: number) => {
    if (!isAudioEnabled || !isInitialized || !audioContextRef.current || !masterGainRef.current) return;

    // Limit background sounds for better performance
    const maxBackgroundSounds = 2;
    
    // Stop existing background layers
    backgroundOscillatorsRef.current.forEach((nodes) => {
      try {
        nodes.osc.stop();
      } catch (error) {
        // Node might already be stopped
      }
    });
    backgroundOscillatorsRef.current.clear();
    pannerNodesRef.current.clear();

    // Create ambient layers based on concept density
    const disciplineDensity = new Map();
    concepts.forEach(concept => {
      const count = disciplineDensity.get(concept.discipline) || 0;
      disciplineDensity.set(concept.discipline, count + 1);
    });

    // Take only the most prominent disciplines
    const sortedDisciplines = Array.from(disciplineDensity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxBackgroundSounds);

    sortedDisciplines.forEach(([discipline, density]) => {
      const frequencies = getDisciplineFrequencies(discipline);
      const baseFreq = frequencies[0] * 0.5; // Lower octave for ambient layer
      
      // Create oscillator with simplified panner
      const oscillator = audioContextRef.current!.createOscillator();
      const gainNode = audioContextRef.current!.createGain();
      
      // Configure oscillator
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(baseFreq, audioContextRef.current!.currentTime);
      
      // Configure gain based on concept density (reduced volume)
      const volume = Math.min(0.05, density * 0.01);
      gainNode.gain.setValueAtTime(0, audioContextRef.current!.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioContextRef.current!.currentTime + 2);
      
      // Simplified audio chain without 3D positioning for better performance
      oscillator.connect(gainNode);
      gainNode.connect(masterGainRef.current!);
      
      oscillator.start();
      
      // Store references
      backgroundOscillatorsRef.current.set(discipline, { osc: oscillator, gain: gainNode });
    });
  }, [isAudioEnabled, isInitialized, audioContextRef, masterGainRef]);

  // Simplified dynamic panning
  const updateDynamicPanning = useCallback((rotationX: number, rotationY: number) => {
    if (!isAudioEnabled || !isInitialized || !audioContextRef.current) return;
    
    // Simplified panning - just adjust gain based on rotation
    backgroundOscillatorsRef.current.forEach((nodes) => {
      const panValue = Math.sin(rotationY) * 0.1; // Subtle effect
      const currentGain = nodes.gain.gain.value;
      if (currentGain > 0) {
        nodes.gain.gain.setValueAtTime(currentGain * (1 + panValue), audioContextRef.current!.currentTime);
      }
    });
  }, [isAudioEnabled, isInitialized, audioContextRef]);

  // Optimized discipline sound with throttling
  const playDisciplineSound = useCallback((disciplineId: string, intensity: number = 0.5, position?: { x: number; y: number; z: number }) => {
    if (!isAudioEnabled || !isInitialized || !audioContextRef.current || !masterGainRef.current) return;
    if (!isAudioActionAllowed()) return;
    
    const frequencies = getDisciplineFrequencies(disciplineId);
    const baseFreq = frequencies[0];
    
    // Create oscillator
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(baseFreq, audioContextRef.current.currentTime);
    
    gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
    gainNode.gain.linearRampToValueAtTime(intensity * 0.15, audioContextRef.current.currentTime + 0.1); // Reduced volume
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.6); // Shorter duration
    
    oscillator.connect(gainNode);
    gainNode.connect(masterGainRef.current);
    
    oscillator.start();
    oscillator.stop(audioContextRef.current.currentTime + 0.6);
  }, [isAudioEnabled, isInitialized, audioContextRef, masterGainRef, isAudioActionAllowed]);

  // Initialize audio on session start
  const initializeAudio = useCallback(async () => {
    if (isInitialized) {
      setIsAudioEnabled(true);
      return;
    }
    
    const success = await preloadAudio();
    if (success) {
      setIsAudioEnabled(true);
    }
  }, [isInitialized, preloadAudio, setIsAudioEnabled]);

  const setMasterVolume = useCallback((volume: number) => {
    setMasterVolumeState(volume);
    updateMasterVolume(volume);
  }, [setMasterVolumeState, updateMasterVolume]);

  const toggleAudio = useCallback(() => {
    if (!isAudioEnabled && !isInitialized) {
      initializeAudio();
    } else {
      setIsAudioEnabled(!isAudioEnabled);
      if (isAudioEnabled) {
        stopAllAmbientLayers();
        backgroundOscillatorsRef.current.forEach((nodes) => {
          try {
            nodes.osc.stop();
          } catch (error) {
            // Oscillator might already be stopped
          }
        });
        backgroundOscillatorsRef.current.clear();
        pannerNodesRef.current.clear();
      }
    }
  }, [isAudioEnabled, isInitialized, initializeAudio, setIsAudioEnabled, stopAllAmbientLayers]);

  // Cleanup with memory management
  const cleanup = useCallback(() => {
    backgroundOscillatorsRef.current.forEach((nodes) => {
      try {
        nodes.osc.stop();
      } catch (error) {
        // Oscillator might already be stopped
      }
    });
    backgroundOscillatorsRef.current.clear();
    pannerNodesRef.current.clear();
  }, []);

  // Register cleanup with memory manager
  useEffect(() => {
    memoryManager.registerCleanupTask(cleanup);
    return () => {
      memoryManager.unregisterCleanupTask(cleanup);
      cleanup();
    };
  }, [cleanup]);

  return {
    isAudioEnabled,
    isInitialized,
    masterVolume,
    preloadAudio,
    initializeAudio,
    toggleAudio,
    setMasterVolume,
    playDisciplineSound,
    createBackgroundSoundscape,
    updateDynamicPanning,
    stopAmbientLayer,
    stopAllAmbientLayers,
    cleanup
  };
};
