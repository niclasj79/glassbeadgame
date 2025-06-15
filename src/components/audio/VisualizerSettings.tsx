
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface VisualizationSettings {
  particleDensity: number;
  trailLength: number;
  colorMode: 'frequency' | 'discipline' | 'mixed';
  responseTime: number;
  depthLayers: boolean;
}

interface VisualizerSettingsProps {
  settings: VisualizationSettings;
  onSettingsChange: (settings: VisualizationSettings) => void;
}

export const VisualizerSettings: React.FC<VisualizerSettingsProps> = ({
  settings,
  onSettingsChange
}) => {
  const updateSetting = <K extends keyof VisualizationSettings>(
    key: K,
    value: VisualizationSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Card className="bg-gray-900/95 backdrop-blur border-gray-700 p-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        {/* Particle Density */}
        <div>
          <label className="text-gray-300 mb-1 block">
            Density: {settings.particleDensity.toFixed(1)}
          </label>
          <Slider
            value={[settings.particleDensity]}
            onValueChange={(value) => updateSetting('particleDensity', value[0])}
            min={0.1}
            max={2.0}
            step={0.1}
            className="w-full"
          />
        </div>

        {/* Trail Length */}
        <div>
          <label className="text-gray-300 mb-1 block">
            Trails: {settings.trailLength}
          </label>
          <Slider
            value={[settings.trailLength]}
            onValueChange={(value) => updateSetting('trailLength', value[0])}
            min={0}
            max={20}
            step={1}
            className="w-full"
          />
        </div>

        {/* Color Mode */}
        <div>
          <label className="text-gray-300 mb-1 block">Color Mode</label>
          <div className="grid grid-cols-3 gap-1">
            {(['frequency', 'discipline', 'mixed'] as const).map((mode) => (
              <Button
                key={mode}
                variant={settings.colorMode === mode ? "default" : "outline"}
                size="sm"
                onClick={() => updateSetting('colorMode', mode)}
                className="text-xs capitalize h-6"
              >
                {mode}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};
