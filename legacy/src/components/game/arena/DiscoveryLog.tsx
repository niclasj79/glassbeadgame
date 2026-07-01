import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, X, Sparkles, Zap, ChevronRight } from 'lucide-react';
import { SynthesisDiscovery } from './types';

interface DiscoveryLogProps {
  discoveries: SynthesisDiscovery[];
  disciplines: any[];
}

export const DiscoveryLog: React.FC<DiscoveryLogProps> = ({ discoveries, disciplines }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const unreadCount = discoveries.length - lastSeenCount;

  useEffect(() => {
    if (isOpen) {
      setLastSeenCount(discoveries.length);
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    }
  }, [isOpen, discoveries.length]);

  const getDisciplineColor = (id: string) => {
    const d = disciplines.find((disc: any) => disc.id === id);
    return d?.color || '#888';
  };

  const getDisciplineName = (id: string) => {
    const d = disciplines.find((disc: any) => disc.id === id);
    return d?.name || id;
  };

  const reversed = [...discoveries].reverse();

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-1/2 -translate-y-1/2 z-40 flex items-center justify-center w-10 h-10 rounded-full game-surface-elevated backdrop-blur-sm hover:bg-[hsl(var(--game-surface-elevated))] transition-all"
        aria-label="Toggle discovery journal"
      >
        <BookOpen className="w-5 h-5" style={{ color: 'hsl(var(--game-text-bright))' }} />
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[hsl(var(--game-resonance))] text-[10px] font-bold flex items-center justify-center text-black">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed left-0 top-0 bottom-0 z-50 w-80 max-w-[85vw] flex flex-col backdrop-blur-xl"
          style={{ background: 'hsla(240, 30%, 8%, 0.92)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'hsl(var(--game-border-subtle))' }}>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" style={{ color: 'hsl(var(--game-resonance))' }} />
              <span className="text-sm font-semibold" style={{ color: 'hsl(var(--game-text-bright))' }}>
                Discovery Journal
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'hsl(var(--game-surface))', color: 'hsl(var(--game-text-dim))' }}>
                {discoveries.length}
              </span>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:opacity-80 transition-opacity">
              <X className="w-4 h-4" style={{ color: 'hsl(var(--game-text-dim))' }} />
            </button>
          </div>

          {/* Entries */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {reversed.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" style={{ color: 'hsl(var(--game-text-dim))' }} />
                <p className="text-sm" style={{ color: 'hsl(var(--game-text-dim))' }}>
                  No discoveries yet. Drag concepts from different disciplines close together!
                </p>
              </div>
            ) : (
              reversed.map((d, i) => (
                <div
                  key={d.id}
                  className="rounded-lg p-3 transition-colors"
                  style={{
                    background: 'hsl(var(--game-surface))',
                    border: '1px solid hsl(var(--game-border-subtle))'
                  }}
                >
                  {/* Concept pair */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                      style={{ background: getDisciplineColor(d.discipline1) + '22', color: getDisciplineColor(d.discipline1) }}
                    >
                      {d.concept1Text}
                    </span>
                    <Zap className="w-3 h-3 flex-shrink-0" style={{ color: 'hsl(var(--game-resonance))' }} />
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                      style={{ background: getDisciplineColor(d.discipline2) + '22', color: getDisciplineColor(d.discipline2) }}
                    >
                      {d.concept2Text}
                    </span>
                  </div>

                  {/* Insight */}
                  <p className="text-xs leading-relaxed mb-2" style={{ color: 'hsl(var(--game-text-bright))' }}>
                    {d.insight}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: 'hsl(var(--game-text-dim))' }}>
                      {getDisciplineName(d.discipline1)} × {getDisciplineName(d.discipline2)}
                    </span>
                    <span className="text-xs font-bold" style={{ color: 'hsl(var(--game-resonance))' }}>
                      +{d.resonanceScore}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};
