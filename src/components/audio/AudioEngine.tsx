import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface AudioContextType {
  playDisciplineSound: (disciplineId: string, intensity?: number) => void;
  playSynthesisSound: (disciplines: string[], resonance: number) => void;
  playAmbientLayer: (layer: string) => void;
  stopAmbientLayer: (layer: string) => void;
  setMasterVolume: (volume: number) => void;
  isAudioEnabled: boolean;
  toggleAudio: () => void;
  initializeAudio: () => Promise<void>;
}

const AudioContext = createContext<AudioContextType | null>(null);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }
  return context;
};

interface AudioProviderProps {
  children: React.ReactNode;
}

export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<Map<string, OscillatorNode>>(new Map());
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const masterGainRef = useRef<GainNode | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [masterVolume, setMasterVolumeState] = useState(0.3);
  const [isInitialized, setIsInitialized] = useState(false);

  const initializeAudio = async () => {
    if (isInitialized) return;
    
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.connect(audioContextRef.current.destination);
      masterGainRef.current.gain.value = masterVolume;
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      setIsInitialized(true);
      setIsAudioEnabled(true);
      console.log('Audio system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  };

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const createTone = (frequency: number, type: OscillatorType = 'sine', duration: number = 1000) => {
    if (!audioContextRef.current || !masterGainRef.current || !isAudioEnabled) return;

    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
    
    gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioContextRef.current.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration / 1000);
    
    oscillator.connect(gainNode);
    gainNode.connect(masterGainRef.current);
    
    oscillator.start();
    oscillator.stop(audioContextRef.current.currentTime + duration / 1000);
  };

  const getDisciplineFrequencies = (disciplineId: string) => {
    const frequencies = {
      mathematics: [261.63, 329.63, 392.00], // C-E-G major triad
      music: [220.00, 277.18, 330.00], // A-C#-E major triad
      philosophy: [196.00, 246.94, 293.66], // G-B-D major triad
      physics: [174.61, 220.00, 261.63], // F-A-C major triad
      art: [146.83, 185.00, 220.00], // D-F#-A major triad
      history: [130.81, 164.81, 196.00] // C-E-G lower octave
    };
    return frequencies[disciplineId as keyof typeof frequencies] || frequencies.mathematics;
  };

  const playDisciplineSound = (disciplineId: string, intensity: number = 0.5) => {
    if (!isAudioEnabled || !isInitialized) return;
    
    const frequencies = getDisciplineFrequencies(disciplineId);
    const baseFreq = frequencies[0];
    const harmonicFreq = frequencies[1];
    
    // Play base tone
    createTone(baseFreq, 'sine', 800);
    
    // Play harmonic based on intensity
    if (intensity > 0.3) {
      setTimeout(() => createTone(harmonicFreq, 'triangle', 600), 200);
    }
    
    // Play high harmonic for high intensity
    if (intensity > 0.7) {
      setTimeout(() => createTone(frequencies[2], 'sawtooth', 400), 400);
    }
  };

  const playSynthesisSound = (disciplines: string[], resonance: number) => {
    if (!isAudioEnabled || disciplines.length === 0 || !isInitialized) return;
    
    disciplines.forEach((disciplineId, index) => {
      const frequencies = getDisciplineFrequencies(disciplineId);
      const delay = index * 150;
      
      setTimeout(() => {
        frequencies.forEach((freq, freqIndex) => {
          const modifiedFreq = freq * (1 + resonance * 0.1);
          setTimeout(() => createTone(modifiedFreq, 'sine', 1200), freqIndex * 100);
        });
      }, delay);
    });
    
    // Add synthesis chord
    setTimeout(() => {
      const synthFreqs = [440, 554.37, 659.25]; // A-C#-E
      synthFreqs.forEach((freq, index) => {
        setTimeout(() => createTone(freq, 'triangle', 2000), index * 50);
      });
    }, disciplines.length * 150);
  };

  const playAmbientLayer = (layer: string) => {
    if (!isAudioEnabled || !audioContextRef.current || !masterGainRef.current || !isInitialized) return;
    
    const layerFreqs = {
      cosmic: 55, // Deep bass
      harmonic: 110, // Low harmonic
      ethereal: 220 // Mid-range tone
    };
    
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

  const setMasterVolume = (volume: number) => {
    setMasterVolumeState(volume);
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = volume;
    }
  };

  const toggleAudio = () => {
    if (!isAudioEnabled && !isInitialized) {
      initializeAudio();
    } else {
      setIsAudioEnabled(!isAudioEnabled);
      if (isAudioEnabled) {
        // Stop all ambient layers when disabling
        oscillatorsRef.current.forEach((_, layer) => stopAmbientLayer(layer));
      }
    }
  };

  return (
    <AudioContext.Provider
      value={{
        playDisciplineSound,
        playSynthesisSound,
        playAmbientLayer,
        stopAmbientLayer,
        setMasterVolume,
        isAudioEnabled,
        toggleAudio,
        initializeAudio
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};
