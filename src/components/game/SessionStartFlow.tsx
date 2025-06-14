
import React, { useState, useEffect } from 'react';
import { DisciplineSelectionPhase } from './DisciplineSelectionPhase';
import { ConceptCountPhase } from './ConceptCountPhase';

interface SessionStartFlowProps {
  disciplines: any[];
  onSessionStart: (selectedDisciplines: string[], conceptCount: number) => void;
}

export const SessionStartFlow: React.FC<SessionStartFlowProps> = ({
  disciplines,
  onSessionStart
}) => {
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [suggestedCombinations, setSuggestedCombinations] = useState<string[][]>([]);
  const [phase, setPhase] = useState<'disciplines' | 'concepts'>('disciplines');
  const [conceptCount, setConceptCount] = useState(12);

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

  const handleSurpriseMe = (selectedDisciplines: string[], conceptCount: number) => {
    onSessionStart(selectedDisciplines, conceptCount);
  };

  const handleCustomStart = () => {
    if (selectedDisciplines.length > 0) {
      if (phase === 'disciplines') {
        setPhase('concepts');
      } else {
        onSessionStart(selectedDisciplines, conceptCount);
      }
    }
  };

  const handleStartWithConcepts = () => {
    onSessionStart(selectedDisciplines, conceptCount);
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
    setConceptCount(count);
  };

  if (phase === 'concepts') {
    return (
      <ConceptCountPhase
        disciplines={disciplines}
        selectedDisciplines={selectedDisciplines}
        conceptCount={conceptCount}
        onConceptCountChange={handleConceptCountChange}
        onBack={handleBack}
        onStart={handleStartWithConcepts}
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
    />
  );
};
