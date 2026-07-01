
import { useState, useEffect, useCallback, useRef } from 'react';

interface StateSnapshot<T> {
  data: T;
  timestamp: number;
  version: string;
}

interface RecoveryOptions {
  persistKey?: string;
  maxSnapshots?: number;
  snapshotInterval?: number;
  enablePersistence?: boolean;
}

export const useStateRecovery = <T>(
  initialState: T,
  options: RecoveryOptions = {}
) => {
  const {
    persistKey = 'state-recovery',
    maxSnapshots = 5,
    snapshotInterval = 30000, // 30 seconds
    enablePersistence = true
  } = options;

  const [state, setState] = useState<T>(initialState);
  const [snapshots, setSnapshots] = useState<StateSnapshot<T>[]>([]);
  const lastSnapshotTime = useRef<number>(0);
  const stateVersion = useRef<string>('1.0.0');

  // Load persisted state on mount
  useEffect(() => {
    if (!enablePersistence) return;

    try {
      const persistedData = localStorage.getItem(persistKey);
      if (persistedData) {
        const parsed = JSON.parse(persistedData);
        
        if (parsed.snapshots && Array.isArray(parsed.snapshots)) {
          setSnapshots(parsed.snapshots);
          
          // Restore the most recent snapshot
          const mostRecent = parsed.snapshots[0];
          if (mostRecent && mostRecent.data) {
            setState(mostRecent.data);
            console.log('State recovered from persistence');
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted state:', error);
    }
  }, [persistKey, enablePersistence]);

  // Create snapshot
  const createSnapshot = useCallback((currentState: T) => {
    const now = Date.now();
    
    if (now - lastSnapshotTime.current < snapshotInterval) {
      return; // Too soon for another snapshot
    }

    const snapshot: StateSnapshot<T> = {
      data: JSON.parse(JSON.stringify(currentState)), // Deep clone
      timestamp: now,
      version: stateVersion.current
    };

    setSnapshots(prev => {
      const newSnapshots = [snapshot, ...prev].slice(0, maxSnapshots);
      
      // Persist to localStorage
      if (enablePersistence) {
        try {
          localStorage.setItem(persistKey, JSON.stringify({
            snapshots: newSnapshots,
            lastUpdate: now
          }));
        } catch (error) {
          console.warn('Failed to persist state snapshots:', error);
        }
      }
      
      return newSnapshots;
    });

    lastSnapshotTime.current = now;
    console.log('State snapshot created');
  }, [snapshotInterval, maxSnapshots, persistKey, enablePersistence]);

  // Auto-create snapshots when state changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      createSnapshot(state);
    }, 1000); // Debounce state changes

    return () => clearTimeout(timeoutId);
  }, [state, createSnapshot]);

  // Restore from snapshot
  const restoreFromSnapshot = useCallback((index: number = 0) => {
    if (index >= 0 && index < snapshots.length) {
      const snapshot = snapshots[index];
      setState(snapshot.data);
      console.log(`State restored from snapshot ${index} (${new Date(snapshot.timestamp).toLocaleString()})`);
      return true;
    }
    return false;
  }, [snapshots]);

  // Update state with automatic snapshotting
  const updateState = useCallback((newState: T | ((prev: T) => T)) => {
    setState(prev => {
      const updated = typeof newState === 'function' ? (newState as (prev: T) => T)(prev) : newState;
      
      // Create snapshot of previous state before updating
      createSnapshot(prev);
      
      return updated;
    });
  }, [createSnapshot]);

  // Clear all snapshots
  const clearSnapshots = useCallback(() => {
    setSnapshots([]);
    if (enablePersistence) {
      try {
        localStorage.removeItem(persistKey);
      } catch (error) {
        console.warn('Failed to clear persisted snapshots:', error);
      }
    }
  }, [persistKey, enablePersistence]);

  // Get snapshot history
  const getSnapshotHistory = useCallback(() => {
    return snapshots.map((snapshot, index) => ({
      index,
      timestamp: snapshot.timestamp,
      version: snapshot.version,
      age: Date.now() - snapshot.timestamp
    }));
  }, [snapshots]);

  // Emergency recovery (reset to initial state)
  const emergencyReset = useCallback(() => {
    setState(initialState);
    clearSnapshots();
    console.log('Emergency state reset performed');
  }, [initialState, clearSnapshots]);

  return {
    state,
    updateState,
    snapshots: getSnapshotHistory(),
    restoreFromSnapshot,
    createSnapshot: () => createSnapshot(state),
    clearSnapshots,
    emergencyReset,
    hasSnapshots: snapshots.length > 0
  };
};
