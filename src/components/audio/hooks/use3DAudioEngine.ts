
import { useCallback, useRef, useEffect } from 'react';
import { useAudioContext } from './useAudioContext';
import { useAudioState } from './useAudioState';
import { getDisciplineFrequencies } from '../utils/audioUtils';
import { memoryManager } from '../../game/arena/utils/memoryManager';

interface SpatialAudioNode {
  oscillator: OscillatorNode;
  gainNode: GainNode;
  pannerNode: PannerNode;
  filterNode: BiquadFilterNode;
  position: { x: number; y: number; z: number };
  conceptId: string;
}

interface AudioQualitySettings {
  spatialAccuracy: 'basic' | 'enhanced' | 'premium';
  reverbEnabled: boolean;
  doppler: boolean;
  atmosphericFiltering: boolean;
  maxConcurrentSounds: number;
}

export const use3DAudioEngine = () => {
  const { audioContextRef, masterGainRef } = useAudioContext();
  const { isAudioEnabled, isInitialized } = useAudioState();
  
  const spatialNodes = useRef<Map<string, SpatialAudioNode>>(new Map());
  const convolverRef = useRef<ConvolverNode | null>(null);
  const listenerPositionRef = useRef({ x: 0, y: 0, z: 0 });
  const listenerOrientationRef = useRef({ forward: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 } });
  
  const [qualitySettings, setQualitySettings] = React.useState<AudioQualitySettings>({
    spatialAccuracy: 'enhanced',
    reverbEnabled: true,
    doppler: true,
    atmosphericFiltering: true,
    maxConcurrentSounds: 8
  });

  // Initialize reverb impulse response
  const initializeReverb = useCallback(async () => {
    if (!audioContextRef.current || convolverRef.current) return;

    try {
      convolverRef.current = audioContextRef.current.createConvolver();
      
      // Create synthetic impulse response for spacious reverb
      const length = audioContextRef.current.sampleRate * 2; // 2 seconds
      const impulse = audioContextRef.current.createBuffer(2, length, audioContextRef.current.sampleRate);
      
      for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          const decay = Math.pow(1 - i / length, 2);
          channelData[i] = (Math.random() * 2 - 1) * decay * 0.3;
        }
      }
      
      convolverRef.current.buffer = impulse;
      convolverRef.current.connect(masterGainRef.current!);
      
      console.log('3D Audio: Reverb system initialized');
    } catch (error) {
      console.error('Failed to initialize reverb:', error);
    }
  }, [audioContextRef, masterGainRef]);

  // Create advanced spatial audio node
  const createSpatialAudioNode = useCallback((
    conceptId: string,
    frequency: number,
    position: { x: number; y: number; z: number },
    intensity: number = 0.5
  ): SpatialAudioNode | null => {
    if (!audioContextRef.current || !masterGainRef.current) return null;

    try {
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      const pannerNode = audioContextRef.current.createPanner();
      const filterNode = audioContextRef.current.createBiquadFilter();

      // Configure oscillator
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);

      // Configure spatial panner with enhanced settings
      pannerNode.panningModel = qualitySettings.spatialAccuracy === 'premium' ? 'HRTF' : 'equalpower';
      pannerNode.distanceModel = 'inverse';
      pannerNode.refDistance = 1;
      pannerNode.maxDistance = 100;
      pannerNode.rolloffFactor = qualitySettings.spatialAccuracy === 'basic' ? 1 : 2;
      pannerNode.coneInnerAngle = 360;
      pannerNode.coneOuterAngle = 0;
      pannerNode.coneOuterGain = 0;

      // Set position
      pannerNode.positionX.setValueAtTime(position.x, audioContextRef.current.currentTime);
      pannerNode.positionY.setValueAtTime(position.y, audioContextRef.current.currentTime);
      pannerNode.positionZ.setValueAtTime(position.z, audioContextRef.current.currentTime);

      // Configure atmospheric filtering
      if (qualitySettings.atmosphericFiltering) {
        filterNode.type = 'lowpass';
        const distance = Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);
        const cutoff = Math.max(200, 8000 - distance * 100); // Distant sounds are more muffled
        filterNode.frequency.setValueAtTime(cutoff, audioContextRef.current.currentTime);
        filterNode.Q.setValueAtTime(1, audioContextRef.current.currentTime);
      }

      // Configure gain with distance-based volume
      const distance = Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);
      const distanceGain = Math.max(0.01, 1 / (1 + distance * 0.1));
      gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
      gainNode.gain.linearRampToValueAtTime(intensity * distanceGain * 0.2, audioContextRef.current.currentTime + 0.1);

      // Create audio chain
      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(pannerNode);
      pannerNode.connect(masterGainRef.current);

      // Add reverb if enabled
      if (qualitySettings.reverbEnabled && convolverRef.current) {
        const reverbGain = audioContextRef.current.createGain();
        reverbGain.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
        pannerNode.connect(reverbGain);
        reverbGain.connect(convolverRef.current);
      }

      const spatialNode: SpatialAudioNode = {
        oscillator,
        gainNode,
        pannerNode,
        filterNode,
        position: { ...position },
        conceptId
      };

      return spatialNode;
    } catch (error) {
      console.error('Failed to create spatial audio node:', error);
      return null;
    }
  }, [audioContextRef, masterGainRef, qualitySettings]);

  // Play concept with advanced 3D positioning
  const playConceptWith3D = useCallback((
    conceptId: string,
    disciplineId: string,
    position: { x: number; y: number; z: number },
    intensity: number = 0.5,
    duration: number = 1000
  ) => {
    if (!isAudioEnabled || !isInitialized) return;

    // Limit concurrent sounds for performance
    if (spatialNodes.current.size >= qualitySettings.maxConcurrentSounds) {
      const oldestNode = spatialNodes.current.values().next().value;
      if (oldestNode) {
        stopSpatialNode(oldestNode.conceptId);
      }
    }

    const frequencies = getDisciplineFrequencies(disciplineId);
    const baseFreq = frequencies[0];

    const spatialNode = createSpatialAudioNode(conceptId, baseFreq, position, intensity);
    if (!spatialNode) return;

    spatialNodes.current.set(conceptId, spatialNode);

    // Start oscillator
    spatialNode.oscillator.start();
    
    // Schedule stop
    setTimeout(() => {
      if (spatialNodes.current.has(conceptId)) {
        stopSpatialNode(conceptId);
      }
    }, duration);

    console.log(`3D Audio: Playing concept ${conceptId} at position:`, position);
  }, [isAudioEnabled, isInitialized, qualitySettings, createSpatialAudioNode]);

  // Stop spatial audio node
  const stopSpatialNode = useCallback((conceptId: string) => {
    const node = spatialNodes.current.get(conceptId);
    if (!node) return;

    try {
      node.oscillator.stop();
      spatialNodes.current.delete(conceptId);
      console.log(`3D Audio: Stopped concept ${conceptId}`);
    } catch (error) {
      console.warn('Error stopping spatial node:', error);
    }
  }, []);

  // Update listener position and orientation
  const updateListenerPosition = useCallback((
    position: { x: number; y: number; z: number },
    orientation?: { forward: { x: number; y: number; z: number }, up: { x: number; y: number; z: number } }
  ) => {
    if (!audioContextRef.current || !audioContextRef.current.listener) return;

    const listener = audioContextRef.current.listener;
    const currentTime = audioContextRef.current.currentTime;

    // Update position
    if (listener.positionX) {
      listener.positionX.setValueAtTime(position.x, currentTime);
      listener.positionY.setValueAtTime(position.y, currentTime);
      listener.positionZ.setValueAtTime(position.z, currentTime);
    }

    // Update orientation
    if (orientation && listener.forwardX) {
      listener.forwardX.setValueAtTime(orientation.forward.x, currentTime);
      listener.forwardY.setValueAtTime(orientation.forward.y, currentTime);
      listener.forwardZ.setValueAtTime(orientation.forward.z, currentTime);
      listener.upX.setValueAtTime(orientation.up.x, currentTime);
      listener.upY.setValueAtTime(orientation.up.y, currentTime);
      listener.upZ.setValueAtTime(orientation.up.z, currentTime);
    }

    listenerPositionRef.current = position;
    if (orientation) {
      listenerOrientationRef.current = orientation;
    }
  }, [audioContextRef]);

  // Update concept position in real-time
  const updateConceptPosition = useCallback((
    conceptId: string,
    newPosition: { x: number; y: number; z: number }
  ) => {
    const node = spatialNodes.current.get(conceptId);
    if (!node || !audioContextRef.current) return;

    const currentTime = audioContextRef.current.currentTime;
    
    // Smooth transition to new position
    node.pannerNode.positionX.linearRampToValueAtTime(newPosition.x, currentTime + 0.1);
    node.pannerNode.positionY.linearRampToValueAtTime(newPosition.y, currentTime + 0.1);
    node.pannerNode.positionZ.linearRampToValueAtTime(newPosition.z, currentTime + 0.1);

    // Update atmospheric filtering based on new distance
    if (qualitySettings.atmosphericFiltering) {
      const distance = Math.sqrt(newPosition.x ** 2 + newPosition.y ** 2 + newPosition.z ** 2);
      const cutoff = Math.max(200, 8000 - distance * 100);
      node.filterNode.frequency.linearRampToValueAtTime(cutoff, currentTime + 0.1);
    }

    node.position = { ...newPosition };
  }, [audioContextRef, qualitySettings]);

  // Initialize 3D audio system
  const initialize3DAudio = useCallback(async () => {
    if (!audioContextRef.current) return;

    await initializeReverb();
    
    // Set initial listener position
    updateListenerPosition({ x: 0, y: 0, z: 0 });
    
    console.log('3D Audio Engine initialized with settings:', qualitySettings);
  }, [initializeReverb, updateListenerPosition, qualitySettings]);

  // Cleanup
  const cleanup = useCallback(() => {
    spatialNodes.current.forEach((node, conceptId) => {
      stopSpatialNode(conceptId);
    });
    spatialNodes.current.clear();
  }, [stopSpatialNode]);

  // Register cleanup
  useEffect(() => {
    if (isInitialized) {
      initialize3DAudio();
    }
    
    memoryManager.registerCleanupTask(cleanup);
    return () => {
      memoryManager.unregisterCleanupTask(cleanup);
      cleanup();
    };
  }, [isInitialized, initialize3DAudio, cleanup]);

  return {
    playConceptWith3D,
    updateListenerPosition,
    updateConceptPosition,
    stopSpatialNode,
    qualitySettings,
    setQualitySettings,
    cleanup,
    getSpatialNodeCount: () => spatialNodes.current.size
  };
};
