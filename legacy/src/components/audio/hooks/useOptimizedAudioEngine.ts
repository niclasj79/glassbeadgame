
import { useCallback, useEffect, useRef } from 'react';
import { useAudioContext } from './useAudioContext';
import { useAudioState } from './useAudioState';
import { getDisciplineFrequencies } from '../utils/audioUtils';
import { memoryManager } from '../../game/arena/utils/memoryManager';

interface AudioNodePool {
  oscillators: OscillatorNode[];
  gainNodes: GainNode[];
  pannerNodes: PannerNode[];
}

export const useOptimizedAudioEngine = () => {
  const {
    audioContextRef,
    masterGainRef,
    initializeAudioContext,
    updateMasterVolume,
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

  // Audio node pool for reuse
  const nodePool = useRef<AudioNodePool>({
    oscillators: [],
    gainNodes: [],
    pannerNodes: []
  });

  const activeNodes = useRef<Set<AudioNode>>(new Set());
  const backgroundOscillatorsRef = useRef<Map<string, { osc: OscillatorNode; gain: GainNode }>>(new Map());
  const lastAudioActionRef = useRef<number>(0);

  // Node pool management
  const createOrReuseOscillator = useCallback(() => {
    if (!audioContextRef.current) return null;

    let oscillator = nodePool.current.oscillators.pop();
    if (!oscillator) {
      oscillator = audioContextRef.current.createOscillator();
    }
    
    activeNodes.current.add(oscillator);
    return oscillator;
  }, [audioContextRef]);

  const createOrReuseGainNode = useCallback(() => {
    if (!audioContextRef.current) return null;

    let gainNode = nodePool.current.gainNodes.pop();
    if (!gainNode) {
      gainNode = audioContextRef.current.createGain();
    }
    
    activeNodes.current.add(gainNode);
    return gainNode;
  }, [audioContextRef]);

  const createOrReusePannerNode = useCallback(() => {
    if (!audioContextRef.current) return null;

    let pannerNode = nodePool.current.pannerNodes.pop();
    if (!pannerNode) {
      pannerNode = audioContextRef.current.createPanner();
      pannerNode.panningModel = 'HRTF';
      pannerNode.distanceModel = 'inverse';
      pannerNode.refDistance = 1;
      pannerNode.maxDistance = 10;
      pannerNode.rolloffFactor = 1;
    }
    
    activeNodes.current.add(pannerNode);
    return pannerNode;
  }, [audioContextRef]);

  // Return nodes to pool
  const returnNodesToPool = useCallback((nodes: AudioNode[]) => {
    nodes.forEach(node => {
      activeNodes.current.delete(node);
      
      // Reset node state and return to pool
      if (node instanceof OscillatorNode) {
        nodePool.current.oscillators.push(node);
      } else if (node instanceof GainNode) {
        node.gain.value = 1;
        nodePool.current.gainNodes.push(node);
      } else if (node instanceof PannerNode) {
        node.positionX.value = 0;
        node.positionY.value = 0;
        node.positionZ.value = 0;
        nodePool.current.pannerNodes.push(node);
      }
    });
  }, []);

  // Throttled audio actions to prevent spam
  const isAudioActionAllowed = useCallback(() => {
    const now = Date.now();
    if (now - lastAudioActionRef.current < 50) { // 50ms throttle
      return false;
    }
    lastAudioActionRef.current = now;
    return true;
  }, []);

  // Optimized discipline sound with node pooling
  const playDisciplineSound = useCallback((disciplineId: string, intensity: number = 0.5, position?: { x: number; y: number; z: number }) => {
    if (!isAudioEnabled || !isInitialized || !audioContextRef.current || !masterGainRef.current) return;
    if (!isAudioActionAllowed()) return;
    
    const frequencies = getDisciplineFrequencies(disciplineId);
    const baseFreq = frequencies[0];
    
    const oscillator = createOrReuseOscillator();
    const gainNode = createOrReuseGainNode();
    
    if (!oscillator || !gainNode) return;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(baseFreq, audioContextRef.current.currentTime);
    
    gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
    gainNode.gain.linearRampToValueAtTime(intensity * 0.2, audioContextRef.current.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.8);
    
    if (position) {
      const pannerNode = createOrReusePannerNode();
      if (pannerNode) {
        pannerNode.positionX.setValueAtTime(position.x, audioContextRef.current.currentTime);
        pannerNode.positionY.setValueAtTime(position.y, audioContextRef.current.currentTime);
        pannerNode.positionZ.setValueAtTime(position.z, audioContextRef.current.currentTime);
        
        oscillator.connect(gainNode);
        gainNode.connect(pannerNode);
        pannerNode.connect(masterGainRef.current);
        
        // Schedule cleanup
        setTimeout(() => returnNodesToPool([oscillator, gainNode, pannerNode]), 1000);
      }
    } else {
      oscillator.connect(gainNode);
      gainNode.connect(masterGainRef.current);
      
      // Schedule cleanup
      setTimeout(() => returnNodesToPool([oscillator, gainNode]), 1000);
    }
    
    oscillator.start();
    oscillator.stop(audioContextRef.current.currentTime + 0.8);
  }, [isAudioEnabled, isInitialized, audioContextRef, masterGainRef, isAudioActionAllowed, createOrReuseOscillator, createOrReuseGainNode, createOrReusePannerNode, returnNodesToPool]);

  // Optimized background soundscape with reduced CPU usage
  const createBackgroundSoundscape = useCallback((concepts: any[], rotationX: number, rotationY: number) => {
    if (!isAudioEnabled || !isInitialized || !audioContextRef.current || !masterGainRef.current) return;

    // Limit background sounds to prevent audio clutter
    const maxBackgroundSounds = 3;
    
    // Stop existing background layers
    backgroundOscillatorsRef.current.forEach((nodes) => {
      try {
        nodes.osc.stop();
        returnNodesToPool([nodes.osc, nodes.gain]);
      } catch (error) {
        // Node might already be stopped
      }
    });
    backgroundOscillatorsRef.current.clear();

    // Create ambient layers based on most prominent disciplines
    const disciplineDensity = new Map();
    concepts.forEach(concept => {
      const count = disciplineDensity.get(concept.discipline) || 0;
      disciplineDensity.set(concept.discipline, count + 1);
    });

    // Sort by density and take top disciplines
    const sortedDisciplines = Array.from(disciplineDensity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxBackgroundSounds);

    sortedDisciplines.forEach(([discipline, density]) => {
      const frequencies = getDisciplineFrequencies(discipline);
      const baseFreq = frequencies[0] * 0.5;
      
      const oscillator = createOrReuseOscillator();
      const gainNode = createOrReuseGainNode();
      
      if (!oscillator || !gainNode) return;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(baseFreq, audioContextRef.current!.currentTime);
      
      const volume = Math.min(0.05, density * 0.01); // Reduced volume
      gainNode.gain.setValueAtTime(0, audioContextRef.current!.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioContextRef.current!.currentTime + 2);
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGainRef.current!);
      
      oscillator.start();
      
      backgroundOscillatorsRef.current.set(discipline, { osc: oscillator, gain: gainNode });
    });
  }, [isAudioEnabled, isInitialized, audioContextRef, masterGainRef, createOrReuseOscillator, createOrReuseGainNode, returnNodesToPool]);

  // Simplified dynamic panning
  const updateDynamicPanning = useCallback((rotationX: number, rotationY: number) => {
    // Simplified implementation to reduce CPU usage
    if (!isAudioEnabled || !isInitialized) return;
    
    // Only update panning for active background sounds
    backgroundOscillatorsRef.current.forEach((nodes, discipline) => {
      // Simple stereo panning based on rotation
      const panValue = Math.sin(rotationY) * 0.5;
      if (nodes.gain.gain.value > 0) {
        // Apply simple stereo panning instead of 3D positioning
        const stereoPanner = audioContextRef.current?.createStereoPanner();
        if (stereoPanner) {
          stereoPanner.pan.value = panValue;
        }
      }
    });
  }, [isAudioEnabled, isInitialized, audioContextRef]);

  // Initialize audio
  const initializeAudio = useCallback(async () => {
    if (isInitialized) {
      setIsAudioEnabled(true);
      return;
    }
    
    const success = await initializeAudioContext(masterVolume);
    if (success) {
      setIsInitialized(true);
      setIsAudioEnabled(true);
    }
  }, [isInitialized, initializeAudioContext, masterVolume, setIsInitialized, setIsAudioEnabled]);

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
            // Node might already be stopped
          }
        });
        backgroundOscillatorsRef.current.clear();
      }
    }
  }, [isAudioEnabled, isInitialized, initializeAudio, setIsAudioEnabled, stopAllAmbientLayers]);

  // Cleanup with memory management
  const cleanup = useCallback(() => {
    backgroundOscillatorsRef.current.forEach((nodes) => {
      try {
        nodes.osc.stop();
      } catch (error) {
        // Node might already be stopped
      }
    });
    backgroundOscillatorsRef.current.clear();
    
    // Clear node pools
    nodePool.current.oscillators = [];
    nodePool.current.gainNodes = [];
    nodePool.current.pannerNodes = [];
    activeNodes.current.clear();
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
    initializeAudio,
    toggleAudio,
    setMasterVolume,
    playDisciplineSound,
    createBackgroundSoundscape,
    updateDynamicPanning,
    cleanup
  };
};
