import { useCallback, useEffect, useRef } from 'react';
import { useAudioContext } from './useAudioContext';
import { useAudioState } from './useAudioState';
import { getDisciplineFrequencies } from '../utils/audioUtils';
import { memoryManager } from '../../game/arena/utils/memoryManager';

export const useAudioEngine = () => {
  const {
    audioContextRef,
    masterGainRef,
    initializeAudioContext,
    updateMasterVolume,
    stopAmbientLayer,
    stopAllAmbientLayers
  } = useAudioContext();

  const {
    isAudioEnabled,
    setIsAudioEnabled,
    masterVolume,
    setMasterVolumeState,
    isInitialized,
    setIsInitialized
  } = useAudioState();

  const backgroundOscillatorsRef = useRef<Map<string, { osc: OscillatorNode; gain: GainNode }[]>>(new Map());
  const rhythmIntervalRef = useRef<number | null>(null);
  const rhythmGainRef = useRef<GainNode | null>(null);
  const lastAudioActionRef = useRef<number>(0);
  const intensityRef = useRef(0);

  const isAudioActionAllowed = useCallback((minGap = 50) => {
    const now = Date.now();
    if (now - lastAudioActionRef.current < minGap) return false;
    lastAudioActionRef.current = now;
    return true;
  }, []);

  const getCtx = useCallback(() => {
    if (!isAudioEnabled || !isInitialized || !audioContextRef.current || !masterGainRef.current) return null;
    return audioContextRef.current;
  }, [isAudioEnabled, isInitialized, audioContextRef, masterGainRef]);

  // Pre-load
  const preloadAudio = useCallback(async () => {
    if (isInitialized) return true;
    try {
      const success = await initializeAudioContext(masterVolume);
      if (success) { setIsInitialized(true); return true; }
    } catch (e) { console.error('Audio preload failed:', e); }
    return false;
  }, [isInitialized, initializeAudioContext, masterVolume, setIsInitialized]);

  // === LAYERED BACKGROUND SOUNDSCAPE ===
  const createBackgroundSoundscape = useCallback((concepts: any[], rotationX: number, rotationY: number) => {
    const actx = getCtx();
    if (!actx || !masterGainRef.current) return;

    // Stop existing layers
    backgroundOscillatorsRef.current.forEach(nodes => {
      nodes.forEach(n => { try { n.osc.stop(); } catch {} });
    });
    backgroundOscillatorsRef.current.clear();

    // Get top 3 disciplines
    const density = new Map<string, number>();
    concepts.forEach(c => density.set(c.discipline, (density.get(c.discipline) || 0) + 1));
    const topDiscs = Array.from(density.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);

    topDiscs.forEach(([discipline], idx) => {
      const freqs = getDisciplineFrequencies(discipline);
      const baseFreq = freqs[0] * 0.5; // low octave
      const nodes: { osc: OscillatorNode; gain: GainNode }[] = [];

      // Detuned pad pair for richness — audible volume
      for (const detune of [-6, 0, 6]) {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        const filter = actx.createBiquadFilter();

        osc.type = detune === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(baseFreq * (detune === 6 ? 2 : 1), actx.currentTime);
        osc.detune.setValueAtTime(detune, actx.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600 + idx * 150, actx.currentTime);
        filter.Q.setValueAtTime(0.7, actx.currentTime);

        // Much louder so users can hear the drone
        const vol = 0.12 / (idx + 1);
        gain.gain.setValueAtTime(0, actx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, actx.currentTime + 4);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGainRef.current!);
        osc.start();
        nodes.push({ osc, gain });
      }

      backgroundOscillatorsRef.current.set(discipline, nodes);
    });

    // Start rhythmic pulse
    EffectsRenderer_startRhythmicPulse(actx, masterGainRef.current);
  }, [getCtx, masterGainRef]);

  // Rhythmic pulse - subtle filtered clicks that provide a heartbeat
  const EffectsRenderer_startRhythmicPulse = useCallback((actx: AudioContext, master: GainNode) => {
    if (rhythmIntervalRef.current) clearInterval(rhythmIntervalRef.current);

    rhythmGainRef.current = actx.createGain();
    rhythmGainRef.current.gain.setValueAtTime(0.06, actx.currentTime);
    rhythmGainRef.current.connect(master);

    const baseTempo = 700; // ms per beat

    const playBeat = () => {
      if (!actx || actx.state !== 'running') return;
      const tempo = Math.max(350, baseTempo - intensityRef.current * 200);

      const osc = actx.createOscillator();
      const g = actx.createGain();
      const f = actx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(80 + intensityRef.current * 40, actx.currentTime);

      f.type = 'bandpass';
      f.frequency.setValueAtTime(200, actx.currentTime);
      f.Q.setValueAtTime(5, actx.currentTime);

      g.gain.setValueAtTime(0, actx.currentTime);
      g.gain.linearRampToValueAtTime(0.08 + intensityRef.current * 0.05, actx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.15);

      osc.connect(f);
      f.connect(g);
      g.connect(rhythmGainRef.current || master);
      osc.start();
      osc.stop(actx.currentTime + 0.2);

      if (rhythmIntervalRef.current) clearTimeout(rhythmIntervalRef.current);
      rhythmIntervalRef.current = window.setTimeout(playBeat, tempo);
    };

    rhythmIntervalRef.current = window.setTimeout(playBeat, baseTempo);
  }, []);

  // === INTERACTION SOUNDS ===

  // Hover: soft bell chime
  const playHoverSound = useCallback(() => {
    const actx = getCtx();
    if (!actx || !masterGainRef.current || !isAudioActionAllowed(80)) return;

    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200 + Math.random() * 400, actx.currentTime);
    g.gain.setValueAtTime(0, actx.currentTime);
    g.gain.linearRampToValueAtTime(0.06, actx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.25);
    osc.connect(g);
    g.connect(masterGainRef.current);
    osc.start();
    osc.stop(actx.currentTime + 0.3);
  }, [getCtx, masterGainRef, isAudioActionAllowed]);

  // Grab: ascending tone
  const playGrabSound = useCallback(() => {
    const actx = getCtx();
    if (!actx || !masterGainRef.current || !isAudioActionAllowed(100)) return;

    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, actx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, actx.currentTime + 0.15);
    g.gain.setValueAtTime(0, actx.currentTime);
    g.gain.linearRampToValueAtTime(0.1, actx.currentTime + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.3);
    osc.connect(g);
    g.connect(masterGainRef.current);
    osc.start();
    osc.stop(actx.currentTime + 0.35);
  }, [getCtx, masterGainRef, isAudioActionAllowed]);

  // Drop: resonant plop
  const playDropSound = useCallback(() => {
    const actx = getCtx();
    if (!actx || !masterGainRef.current || !isAudioActionAllowed(100)) return;

    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, actx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, actx.currentTime + 0.2);
    g.gain.setValueAtTime(0.12, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.4);
    osc.connect(g);
    g.connect(masterGainRef.current);
    osc.start();
    osc.stop(actx.currentTime + 0.45);
  }, [getCtx, masterGainRef, isAudioActionAllowed]);

  // Rotation whoosh: filtered noise
  const playRotationSound = useCallback((direction: number) => {
    const actx = getCtx();
    if (!actx || !masterGainRef.current || !isAudioActionAllowed(150)) return;

    // Create noise via buffer
    const bufferSize = actx.sampleRate * 0.3;
    const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() - 0.5) * 2;

    const src = actx.createBufferSource();
    src.buffer = buffer;
    const filter = actx.createBiquadFilter();
    const g = actx.createGain();
    const panner = actx.createStereoPanner();

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, actx.currentTime);
    filter.Q.setValueAtTime(2, actx.currentTime);

    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, direction)), actx.currentTime);

    g.gain.setValueAtTime(0, actx.currentTime);
    g.gain.linearRampToValueAtTime(0.04, actx.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.25);

    src.connect(filter);
    filter.connect(g);
    g.connect(panner);
    panner.connect(masterGainRef.current);
    src.start();
  }, [getCtx, masterGainRef, isAudioActionAllowed]);

  // Proximity tension: detuned interval narrowing
  const playProximityTension = useCallback((proximity: number) => {
    const actx = getCtx();
    if (!actx || !masterGainRef.current || !isAudioActionAllowed(200)) return;

    const baseFreq = 220;
    const detuneAmount = (1 - proximity) * 50 + 1; // closer = less detune
    const osc1 = actx.createOscillator();
    const osc2 = actx.createOscillator();
    const g = actx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, actx.currentTime);
    osc2.frequency.setValueAtTime(baseFreq + detuneAmount, actx.currentTime);
    osc2.frequency.linearRampToValueAtTime(baseFreq + 1, actx.currentTime + 0.5);

    g.gain.setValueAtTime(proximity * 0.06, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.6);

    osc1.connect(g);
    osc2.connect(g);
    g.connect(masterGainRef.current);
    osc1.start();
    osc2.start();
    osc1.stop(actx.currentTime + 0.65);
    osc2.stop(actx.currentTime + 0.65);
  }, [getCtx, masterGainRef, isAudioActionAllowed]);

  // Synthesis chord: full chord burst + shimmer arpeggio
  const playSynthesisChord = useCallback((discipline1: string, discipline2: string, resonance: number) => {
    const actx = getCtx();
    if (!actx || !masterGainRef.current) return;

    const freqs1 = getDisciplineFrequencies(discipline1);
    const freqs2 = getDisciplineFrequencies(discipline2);
    const allFreqs = [...freqs1, ...freqs2];

    // Chord burst
    allFreqs.forEach((freq, i) => {
      const osc = actx.createOscillator();
      const g = actx.createGain();
      osc.type = i < 3 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, actx.currentTime);
      g.gain.setValueAtTime(0, actx.currentTime);
      g.gain.linearRampToValueAtTime(0.08, actx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 1.5);
      osc.connect(g);
      g.connect(masterGainRef.current!);
      osc.start();
      osc.stop(actx.currentTime + 1.6);
    });

    // Shimmer arpeggio
    allFreqs.forEach((freq, i) => {
      setTimeout(() => {
        if (!actx || actx.state !== 'running') return;
        const osc = actx.createOscillator();
        const g = actx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 2, actx.currentTime);
        g.gain.setValueAtTime(0.04, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.4);
        osc.connect(g);
        g.connect(masterGainRef.current!);
        osc.start();
        osc.stop(actx.currentTime + 0.45);
      }, i * 100);
    });
  }, [getCtx, masterGainRef]);

  // Update soundtrack intensity based on score
  const updateSoundtrackIntensity = useCallback((totalResonance: number) => {
    intensityRef.current = Math.min(1, totalResonance / 200);

    // Adjust background drone filter/volume based on intensity
    backgroundOscillatorsRef.current.forEach(nodes => {
      nodes.forEach(n => {
        try {
          const actx = audioContextRef.current;
          if (actx) {
            const target = 0.03 + intensityRef.current * 0.04;
            n.gain.gain.linearRampToValueAtTime(target, actx.currentTime + 1);
          }
        } catch {}
      });
    });
  }, [audioContextRef]);

  // Simplified dynamic panning
  const updateDynamicPanning = useCallback((rotationX: number, rotationY: number) => {
    if (!isAudioEnabled || !isInitialized || !audioContextRef.current) return;
    backgroundOscillatorsRef.current.forEach(nodes => {
      const panValue = Math.sin(rotationY) * 0.1;
      nodes.forEach(n => {
        const currentGain = n.gain.gain.value;
        if (currentGain > 0) {
          n.gain.gain.setValueAtTime(currentGain * (1 + panValue), audioContextRef.current!.currentTime);
        }
      });
    });
  }, [isAudioEnabled, isInitialized, audioContextRef]);

  // Original playDisciplineSound
  const playDisciplineSound = useCallback((disciplineId: string, intensity: number = 0.5, position?: { x: number; y: number; z: number }) => {
    const actx = getCtx();
    if (!actx || !masterGainRef.current || !isAudioActionAllowed()) return;

    const frequencies = getDisciplineFrequencies(disciplineId);
    const baseFreq = frequencies[0];

    const oscillator = actx.createOscillator();
    const gainNode = actx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(baseFreq, actx.currentTime);
    gainNode.gain.setValueAtTime(0, actx.currentTime);
    gainNode.gain.linearRampToValueAtTime(intensity * 0.15, actx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.6);

    oscillator.connect(gainNode);
    gainNode.connect(masterGainRef.current);
    oscillator.start();
    oscillator.stop(actx.currentTime + 0.6);
  }, [getCtx, masterGainRef, isAudioActionAllowed]);

  const initializeAudio = useCallback(async () => {
    if (isInitialized) { setIsAudioEnabled(true); return; }
    const success = await preloadAudio();
    if (success) setIsAudioEnabled(true);
  }, [isInitialized, preloadAudio, setIsAudioEnabled]);

  const setMasterVolume = useCallback((volume: number) => {
    setMasterVolumeState(volume);
    updateMasterVolume(volume);
  }, [setMasterVolumeState, updateMasterVolume]);

  const toggleAudio = useCallback(() => {
    if (!isAudioEnabled && !isInitialized) {
      initializeAudio();
    } else {
      setIsAudioEnabled(!isAudioEnabled);
      if (isAudioEnabled) {
        stopAllAmbientLayers();
        backgroundOscillatorsRef.current.forEach(nodes => {
          nodes.forEach(n => { try { n.osc.stop(); } catch {} });
        });
        backgroundOscillatorsRef.current.clear();
        if (rhythmIntervalRef.current) {
          clearTimeout(rhythmIntervalRef.current);
          rhythmIntervalRef.current = null;
        }
      }
    }
  }, [isAudioEnabled, isInitialized, initializeAudio, setIsAudioEnabled, stopAllAmbientLayers]);

  const cleanup = useCallback(() => {
    backgroundOscillatorsRef.current.forEach(nodes => {
      nodes.forEach(n => { try { n.osc.stop(); } catch {} });
    });
    backgroundOscillatorsRef.current.clear();
    if (rhythmIntervalRef.current) {
      clearTimeout(rhythmIntervalRef.current);
      rhythmIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    memoryManager.registerCleanupTask(cleanup);
    return () => { memoryManager.unregisterCleanupTask(cleanup); cleanup(); };
  }, [cleanup]);

  return {
    isAudioEnabled,
    isInitialized,
    masterVolume,
    preloadAudio,
    initializeAudio,
    toggleAudio,
    setMasterVolume,
    playDisciplineSound,
    createBackgroundSoundscape,
    updateDynamicPanning,
    stopAmbientLayer,
    stopAllAmbientLayers,
    cleanup,
    // New interaction sounds
    playHoverSound,
    playGrabSound,
    playDropSound,
    playRotationSound,
    playProximityTension,
    playSynthesisChord,
    updateSoundtrackIntensity,
  };
};
