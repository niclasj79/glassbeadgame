
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, Volume2, Waves, Filter, Zap } from 'lucide-react';

interface AudioQualitySettingsProps {
  qualitySettings: {
    spatialAccuracy: 'basic' | 'enhanced' | 'premium';
    reverbEnabled: boolean;
    doppler: boolean;
    atmosphericFiltering: boolean;
    maxConcurrentSounds: number;
  };
  onSettingsChange: (settings: any) => void;
  spatialNodeCount: number;
  className?: string;
}

export const AudioQualitySettings: React.FC<AudioQualitySettingsProps> = ({
  qualitySettings,
  onSettingsChange,
  spatialNodeCount,
  className = ''
}) => {
  const handleSpatialAccuracyChange = (accuracy: 'basic' | 'enhanced' | 'premium') => {
    onSettingsChange({
      ...qualitySettings,
      spatialAccuracy: accuracy
    });
  };

  const handleToggle = (setting: string, value: boolean) => {
    onSettingsChange({
      ...qualitySettings,
      [setting]: value
    });
  };

  const handleMaxSoundsChange = (values: number[]) => {
    onSettingsChange({
      ...qualitySettings,
      maxConcurrentSounds: values[0]
    });
  };

  const getQualityLevel = () => {
    const { spatialAccuracy, reverbEnabled, atmosphericFiltering, doppler } = qualitySettings;
    const enabledFeatures = [reverbEnabled, atmosphericFiltering, doppler].filter(Boolean).length;
    
    if (spatialAccuracy === 'premium' && enabledFeatures === 3) return 'Ultra';
    if (spatialAccuracy === 'enhanced' && enabledFeatures >= 2) return 'High';
    if (spatialAccuracy === 'basic' || enabledFeatures <= 1) return 'Performance';
    return 'Balanced';
  };

  const getPerformanceImpact = () => {
    const level = getQualityLevel();
    switch (level) {
      case 'Ultra': return { text: 'High Impact', color: 'bg-red-600' };
      case 'High': return { text: 'Medium Impact', color: 'bg-yellow-600' };
      case 'Balanced': return { text: 'Low Impact', color: 'bg-green-600' };
      case 'Performance': return { text: 'Minimal Impact', color: 'bg-blue-600' };
      default: return { text: 'Unknown', color: 'bg-gray-600' };
    }
  };

  const performanceInfo = getPerformanceImpact();

  return (
    <Card className={`bg-gray-800/95 backdrop-blur border-gray-700 ${className}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-medium text-white">3D Audio Quality</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {getQualityLevel()}
            </Badge>
            <Badge className={`text-xs ${performanceInfo.color}`}>
              {performanceInfo.text}
            </Badge>
          </div>
        </div>

        <div className="space-y-4">
          {/* Spatial Accuracy */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Waves className="w-3 h-3 text-blue-400" />
              <label className="text-xs text-gray-300">Spatial Accuracy</label>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(['basic', 'enhanced', 'premium'] as const).map((level) => (
                <Button
                  key={level}
                  variant={qualitySettings.spatialAccuracy === level ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSpatialAccuracyChange(level)}
                  className={`text-xs capitalize ${
                    qualitySettings.spatialAccuracy === level
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'border-gray-600 text-gray-300'
                  }`}
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>

          <Separator className="bg-gray-700" />

          {/* Audio Effects */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Filter className="w-3 h-3 text-purple-400" />
              <span className="text-xs text-gray-300">Audio Effects</span>
            </div>

            {/* Reverb */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-3 h-3 text-green-400" />
                <span className="text-xs text-gray-200">Spatial Reverb</span>
              </div>
              <Switch
                checked={qualitySettings.reverbEnabled}
                onCheckedChange={(checked) => handleToggle('reverbEnabled', checked)}
                className="scale-75"
              />
            </div>

            {/* Atmospheric Filtering */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Waves className="w-3 h-3 text-cyan-400" />
                <span className="text-xs text-gray-200">Distance Filtering</span>
              </div>
              <Switch
                checked={qualitySettings.atmosphericFiltering}
                onCheckedChange={(checked) => handleToggle('atmosphericFiltering', checked)}
                className="scale-75"
              />
            </div>

            {/* Doppler Effect */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span className="text-xs text-gray-200">Doppler Effect</span>
              </div>
              <Switch
                checked={qualitySettings.doppler}
                onCheckedChange={(checked) => handleToggle('doppler', checked)}
                className="scale-75"
              />
            </div>
          </div>

          <Separator className="bg-gray-700" />

          {/* Performance Settings */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-300">Max Concurrent Sounds</span>
              <span className="text-xs text-blue-400">{qualitySettings.maxConcurrentSounds}</span>
            </div>
            <Slider
              value={[qualitySettings.maxConcurrentSounds]}
              onValueChange={handleMaxSoundsChange}
              min={2}
              max={16}
              step={1}
              className="w-full"
            />
          </div>

          {/* Live Stats */}
          <div className="pt-2 border-t border-gray-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Active Sounds:</span>
              <span className={`font-mono ${spatialNodeCount > qualitySettings.maxConcurrentSounds * 0.8 ? 'text-yellow-400' : 'text-green-400'}`}>
                {spatialNodeCount}/{qualitySettings.maxConcurrentSounds}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
