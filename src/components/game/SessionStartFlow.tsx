
import React, { useState, useEffect } from 'react';
import { HeroSection } from './HeroSection';
import { DisciplineSelectionPhase } from './DisciplineSelectionPhase';
import { ConceptSelectionPhase } from './ConceptSelectionPhase';

interface SessionStartFlowProps {
  disciplines: any[];
  onSessionStart: (selectedDisciplines: string[], conceptCount: number, selectedConcepts?: { [disciplineId: string]: string }) => Promise<void>;
}

export const SessionStartFlow: React.FC<SessionStartFlowProps> = ({
  disciplines,
  onSessionStart
}) => {
  const [currentPhase, setCurrentPhase] = useState<'hero' | 'discipline' | 'concept'>('hero');
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [suggestedCombinations, setSuggestedCombinations] = useState<string[][]>([]);
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

  const handleStartGame = () => {
    setCurrentPhase('discipline');
  };

  const handleQuickSelect = (combination: string[]) => {
    setSelectedDisciplines(combination);
    setCurrentPhase('concept');
  };

  const handleSurpriseMe = async (allDisciplines: string[], conceptCount: number) => {
    setIsLoading(true);
    try {
      // Randomly select 2-4 disciplines for surprise me
      const shuffled = [...allDisciplines].sort(() => 0.5 - Math.random());
      const randomSelection = shuffled.slice(0, 2 + Math.floor(Math.random() * 3));
      
      // Directly start the session for surprise me (quick start)
      await onSessionStart(randomSelection, conceptCount);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisciplineSelection = (disciplines: string[]) => {
    setSelectedDisciplines(disciplines);
    setCurrentPhase('concept');
  };

  const handleConceptsSelected = async (selectedConcepts: { [disciplineId: string]: string }) => {
    setIsLoading(true);
    try {
      await onSessionStart(selectedDisciplines, selectedDisciplines.length, selectedConcepts);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToDisciplines = () => {
    setCurrentPhase('discipline');
  };

  const handleBackToHero = () => {
    setCurrentPhase('hero');
  };

  if (currentPhase === 'concept') {
    return (
      <ConceptSelectionPhase
        disciplines={disciplines}
        selectedDisciplines={selectedDisciplines}
        onConceptsSelected={handleConceptsSelected}
        onBack={handleBackToDisciplines}
        isLoading={isLoading}
      />
    );
  }

  if (currentPhase === 'discipline') {
    return (
      <DisciplineSelectionPhase
        disciplines={disciplines}
        selectedDisciplines={selectedDisciplines}
        suggestedCombinations={suggestedCombinations}
        onToggleDiscipline={() => {}} // Not used in current implementation
        onQuickSelect={handleQuickSelect}
        onSurpriseMe={handleSurpriseMe}
        onNext={handleDisciplineSelection}
        onBack={handleBackToHero}
        isLoading={isLoading}
      />
    );
  }

  return <HeroSection onStartGame={handleStartGame} />;
};
