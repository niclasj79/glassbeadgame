
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useAudio } from './AudioEngine';
import { Volume2, VolumeX, Music, Headphones } from 'lucide-react';

interface AudioControlsProps {
  className?: string;
}

export const AudioControls: React.FC<AudioControlsProps> = ({ className = '' }) => {
  const { 
    isAudioEnabled, 
    toggleAudio, 
    setMasterVolume,
    playAmbientLayer,
    stopAmbientLayer
  } = useAudio();
  
  const [volume, setVolume] = useState([30]);
  const [activeAmbients, setActiveAmbients] = useState<string[]>([]);

  const handleVolumeChange = (newVolume: number[]) => {
    setVolume(newVolume);
    setMasterVolume(newVolume[0] / 100);
  };

  const toggleAmbientLayer = (layer: string) => {
    if (activeAmbients.includes(layer)) {
      stopAmbientLayer(layer);
      setActiveAmbients(prev => prev.filter(l => l !== layer));
    } else {
      playAmbientLayer(layer);
      setActiveAmbients(prev => [...prev, layer]);
    }
  };

  const ambientLayers = [
    { id: 'cosmic', name: 'Cosmic', description: 'Deep space resonance' },
    { id: 'harmonic', name: 'Harmonic', description: 'Mathematical harmonies' },
    { id: 'ethereal', name: 'Ethereal', description: 'Transcendent atmosphere' }
  ];

  return (
    <Card className={`bg-gray-800 border-gray-700 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Headphones className="w-5 h-5" />
          Synesthetic Audio
        </h3>
        <Badge variant={isAudioEnabled ? "default" : "secondary"}>
          {isAudioEnabled ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="space-y-4">
        {/* Master Controls */}
        <div className="flex items-center gap-4">
          <Button
            variant={isAudioEnabled ? "default" : "outline"}
            onClick={toggleAudio}
            className={isAudioEnabled ? "bg-green-600 hover:bg-green-700" : "border-gray-600"}
          >
            {isAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          
          <div className="flex-1">
            <label className="text-sm text-gray-400 mb-1 block">
              Master Volume: {volume[0]}%
            </label>
            <Slider
              value={volume}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              disabled={!isAudioEnabled}
              className="w-full"
            />
          </div>
        </div>

        {/* Ambient Layers */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <Music className="w-4 h-4" />
            Ambient Layers
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {ambientLayers.map(layer => (
              <Button
                key={layer.id}
                variant={activeAmbients.includes(layer.id) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleAmbientLayer(layer.id)}
                disabled={!isAudioEnabled}
                className={`justify-start text-left ${
                  activeAmbients.includes(layer.id) 
                    ? 'bg-purple-600 hover:bg-purple-700' 
                    : 'border-gray-600 text-gray-300'
                }`}
              >
                <div>
                  <div className="font-medium">{layer.name}</div>
                  <div className="text-xs text-gray-400">{layer.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Audio Status */}
        <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-700">
          {isAudioEnabled 
            ? `${activeAmbients.length} ambient layers active`
            : 'Click to enable synesthetic audio experience'
          }
        </div>
      </div>
    </Card>
  );
};
