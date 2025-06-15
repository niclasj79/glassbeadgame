import React, { useState, useEffect } from 'react';
import { DisciplineSelectionPhase } from './DisciplineSelectionPhase';
import { ConceptCountPhase } from './ConceptCountPhase';

interface SessionStartFlowProps {
  disciplines: any[];
  onSessionStart: (selectedDisciplines: string[], conceptCount: number) => Promise<void>;
}

export const SessionStartFlow: React.FC<SessionStartFlowProps> = ({
  disciplines,
  onSessionStart
}) => {
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [suggestedCombinations, setSuggestedCombinations] = useState<string[][]>([]);
  const [phase, setPhase] = useState<'disciplines' | 'concepts'>('disciplines');
  const [conceptCount, setConceptCount] = useState(12);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Generate 3 random discipline combinations
    const combinations = [];
    for (let i = 0; i < 3; i++) {
      const shuffled = [...disciplines].sort(() => 0.5 - Math.random());
      combinations.push(shuffled.slice(0, 2 + Math.floor(Math.random() * 2)).map(d => d.id));
    }
    setSuggestedCombinations(combinations);
  }, [disciplines]);

  const handleQuickSelect = (combination: string[]) => {
    setSelectedDisciplines(combination);
    setPhase('concepts');
  };

  const handleSurpriseMe = async (selectedDisciplines: string[], conceptCount: number) => {
    setIsLoading(true);
    try {
      // Limit concept count to number of selected disciplines (one per discipline)
      const actualConceptCount = Math.min(conceptCount, selectedDisciplines.length);
      await onSessionStart(selectedDisciplines, actualConceptCount);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomStart = () => {
    if (selectedDisciplines.length > 0) {
      if (phase === 'disciplines') {
        setPhase('concepts');
      } else {
        handleStartWithConcepts();
      }
    }
  };

  const handleStartWithConcepts = async () => {
    setIsLoading(true);
    try {
      // Limit concept count to number of selected disciplines (one per discipline)
      const actualConceptCount = Math.min(conceptCount, selectedDisciplines.length);
      await onSessionStart(selectedDisciplines, actualConceptCount);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDiscipline = (disciplineId: string) => {
    setSelectedDisciplines(prev => 
      prev.includes(disciplineId)
        ? prev.filter(id => id !== disciplineId)
        : [...prev, disciplineId]
    );
  };

  const handleBack = () => {
    setPhase('disciplines');
    setSelectedDisciplines([]);
  };

  const handleConceptCountChange = (count: number) => {
    // Limit concept count to selected disciplines
    const maxCount = Math.max(1, selectedDisciplines.length);
    setConceptCount(Math.min(count, maxCount));
  };

  if (phase === 'concepts') {
    return (
      <ConceptCountPhase
        disciplines={disciplines}
        selectedDisciplines={selectedDisciplines}
        conceptCount={Math.min(conceptCount, selectedDisciplines.length)}
        onConceptCountChange={handleConceptCountChange}
        onBack={handleBack}
        onStart={handleStartWithConcepts}
        isLoading={isLoading}
      />
    );
  }

  return (
    <DisciplineSelectionPhase
      disciplines={disciplines}
      selectedDisciplines={selectedDisciplines}
      suggestedCombinations={suggestedCombinations}
      onToggleDiscipline={toggleDiscipline}
      onQuickSelect={handleQuickSelect}
      onSurpriseMe={handleSurpriseMe}
      onNext={handleCustomStart}
      isLoading={isLoading}
    />
  );
};
