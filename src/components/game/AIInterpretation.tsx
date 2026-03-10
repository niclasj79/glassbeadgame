import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Download, RotateCcw, Sparkles, Zap, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SynthesisDiscovery, GameScore } from './arena/types';

interface AIInterpretationProps {
  sessionData: SessionData;
  onNewSession: () => void;
  onBackToMenu: () => void;
}

interface SessionData {
  id?: string;
  disciplines: string[];
  concepts: any[];
  interactions: any[];
  duration: number;
  sessionType: string;
  discoveries?: SynthesisDiscovery[];
  score?: GameScore;
}

export const AIInterpretation: React.FC<AIInterpretationProps> = ({
  sessionData,
  onNewSession,
  onBackToMenu
}) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    generateAnalysis();
  }, []);

  const generateAnalysis = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-session-analysis', {
        body: {
          discoveries: sessionData.discoveries || [],
          disciplines: sessionData.disciplines,
          conceptCount: sessionData.concepts.length,
          duration: sessionData.duration,
          score: sessionData.score?.totalResonance || 0,
        }
      });

      if (fnError) throw fnError;
      setAnalysis(data?.analysis || 'The session concluded in contemplative silence.');
    } catch (err) {
      console.error('Analysis generation failed:', err);
      setError('Could not generate AI analysis. Showing discovery journal instead.');
      setAnalysis('');
    } finally {
      setIsGenerating(false);
    }
  };

  const score = sessionData.score;
  const discoveries = sessionData.discoveries || [];

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const exportSessionData = () => {
    const exportData = {
      sessionId: sessionData.id || `session-${Date.now()}`,
      disciplines: sessionData.disciplines,
      discoveries,
      score,
      analysis,
      duration: sessionData.duration,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `glass-bead-session-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isGenerating) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(240, 60%, 3%)' }}>
        <div className="game-surface-elevated rounded-xl p-8 max-w-2xl w-full text-center mx-4">
          <div className="animate-spin w-12 h-12 border-3 border-game-glow border-t-transparent rounded-full mx-auto mb-6" />
          <h2 className="text-xl font-semibold game-text-bright mb-3 flex items-center justify-center gap-2">
            <Brain className="w-5 h-5" />
            Contemplating Your Journey
          </h2>
          <p className="game-text-dim text-sm">
            Analyzing {discoveries.length} discoveries across {sessionData.disciplines.length} disciplines...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: 'hsl(240, 60%, 3%)' }}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-light game-text-bright mb-3 tracking-wide">
            Session Complete
          </h1>
          <div className="flex items-center justify-center gap-4 text-sm game-text-dim">
            <span>{formatDuration(sessionData.duration)}</span>
            <span>•</span>
            <span>{discoveries.length} discoveries</span>
            <span>•</span>
            <span>{sessionData.concepts.length} concepts</span>
          </div>
        </div>

        {/* Score Card */}
        {score && (
          <div className="game-surface-elevated rounded-xl p-6 text-center game-glow">
            <Trophy className="w-8 h-8 text-game-resonance mx-auto mb-3" />
            <div className="text-4xl font-bold text-game-resonance mb-1">{score.totalResonance}</div>
            <div className="text-sm game-text-dim mb-2">Resonance Points</div>
            <div className="text-lg font-medium text-game-synthesis">{score.rank}</div>
          </div>
        )}

        {/* Discovery Journal */}
        {discoveries.length > 0 && (
          <div className="game-surface-elevated rounded-xl p-6">
            <h3 className="text-lg font-semibold game-text-bright mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-game-resonance" />
              Discovery Journal
            </h3>
            <div className="space-y-4">
              {discoveries.map((d, i) => (
                <div key={d.id} className="game-surface rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-game-glow">{d.concept1Text}</span>
                    <Zap className="w-3 h-3 text-game-resonance flex-shrink-0" />
                    <span className="text-sm font-medium text-game-glow-secondary">{d.concept2Text}</span>
                    <span className="ml-auto text-xs font-bold text-game-resonance">+{d.resonanceScore}</span>
                  </div>
                  <p className="text-sm game-text-dim leading-relaxed">{d.insight}</p>
                  <div className="text-xs game-text-dim mt-2 capitalize">{d.discipline1} × {d.discipline2}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Analysis */}
        {analysis && (
          <div className="game-surface-elevated rounded-xl p-6">
            <h3 className="text-lg font-semibold game-text-bright mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Contemplative Analysis
            </h3>
            <p className="text-sm game-text-bright leading-relaxed whitespace-pre-line">{analysis}</p>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap justify-center gap-3 pt-4">
          <Button onClick={onNewSession} className="bg-game-glow/20 hover:bg-game-glow/30 text-game-glow border border-game-glow/30">
            <RotateCcw className="w-4 h-4 mr-2" />
            New Session
          </Button>
          <Button onClick={exportSessionData} variant="outline" className="border-game-glow/20 game-text-dim hover:game-text-bright">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={onBackToMenu} variant="outline" className="border-game-glow/20 game-text-dim hover:game-text-bright">
            Main Menu
          </Button>
        </div>
      </div>
    </div>
  );
};
