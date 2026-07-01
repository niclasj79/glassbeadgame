import React from 'react';
import { useAudio } from './AudioEngine';
import { Volume2, VolumeX } from 'lucide-react';

interface AudioControlsProps {
  className?: string;
}

export const AudioControls: React.FC<AudioControlsProps> = ({ className = '' }) => {
  const { isAudioEnabled, toggleAudio } = useAudio();

  return (
    <button
      onClick={toggleAudio}
      className={`p-2.5 rounded-full backdrop-blur-sm transition-all ${className}`}
      style={{
        background: isAudioEnabled
          ? 'hsla(260, 60%, 45%, 0.4)'
          : 'hsla(240, 20%, 15%, 0.5)',
        border: `1px solid ${isAudioEnabled ? 'hsla(260, 60%, 55%, 0.4)' : 'hsla(240, 20%, 30%, 0.4)'}`,
        color: isAudioEnabled ? 'hsl(var(--game-text-bright))' : 'hsl(var(--game-text-dim))',
      }}
      aria-label={isAudioEnabled ? 'Mute audio' : 'Enable audio'}
    >
      {isAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
    </button>
  );
};
