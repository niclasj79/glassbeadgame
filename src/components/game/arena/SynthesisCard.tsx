import React from 'react';
import { X, Sparkles, Zap } from 'lucide-react';
import { SynthesisDiscovery } from './types';

interface SynthesisCardProps {
  discovery: SynthesisDiscovery;
  onDismiss: () => void;
}

export const SynthesisCard: React.FC<SynthesisCardProps> = ({ discovery, onDismiss }) => {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[90vw] max-w-lg animate-slide-up">
      <div className="game-surface-elevated rounded-xl p-5 backdrop-blur-xl shadow-2xl game-glow">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-game-resonance" />
            <span className="text-sm font-semibold game-text-bright tracking-wide uppercase">
              Resonance Discovered
            </span>
          </div>
          <button onClick={onDismiss} className="game-text-dim hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Concept pair */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm font-medium text-game-glow">{discovery.concept1Text}</span>
          <Zap className="w-4 h-4 text-game-resonance flex-shrink-0" />
          <span className="text-sm font-medium text-game-glow-secondary">{discovery.concept2Text}</span>
        </div>

        {/* Insight */}
        <p className="text-sm game-text-bright leading-relaxed mb-3">
          {discovery.insight}
        </p>

        {/* Score */}
        <div className="flex items-center justify-between">
          <span className="text-xs game-text-dim capitalize">
            {discovery.discipline1} × {discovery.discipline2}
          </span>
          <span className="text-sm font-bold text-game-resonance">
            +{discovery.resonanceScore} resonance
          </span>
        </div>
      </div>
    </div>
  );
};
