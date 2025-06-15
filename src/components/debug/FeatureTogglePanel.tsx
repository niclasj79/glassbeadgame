
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { featureFlags, toggleFeature, isFeatureEnabled } from '@/config/featureFlags';
import { Settings } from 'lucide-react';

export const FeatureTogglePanel: React.FC = () => {
  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <Card className="fixed top-4 right-4 p-4 bg-gray-900/90 border-gray-700 backdrop-blur-sm z-50">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-white">Feature Flags (Dev)</h3>
      </div>
      
      <div className="space-y-2">
        {Object.entries(featureFlags).map(([feature, enabled]) => (
          <div key={feature} className="flex items-center justify-between gap-3">
            <span className="text-xs text-gray-300 capitalize">
              {feature.replace(/([A-Z])/g, ' $1').trim()}
            </span>
            <Switch
              checked={enabled}
              onCheckedChange={() => toggleFeature(feature as keyof typeof featureFlags)}
              className="scale-75"
            />
          </div>
        ))}
      </div>
      
      <div className="mt-3 pt-2 border-t border-gray-700">
        <p className="text-xs text-gray-500">
          Changes take effect immediately
        </p>
      </div>
    </Card>
  );
};
