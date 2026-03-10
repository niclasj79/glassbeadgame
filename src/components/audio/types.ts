
export interface AudioContextType {
  playDisciplineSound: (disciplineId: string, intensity?: number, position?: { x: number; y: number; z: number }) => void;
  playSynthesisSound: (disciplines: string[], resonance: number) => void;
  playAmbientLayer: (layer: string) => void;
  stopAmbientLayer: (layer: string) => void;
  setMasterVolume: (volume: number) => void;
  isAudioEnabled: boolean;
  toggleAudio: () => void;
  initializeAudio: () => Promise<void>;
  preloadAudio?: () => Promise<boolean>;
  createBackgroundSoundscape?: (concepts: any[], rotationX: number, rotationY: number) => void;
  updateDynamicPanning?: (rotationX: number, rotationY: number) => void;
  // New reactive sounds
  playHoverSound?: () => void;
  playGrabSound?: () => void;
  playDropSound?: () => void;
  playRotationSound?: (direction: number) => void;
  playProximityTension?: (proximity: number) => void;
  playSynthesisChord?: (discipline1: string, discipline2: string, resonance: number) => void;
  updateSoundtrackIntensity?: (totalResonance: number) => void;
}

export interface AudioProviderProps {
  children: React.ReactNode;
}

export interface ConversationOverrides {
  overrides?: {
    agent?: {
      prompt?: {
        prompt?: string;
      };
      firstMessage?: string;
      language?: string;
    };
    tts?: {
      voiceId?: string;
    };
  };
}
