
import React, { useState, useEffect } from 'react';
import { HeroSection } from './HeroSection';
import { DisciplineSelectionPhase } from './DisciplineSelectionPhase';

interface SessionStartFlowProps {
  disciplines: any[];
  onSessionStart: (selectedDisciplines: string[], conceptCount: number) => Promise<void>;
}

export const SessionStartFlow: React.FC<SessionStartFlowProps> = ({
  disciplines,
  onSessionStart
}) => {
  const [showDisciplineSelection, setShowDisciplineSelection] = useState(false);
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
    setShowDisciplineSelection(true);
  };

  const handleQuickSelect = async (combination: string[]) => {
    setIsLoading(true);
    try {
      // Use one concept per discipline
      await onSessionStart(combination, combination.length);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSurpriseMe = async (selectedDisciplines: string[], conceptCount: number) => {
    setIsLoading(true);
    try {
      // Randomly select 2-4 disciplines for surprise me
      const shuffled = [...selectedDisciplines].sort(() => 0.5 - Math.random());
      const randomSelection = shuffled.slice(0, 2 + Math.floor(Math.random() * 3));
      await onSessionStart(randomSelection, randomSelection.length);
    } finally {
      setIsLoading(false);
    }
  };

  if (showDisciplineSelection) {
    return (
      <DisciplineSelectionPhase
        disciplines={disciplines}
        selectedDisciplines={[]}
        suggestedCombinations={suggestedCombinations}
        onToggleDiscipline={() => {}}
        onQuickSelect={handleQuickSelect}
        onSurpriseMe={handleSurpriseMe}
        onNext={() => {}}
        isLoading={isLoading}
      />
    );
  }

  return <HeroSection onStartGame={handleStartGame} />;
};
