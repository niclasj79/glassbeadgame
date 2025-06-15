
import React, { createContext, useContext } from 'react';
import { AudioContextType, AudioProviderProps } from './types';
import { useAudioContext } from './hooks/useAudioContext';
import { useAudioState } from './hooks/useAudioState';
import { useAudioFunctions } from './hooks/useAudioFunctions';

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

  const { playDisciplineSound, playSynthesisSound, playAmbientLayer } = useAudioFunctions(
    audioContextRef,
    masterGainRef,
    oscillatorsRef,
    gainNodesRef,
    isAudioEnabled,
    isInitialized,
    stopAmbientLayer
  );

  const initializeAudio = async () => {
    if (isInitialized) return;
    
    const success = await initializeAudioContext(masterVolume);
    if (success) {
      setIsInitialized(true);
      setIsAudioEnabled(true);
    }
  };

  const setMasterVolume = (volume: number) => {
    setMasterVolumeState(volume);
    updateMasterVolume(volume);
  };

  const toggleAudio = () => {
    if (!isAudioEnabled && !isInitialized) {
      initializeAudio();
    } else {
      setIsAudioEnabled(!isAudioEnabled);
      if (isAudioEnabled) {
        stopAllAmbientLayers();
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
