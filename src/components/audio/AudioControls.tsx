
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useAudio } from './AudioEngine';
import { Volume2, VolumeX, Music, Headphones, ChevronUp, ChevronDown } from 'lucide-react';

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
  const [isCollapsed, setIsCollapsed] = useState(true);

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
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <Card className="bg-gray-800/90 backdrop-blur border-gray-700">
        {/* Collapsed Header */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <Button
              variant={isAudioEnabled ? "default" : "outline"}
              size="sm"
              onClick={toggleAudio}
              className={isAudioEnabled ? "bg-green-600 hover:bg-green-700" : "border-gray-600"}
            >
              {isAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Badge variant={isAudioEnabled ? "default" : "secondary"} className="text-xs">
              {isAudioEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-400 hover:text-white"
          >
            {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {/* Expanded Controls */}
        {!isCollapsed && (
          <div className="px-3 pb-3 space-y-3 border-t border-gray-700 pt-3">
            {/* Volume Control */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                Volume: {volume[0]}%
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

            {/* Ambient Layers */}
            <div>
              <h4 className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-1">
                <Music className="w-3 h-3" />
                Ambient Layers
              </h4>
              <div className="space-y-1">
                {ambientLayers.map(layer => (
                  <Button
                    key={layer.id}
                    variant={activeAmbients.includes(layer.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleAmbientLayer(layer.id)}
                    disabled={!isAudioEnabled}
                    className={`w-full text-xs ${
                      activeAmbients.includes(layer.id) 
                        ? 'bg-purple-600 hover:bg-purple-700' 
                        : 'border-gray-600 text-gray-300'
                    }`}
                  >
                    {layer.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
