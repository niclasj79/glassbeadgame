
import { Concept } from '../../types';

export interface MovementState {
  [conceptId: string]: {
    lastMoved: number;
    isStable: boolean;
    position: { x: number; y: number; z: number };
  };
}

export interface QueuedUpdate {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface MovementDatabaseHook {
  updateConceptPosition: (conceptId: string, x: number, y: number, z: number) => void;
  updateStability: (concepts: Concept[], movementState: MovementState) => Promise<void>;
  cleanup: () => void;
}

export interface MovementStateHook {
  movementState: MovementState;
  updateMovementState: (conceptId: string, x: number, y: number, z: number) => void;
}

export interface MovementTimersHook {
  resetStabilityTimer: () => void;
  checkStability: () => void;
  cleanup: () => void;
}
