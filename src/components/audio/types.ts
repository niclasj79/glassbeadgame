
export interface AudioContextType {
  playDisciplineSound: (disciplineId: string, intensity?: number) => void;
  playSynthesisSound: (disciplines: string[], resonance: number) => void;
  playAmbientLayer: (layer: string) => void;
  stopAmbientLayer: (layer: string) => void;
  setMasterVolume: (volume: number) => void;
  isAudioEnabled: boolean;
  toggleAudio: () => void;
  initializeAudio: () => Promise<void>;
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
