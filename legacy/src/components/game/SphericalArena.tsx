import React, { useState, useEffect, useCallback } from 'react';
import { CanvasRenderer } from './arena/CanvasRenderer';
import { SessionHeader } from './arena/SessionHeader';
import { BottomUI } from './arena/BottomUI';
import { SynthesisCard } from './arena/SynthesisCard';
import { DiscoveryLog } from './arena/DiscoveryLog';
import { ConceptInfoOverlay } from './arena/ConceptInfoOverlay';
import { SphericalArenaProps } from './arena/types';
import { useOfflineSessionManagement } from './arena/hooks/useOfflineSessionManagement';
import { useConceptInteractions } from './arena/hooks/useConceptInteractions';
import { useProximitySynthesis } from './arena/hooks/useProximitySynthesis';
import { useAudio } from '../audio/AudioEngine';
import { AudioControls } from '../audio/AudioControls';
import { LoadingOverlay } from '../ui/loading-overlay';
import { BackgroundRenderer } from './arena/renderers/BackgroundRenderer';
import { EffectsRenderer } from './arena/renderers/EffectsRenderer';
import { Slider } from '../ui/slider';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface EnhancedArenaProps extends SphericalArenaProps {
  onDiscoveriesUpdate?: (discoveries: any[], score: any) => void;
}

export const SphericalArena: React.FC<EnhancedArenaProps> = ({
  disciplines,
  selectedDisciplines,
  concepts: initialConcepts,
  onConceptInteraction,
  onSessionEnd,
  onDiscoveriesUpdate
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [infoConcept, setInfoConcept] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [zoom, setZoom] = useState(1);

  const {
    preloadAudio, playDisciplineSound, isAudioEnabled, initializeAudio,
    playHoverSound, playGrabSound, playDropSound, playRotationSound,
    playSynthesisChord, updateSoundtrackIntensity, createBackgroundSoundscape
  } = useAudio();

  useEffect(() => {
    const init = async () => {
      try {
        if (preloadAudio && initializeAudio) {
          await preloadAudio();
          await initializeAudio();
        }
      } catch (e) {
        console.error('Audio init failed:', e);
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, [preloadAudio, initializeAudio]);

  useEffect(() => {
    const timer = setTimeout(() => setShowTutorial(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  const {
    sessionId, concepts, setConcepts, remainingTime, formatTime, maxDuration,
    updateConceptMovement, currentInsight, isGenerating, error, cleanup,
    trackRenderPerformance, performanceMetrics
  } = useOfflineSessionManagement(initialConcepts, onSessionEnd, {
    enableBatchedUpdates: true, enableAggressiveCaching: true, maxCacheSize: 50, preloadInsights: false
  });

  const {
    discoveries, activePairs, latestDiscovery, isGeneratingInsight, score, dismissDiscovery
  } = useProximitySynthesis(concepts, disciplines);

  useEffect(() => {
    updateSoundtrackIntensity?.(score.totalResonance);
  }, [score.totalResonance, updateSoundtrackIntensity]);

  useEffect(() => {
    if (concepts.length > 0 && !isInitializing && isAudioEnabled) {
      createBackgroundSoundscape?.(concepts, 0, 0);
    }
  }, [concepts.length, isInitializing, isAudioEnabled, createBackgroundSoundscape]);

  const prevDiscoveryCount = React.useRef(0);
  useEffect(() => {
    if (discoveries.length > prevDiscoveryCount.current && discoveries.length > 0) {
      const latest = discoveries[discoveries.length - 1];
      BackgroundRenderer.triggerDiscoveryGlow();
      EffectsRenderer.triggerDiscoveryBurst(window.innerWidth / 2, window.innerHeight / 2);
      playSynthesisChord?.(latest.discipline1, latest.discipline2, latest.resonanceScore);
    }
    prevDiscoveryCount.current = discoveries.length;
  }, [discoveries.length, playSynthesisChord]);

  useEffect(() => {
    if (onDiscoveriesUpdate) onDiscoveriesUpdate(discoveries, score);
  }, [discoveries, score, onDiscoveriesUpdate]);

  const totalPossible = React.useMemo(() => {
    let count = 0;
    for (let i = 0; i < concepts.length; i++) {
      for (let j = i + 1; j < concepts.length; j++) {
        if (concepts[i].discipline !== concepts[j].discipline) count++;
      }
    }
    return count;
  }, [concepts]);

  const handleConceptPositionUpdate = (conceptId: string, newX: number, newY: number, newZ: number) => {
    if (sessionId) updateConceptMovement(conceptId, newX, newY, newZ);
    setConcepts(prev => prev.map(c => c.id === conceptId ? { ...c, x: newX, y: newY, z: newZ } : c));
    trackRenderPerformance();
  };

  const { handleConceptClick, handleConceptMove } = useConceptInteractions(
    concepts, disciplines, onConceptInteraction, handleConceptPositionUpdate
  );

  const enhancedConceptClick = async (conceptId: string) => {
    const concept = concepts.find(c => c.id === conceptId);
    if (concept) {
      const discipline = disciplines.find(d => d.id === concept.discipline);
      if (discipline && playDisciplineSound) {
        playDisciplineSound(discipline.id, concept.energy, { x: concept.x, y: concept.y, z: concept.z });
      }
    }
    setSelectedConcept(conceptId);
    handleConceptClick(conceptId);
  };

  const enhancedConceptMove = async (conceptId: string, newX: number, newY: number, newZ: number) => {
    handleConceptPositionUpdate(conceptId, newX, newY, newZ);
    handleConceptMove(conceptId, newX, newY, newZ);
  };

  const handleSessionEnd = () => {
    cleanup();
    onSessionEnd();
  };

  // Audio callbacks
  const handleHover = useCallback((conceptId: string | null) => {
    if (conceptId) playHoverSound?.();
  }, [playHoverSound]);

  // Hover dwell: show info after lingering 1s
  const handleHoverDwell = useCallback((conceptId: string) => {
    setInfoConcept(conceptId);
  }, []);

  const handleGrab = useCallback(() => {
    playGrabSound?.();
    setInfoConcept(null); // dismiss info on grab
  }, [playGrabSound]);

  const handleDrop = useCallback(() => {
    playDropSound?.();
  }, [playDropSound]);

  const handleRotate = useCallback((direction: number) => {
    playRotationSound?.(direction);
  }, [playRotationSound]);

  const scoreIntensity = Math.min(1, score.totalResonance / 200);

  useEffect(() => { return () => { cleanup(); }; }, [cleanup]);

  return (
    <div
      className="w-full relative overflow-hidden"
      style={{ height: '100vh', minHeight: '100vh', maxHeight: '100vh', background: 'hsl(240, 60%, 3%)' }}
      role="application"
      aria-label="Glass Bead Game - Spherical Arena"
    >
      <SessionHeader
        remainingTime={remainingTime}
        maxDuration={maxDuration}
        formatTime={formatTime}
        onEndSession={handleSessionEnd}
        score={score}
        discoveriesCount={score.discoveriesCount}
        totalPossible={totalPossible}
      />

      <DiscoveryLog discoveries={discoveries} disciplines={disciplines} />

      <div className="w-full relative" style={{ height: '100vh', paddingTop: '60px', paddingBottom: '80px' }}>
        <LoadingOverlay isLoading={isInitializing} message="Entering the Glass Bead Game...">
          <div className="w-full h-full">
            <CanvasRenderer
              concepts={concepts}
              disciplines={disciplines}
              isPaused={isPaused}
              selectedConcept={selectedConcept}
              onConceptClick={enhancedConceptClick}
              onConceptMove={enhancedConceptMove}
              proximityPairs={activePairs}
              scoreIntensity={scoreIntensity}
              onHover={handleHover}
              onHoverDwell={handleHoverDwell}
              onGrab={handleGrab}
              onDrop={handleDrop}
              onRotate={handleRotate}
              discoveriesCount={score.discoveriesCount}
              zoom={zoom}
            />
          </div>
        </LoadingOverlay>
      </div>

      {showTutorial && !isInitializing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="rounded-xl p-6 max-w-sm mx-4 animate-fade-in pointer-events-auto"
            style={{
              background: 'hsl(var(--game-surface-elevated))',
              border: '1px solid hsl(var(--game-border-subtle))'
            }}
          >
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'hsl(var(--game-text-bright))' }}>How to Play</h3>
            <ul className="text-sm space-y-2" style={{ color: 'hsl(var(--game-text-dim))' }}>
              <li>🔮 <strong>Drag</strong> concepts close to ones from other disciplines</li>
              <li>✨ <strong>Resonance</strong> is discovered when they're near enough</li>
              <li>🌀 <strong>Rotate</strong> the sphere by dragging empty space</li>
              <li>🔄 <strong>Scroll wheel</strong> tilts the sphere vertically</li>
              <li>📜 <strong>Journal</strong> (left) keeps all discoveries</li>
              <li>🔍 <strong>Hover</strong> over a bead to learn about it</li>
              <li>🏆 Build your resonance score with unique pairings</li>
            </ul>
            <button
              onClick={() => setShowTutorial(false)}
              className="mt-4 text-sm transition-colors hover:opacity-80"
              style={{ color: 'hsl(var(--game-glow-primary))' }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Concept info overlay - triggered by hover dwell */}
      <ConceptInfoOverlay
        concept={infoConcept ? concepts.find(c => c.id === infoConcept) || null : null}
        discipline={infoConcept ? disciplines.find(d => d.id === concepts.find(c => c.id === infoConcept)?.discipline) || null : null}
        onDismiss={() => setInfoConcept(null)}
      />

      {latestDiscovery && (
        <SynthesisCard discovery={latestDiscovery} onDismiss={dismissDiscovery} />
      )}

      {/* Zoom slider at bottom center */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-sm"
        style={{
          background: 'hsla(240, 20%, 10%, 0.6)',
          border: '1px solid hsla(260, 30%, 30%, 0.3)',
        }}
      >
        <ZoomOut className="w-3.5 h-3.5" style={{ color: 'hsl(var(--game-text-dim))' }} />
        <Slider
          value={[zoom * 100]}
          onValueChange={(v) => setZoom(v[0] / 100)}
          min={40}
          max={250}
          step={5}
          className="w-32"
        />
        <ZoomIn className="w-3.5 h-3.5" style={{ color: 'hsl(var(--game-text-dim))' }} />
      </div>

      <div className="fixed bottom-4 right-4 z-30">
        <AudioControls />
      </div>
    </div>
  );
};
