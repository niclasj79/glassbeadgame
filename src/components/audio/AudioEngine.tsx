
import React, { createContext, useContext } from 'react';
import { AudioContextType, AudioProviderProps } from './types';
import { useAudioEngine } from './hooks/useAudioEngine';

const AudioContext = createContext<AudioContextType | null>(null);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }
  return context;
};

export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
  const {
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
    playHoverSound,
    playGrabSound,
    playDropSound,
    playRotationSound,
    playProximityTension,
    playSynthesisChord,
    updateSoundtrackIntensity,
  } = useAudioEngine();

  const playSynthesisSound = (disciplines: string[], resonance: number) => {
    if (disciplines.length >= 2) {
      playSynthesisChord(disciplines[0], disciplines[1], resonance);
    } else {
      disciplines.forEach((disciplineId, index) => {
        setTimeout(() => { playDisciplineSound(disciplineId, resonance); }, index * 150);
      });
    }
  };

  const playAmbientLayer = (layer: string) => {
    console.log('Ambient layer request:', layer);
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
        initializeAudio,
        preloadAudio,
        createBackgroundSoundscape,
        updateDynamicPanning,
        playHoverSound,
        playGrabSound,
        playDropSound,
        playRotationSound,
        playProximityTension,
        playSynthesisChord,
        updateSoundtrackIntensity,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};
