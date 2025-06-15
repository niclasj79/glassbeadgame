
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AudioControls } from './AudioControls';
import { AudioQualitySettings } from './AudioQualitySettings';
import { EnhancedSynesthesiaVisualizer } from './EnhancedSynesthesiaVisualizer';
import { use3DAudioEngine } from './hooks/use3DAudioEngine';
import { Volume2, Settings, Eye, Headphones, ChevronUp, ChevronDown } from 'lucide-react';

interface EnhancedAudioControlsProps {
  activeFrequencies?: number[];
  resonanceLevel?: number;
  disciplines?: string[];
  spatialPositions?: Array<{ x: number; y: number; z: number; discipline: string; intensity: number }>;
  className?: string;
}

export const EnhancedAudioControls: React.FC<EnhancedAudioControlsProps> = ({
  activeFrequencies = [],
  resonanceLevel = 0,
  disciplines = [],
  spatialPositions = [],
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('controls');

  const {
    qualitySettings,
    setQualitySettings,
    getSpatialNodeCount,
    playConceptWith3D,
    updateListenerPosition
  } = use3DAudioEngine();

  const spatialNodeCount = getSpatialNodeCount();

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      {/* Collapsed Header */}
      {!isExpanded && (
        <Card className="bg-gray-800/90 backdrop-blur border-gray-700">
          <div className="flex items-center gap-2 p-3">
            <Badge variant="outline" className="text-xs">
              3D Audio {spatialNodeCount > 0 ? 'Active' : 'Ready'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(true)}
              className="h-6 w-6 p-0"
            >
              <ChevronUp className="w-3 h-3" />
            </Button>
          </div>
        </Card>
      )}

      {/* Expanded Panel */}
      {isExpanded && (
        <Card className="bg-gray-800/95 backdrop-blur border-gray-700 w-96 max-h-[70vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Headphones className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-medium text-white">Enhanced Audio System</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {spatialNodeCount} Active
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="h-6 w-6 p-0"
              >
                <ChevronDown className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gray-700">
              <TabsTrigger value="controls" className="text-xs">
                <Volume2 className="w-3 h-3 mr-1" />
                Controls
              </TabsTrigger>
              <TabsTrigger value="quality" className="text-xs">
                <Settings className="w-3 h-3 mr-1" />
                Quality
              </TabsTrigger>
              <TabsTrigger value="visualizer" className="text-xs">
                <Eye className="w-3 h-3 mr-1" />
                Visual
              </TabsTrigger>
            </TabsList>

            <div className="max-h-96 overflow-y-auto">
              <TabsContent value="controls" className="p-3 m-0">
                <AudioControls className="" />
              </TabsContent>

              <TabsContent value="quality" className="p-3 m-0">
                <AudioQualitySettings
                  qualitySettings={qualitySettings}
                  onSettingsChange={setQualitySettings}
                  spatialNodeCount={spatialNodeCount}
                />
              </TabsContent>

              <TabsContent value="visualizer" className="p-0 m-0">
                <div className="h-64">
                  <EnhancedSynesthesiaVisualizer
                    activeFrequencies={activeFrequencies}
                    resonanceLevel={resonanceLevel}
                    disciplines={disciplines}
                    spatialPositions={spatialPositions}
                    className="h-full"
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {/* Status Bar */}
          <div className="px-3 py-2 border-t border-gray-700 bg-gray-900/50">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Quality: {qualitySettings.spatialAccuracy}</span>
              <span>Concepts: {spatialPositions.length}</span>
              <span>Freq: {activeFrequencies.length}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
