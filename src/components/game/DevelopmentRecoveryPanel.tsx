
import React from 'react';

interface DevelopmentRecoveryPanelProps {
  hasSnapshots: boolean;
  onRestoreSnapshot: () => void;
  onGameReset: () => void;
}

export const DevelopmentRecoveryPanel: React.FC<DevelopmentRecoveryPanelProps> = ({
  hasSnapshots,
  onRestoreSnapshot,
  onGameReset
}) => {
  if (process.env.NODE_ENV !== 'development' || !hasSnapshots) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 bg-black/80 text-white p-2 rounded text-xs">
      <div>Recovery Options:</div>
      <button 
        onClick={onRestoreSnapshot}
        className="block text-yellow-400 hover:text-yellow-300"
      >
        Restore Last Save
      </button>
      <button 
        onClick={onGameReset}
        className="block text-red-400 hover:text-red-300"
      >
        Emergency Reset
      </button>
    </div>
  );
};
