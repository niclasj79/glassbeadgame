
import { useCallback, useEffect, useRef } from 'react';
import { useAudioContext } from './useAudioContext';
import { useAudioState } from './useAudioState';
import { getDisciplineFrequencies, getLayerFrequencies } from '../utils/audioUtils';

export const useAudioEngine = () => {
  const {
    audioContextRef,
    oscillatorsRef,
    gainNodesRef,
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

  // Create continuous background soundscape
  const createBackgroundSoundscape = useCallback((concepts: any[], rotationX: number, rotationY: number) => {
    if (!isAudioEnabled || !isInitialized || !audioContextRef.current || !masterGainRef.current) return;

    // Stop existing background layers
    backgroundOscillatorsRef.current.forEach((nodes, key) => {
      nodes.osc.stop();
      backgroundOscillatorsRef.current.delete(key);
      pannerNodesRef.current.delete(key);
    });

    // Create ambient layers based on concept density and positions
    const disciplineDensity = new Map();
    concepts.forEach(concept => {
      const count = disciplineDensity.get(concept.discipline) || 0;
      disciplineDensity.set(concept.discipline, count + 1);
    });

    disciplineDensity.forEach((density, discipline) => {
      const frequencies = getDisciplineFrequencies(discipline);
      const baseFreq = frequencies[0] * 0.5; // Lower octave for ambient layer
      
      // Create oscillator with panner
      const oscillator = audioContextRef.current!.createOscillator();
      const gainNode = audioContextRef.current!.createGain();
      const pannerNode = audioContextRef.current!.createPanner();
      
      // Configure oscillator
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(baseFreq, audioContextRef.current!.currentTime);
      
      // Configure gain based on concept density
      const volume = Math.min(0.1, density * 0.02);
      gainNode.gain.setValueAtTime(0, audioContextRef.current!.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioContextRef.current!.currentTime + 2);
      
      // Configure 3D positioning
      pannerNode.panningModel = 'HRTF';
      pannerNode.distanceModel = 'inverse';
      pannerNode.refDistance = 1;
      pannerNode.maxDistance = 10;
      pannerNode.rolloffFactor = 1;
      
      // Calculate position based on sphere rotation
      const angle = Array.from(disciplineDensity.keys()).indexOf(discipline) * (Math.PI * 2 / disciplineDensity.size);
      const x = Math.cos(angle + rotationY) * Math.cos(rotationX);
      const y = Math.sin(rotationX);
      const z = Math.sin(angle + rotationY) * Math.cos(rotationX);
      
      pannerNode.positionX.setValueAtTime(x * 2, audioContextRef.current!.currentTime);
      pannerNode.positionY.setValueAtTime(y * 2, audioContextRef.current!.currentTime);
      pannerNode.positionZ.setValueAtTime(z * 2, audioContextRef.current!.currentTime);
      
      // Connect audio graph
      oscillator.connect(gainNode);
      gainNode.connect(pannerNode);
      pannerNode.connect(masterGainRef.current!);
      
      oscillator.start();
      
      // Store references
      backgroundOscillatorsRef.current.set(discipline, { osc: oscillator, gain: gainNode });
      pannerNodesRef.current.set(discipline, pannerNode);
    });
  }, [isAudioEnabled, isInitialized, audioContextRef, masterGainRef]);

  // Update dynamic panning based on sphere rotation
  const updateDynamicPanning = useCallback((rotationX: number, rotationY: number) => {
    if (!isAudioEnabled || !isInitialized || !audioContextRef.current) return;

    pannerNodesRef.current.forEach((pannerNode, discipline) => {
      const disciplineIndex = Array.from(pannerNodesRef.current.keys()).indexOf(discipline);
      const angle = disciplineIndex * (Math.PI * 2 / pannerNodesRef.current.size);
      
      const x = Math.cos(angle + rotationY) * Math.cos(rotationX);
      const y = Math.sin(rotationX);
      const z = Math.sin(angle + rotationY) * Math.cos(rotationX);
      
      pannerNode.positionX.setValueAtTime(x * 2, audioContextRef.current!.currentTime);
      pannerNode.positionY.setValueAtTime(y * 2, audioContextRef.current!.currentTime);
      pannerNode.positionZ.setValueAtTime(z * 2, audioContextRef.current!.currentTime);
    });
  }, [isAudioEnabled, isInitialized, audioContextRef]);

  // Play discipline sound with 3D positioning
  const playDisciplineSound = useCallback((disciplineId: string, intensity: number = 0.5, position?: { x: number; y: number; z: number }) => {
    if (!isAudioEnabled || !isInitialized || !audioContextRef.current || !masterGainRef.current) return;
    
    const frequencies = getDisciplineFrequencies(disciplineId);
    const baseFreq = frequencies[0];
    
    // Create oscillator with optional panner
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(baseFreq, audioContextRef.current.currentTime);
    
    gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
    gainNode.gain.linearRampToValueAtTime(intensity * 0.2, audioContextRef.current.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.8);
    
    if (position) {
      const pannerNode = audioContextRef.current.createPanner();
      pannerNode.panningModel = 'HRTF';
      pannerNode.positionX.setValueAtTime(position.x, audioContextRef.current.currentTime);
      pannerNode.positionY.setValueAtTime(position.y, audioContextRef.current.currentTime);
      pannerNode.positionZ.setValueAtTime(position.z, audioContextRef.current.currentTime);
      
      oscillator.connect(gainNode);
      gainNode.connect(pannerNode);
      pannerNode.connect(masterGainRef.current);
    } else {
      oscillator.connect(gainNode);
      gainNode.connect(masterGainRef.current);
    }
    
    oscillator.start();
    oscillator.stop(audioContextRef.current.currentTime + 0.8);
  }, [isAudioEnabled, isInitialized, audioContextRef, masterGainRef]);

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
          nodes.osc.stop();
        });
        backgroundOscillatorsRef.current.clear();
        pannerNodesRef.current.clear();
      }
    }
  }, [isAudioEnabled, isInitialized, initializeAudio, setIsAudioEnabled, stopAllAmbientLayers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      backgroundOscillatorsRef.current.forEach((nodes) => {
        try {
          nodes.osc.stop();
        } catch (error) {
          // Oscillator might already be stopped
        }
      });
      backgroundOscillatorsRef.current.clear();
      pannerNodesRef.current.clear();
    };
  }, []);

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
    stopAllAmbientLayers
  };
};
