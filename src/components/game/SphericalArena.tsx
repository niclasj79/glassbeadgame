import React, { useState, useEffect } from 'react';
import { CanvasRenderer } from './arena/CanvasRenderer';
import { SessionHeader } from './arena/SessionHeader';
import { BottomUI } from './arena/BottomUI';
import { SynthesisCard } from './arena/SynthesisCard';
import { ScoreDisplay } from './arena/ScoreDisplay';
import { SphericalArenaProps } from './arena/types';
import { useOfflineSessionManagement } from './arena/hooks/useOfflineSessionManagement';
import { useConceptInteractions } from './arena/hooks/useConceptInteractions';
import { useProximitySynthesis } from './arena/hooks/useProximitySynthesis';
import { useAudio } from '../audio/AudioEngine';
import { AudioControls } from '../audio/AudioControls';
import { LoadingOverlay } from '../ui/loading-overlay';

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
  const [showTutorial, setShowTutorial] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);

  const { preloadAudio, playDisciplineSound, isAudioEnabled, initializeAudio } = useAudio();

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

  // Dismiss tutorial after 5s
  useEffect(() => {
    const timer = setTimeout(() => setShowTutorial(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const {
    sessionId, concepts, setConcepts, remainingTime, formatTime,
    updateConceptMovement, currentInsight, isGenerating, error, cleanup,
    trackRenderPerformance, performanceMetrics
  } = useOfflineSessionManagement(initialConcepts, onSessionEnd, {
    enableBatchedUpdates: true, enableAggressiveCaching: true, maxCacheSize: 50, preloadInsights: false
  });

  // Proximity synthesis system
  const {
    discoveries, activePairs, latestDiscovery, isGeneratingInsight, score, dismissDiscovery
  } = useProximitySynthesis(concepts, disciplines);

  // Notify parent of discoveries
  useEffect(() => {
    if (onDiscoveriesUpdate) {
      onDiscoveriesUpdate(discoveries, score);
    }
  }, [discoveries, score, onDiscoveriesUpdate]);

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

  useEffect(() => { return () => { cleanup(); }; }, [cleanup]);

  return (
    <div
      className="w-full relative overflow-hidden"
      style={{ height: '100vh', minHeight: '100vh', maxHeight: '100vh', background: 'hsl(240, 60%, 3%)' }}
      role="application"
      aria-label="Glass Bead Game - Spherical Arena"
    >
      {/* Header with score */}
      <SessionHeader
        remainingTime={remainingTime}
        formatTime={formatTime}
        onEndSession={handleSessionEnd}
        score={score}
      />

      {/* Arena canvas */}
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
            />
          </div>
        </LoadingOverlay>
      </div>

      {/* Tutorial overlay */}
      {showTutorial && !isInitializing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="game-surface-elevated rounded-xl p-6 max-w-sm mx-4 animate-fade-in pointer-events-auto">
            <h3 className="text-lg font-semibold game-text-bright mb-3">How to Play</h3>
            <ul className="text-sm game-text-dim space-y-2">
              <li>🔮 Drag concepts from different disciplines close together</li>
              <li>✨ When they're near enough, a resonance is discovered</li>
              <li>📜 Each discovery reveals a hidden connection</li>
              <li>🏆 Build your resonance score with unique pairings</li>
            </ul>
            <button
              onClick={() => setShowTutorial(false)}
              className="mt-4 text-sm text-game-glow hover:text-white transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Synthesis discovery card */}
      {latestDiscovery && (
        <SynthesisCard discovery={latestDiscovery} onDismiss={dismissDiscovery} />
      )}

      {/* Audio Controls */}
      <div className="fixed bottom-4 right-4 z-30">
        <AudioControls />
      </div>
    </div>
  );
};
