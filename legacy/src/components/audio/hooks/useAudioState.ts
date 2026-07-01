
import { useState } from 'react';

export const useAudioState = () => {
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [masterVolume, setMasterVolumeState] = useState(0.3);
  const [isInitialized, setIsInitialized] = useState(false);

  return {
    isAudioEnabled,
    setIsAudioEnabled,
    masterVolume,
    setMasterVolumeState,
    isInitialized,
    setIsInitialized
  };
};
