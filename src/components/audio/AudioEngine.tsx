
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
    stopAmbientLayer
  } = useAudioEngine();

  // Enhanced playSynthesisSound for multiple disciplines
  const playSynthesisSound = (disciplines: string[], resonance: number) => {
    disciplines.forEach((disciplineId, index) => {
      setTimeout(() => {
        playDisciplineSound(disciplineId, resonance);
      }, index * 150);
    });
  };

  // Enhanced playAmbientLayer (now handled by background soundscape)
  const playAmbientLayer = (layer: string) => {
    console.log('Ambient layer request:', layer);
    // This is now handled by createBackgroundSoundscape
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
        updateDynamicPanning
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};
