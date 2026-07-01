
import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface SurpriseMeButtonProps {
  disciplines: any[];
  onSurpriseMe: (selectedDisciplines: string[], conceptCount: number) => void;
}

export const SurpriseMeButton: React.FC<SurpriseMeButtonProps> = ({
  disciplines,
  onSurpriseMe
}) => {
  const handleSurpriseMe = () => {
    // Randomly select 2-4 disciplines
    const shuffled = [...disciplines].sort(() => 0.5 - Math.random());
    const randomDisciplines = shuffled.slice(0, 2 + Math.floor(Math.random() * 3));
    const randomConceptCount = 10 + Math.floor(Math.random() * 11); // 10-20 concepts
    
    onSurpriseMe(randomDisciplines.map(d => d.id), randomConceptCount);
  };

  return (
    <div className="mb-8 text-center">
      <Button
        onClick={handleSurpriseMe}
        className="bg-gradient-to-r from-pink-600 to-orange-600 hover:from-pink-700 hover:to-orange-700 px-8 py-4 text-lg"
      >
        <Sparkles className="w-5 h-5 mr-2" />
        I'm feeling serendipitous. Surprise me!
      </Button>
      <p className="text-sm text-gray-400 mt-2">Let chance guide your exploration</p>
    </div>
  );
};
