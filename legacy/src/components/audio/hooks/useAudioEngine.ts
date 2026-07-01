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

  const backgroundNodesRef = useRef<{ osc: OscillatorNode; gain: GainNode }[]>([]);
  const rhythmIntervalRef = useRef<number | null>(null);
  const rhythmGainRef = useRef<GainNode | null>(null);
  const lastAudioActionRef = useRef<number>(0);
  const intensityRef = useRef(0);
  const conceptsRef = useRef<any[]>([]);
  const soundscapeStartedRef = useRef(false);

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

  const preloadAudio = useCallback(async () => {
    if (isInitialized) return true;
    try {
      const success = await initializeAudioContext(masterVolume);
      if (success) { setIsInitialized(true); return true; }
    } catch (e) { console.error('Audio preload failed:', e); }
    return false;
  }, [isInitialized, initializeAudioContext, masterVolume, setIsInitialized]);

  // === WARM, MUSICAL BACKGROUND SOUNDSCAPE ===
  const stopSoundscape = useCallback(() => {
    backgroundNodesRef.current.forEach(n => { try { n.osc.stop(); } catch {} });
    backgroundNodesRef.current = [];
    if (rhythmIntervalRef.current) {
      clearTimeout(rhythmIntervalRef.current);
      rhythmIntervalRef.current = null;
    }
    soundscapeStartedRef.current = false;
  }, []);

  const createBackgroundSoundscape = useCallback((concepts: any[], _rotationX: number, _rotationY: number) => {
    const actx = getCtx();
    if (!actx || !masterGainRef.current) return;

    conceptsRef.current = concepts;

    // Don't restart if already playing
    if (soundscapeStartedRef.current) return;
    soundscapeStartedRef.current = true;

    // Stop any existing
    stopSoundscape();
    soundscapeStartedRef.current = true;

    // Get discipline distribution
    const density = new Map<string, number>();
    concepts.forEach(c => density.set(c.discipline, (density.get(c.discipline) || 0) + 1));
    const topDiscs = Array.from(density.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);

    // Create warm pad layers - use lower frequencies and sine waves for warmth
    topDiscs.forEach(([discipline], idx) => {
      const freqs = getDisciplineFrequencies(discipline);
      // Use root note in a very low octave for a warm pad
      const rootFreq = freqs[0] * 0.25; // Two octaves down

      // Create a warm chord: root + fifth + octave
      const chordFreqs = [rootFreq, rootFreq * 1.5, rootFreq * 2];

      chordFreqs.forEach((freq, chordIdx) => {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        const filter = actx.createBiquadFilter();

        // Sine for warmth, no harsh harmonics
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, actx.currentTime);
        // Subtle slow vibrato for movement
        const lfo = actx.createOscillator();
        const lfoGain = actx.createGain();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.15 + idx * 0.05, actx.currentTime); // Very slow wobble
        lfoGain.gain.setValueAtTime(freq * 0.003, actx.currentTime); // Tiny pitch variation
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        // Warm lowpass - cut everything harsh
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200 + idx * 50, actx.currentTime);
        filter.Q.setValueAtTime(0.5, actx.currentTime);

        // Gentle volume - audible but not dominant
        const vol = (0.06 / (idx + 1)) / (chordIdx + 1);
        gain.gain.setValueAtTime(0, actx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, actx.currentTime + 5); // Slow fade in

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGainRef.current!);
        osc.start();
        backgroundNodesRef.current.push({ osc, gain });
        // Keep LFO reference tied to osc lifetime
        backgroundNodesRef.current.push({ osc: lfo, gain: lfoGain });
      });
    });

    // Start soft pulsating beat
    startSoftBeat(actx, masterGainRef.current);
  }, [getCtx, masterGainRef, stopSoundscape]);

  // Soft pulsating beat - low, rounded, like a distant heartbeat
  const startSoftBeat = useCallback((actx: AudioContext, master: GainNode) => {
    if (rhythmIntervalRef.current) clearTimeout(rhythmIntervalRef.current);

    rhythmGainRef.current = actx.createGain();
    rhythmGainRef.current.gain.setValueAtTime(0.1, actx.currentTime);
    rhythmGainRef.current.connect(master);

    const baseTempo = 900; // Slower, more meditative
    let beatCount = 0;

    const playBeat = () => {
      if (!actx || actx.state !== 'running') return;
      const tempo = Math.max(500, baseTempo - intensityRef.current * 150);
      beatCount++;

      // Alternate between two tones for tonal interest
      const isAccent = beatCount % 4 === 0;
      const baseFreq = isAccent ? 55 : 44; // A1 and low F

      const osc = actx.createOscillator();
      const g = actx.createGain();
      const filter = actx.createBiquadFilter();

      osc.type = 'sine'; // Pure sine for softness
      osc.frequency.setValueAtTime(baseFreq + intensityRef.current * 10, actx.currentTime);
      // Gentle pitch drop for "thud" feel
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, actx.currentTime + 0.15);

      // Very low pass to remove any click
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(120, actx.currentTime);
      filter.Q.setValueAtTime(1, actx.currentTime);

      // Soft envelope - slow attack, gentle decay
      const peakGain = isAccent
        ? 0.12 + intensityRef.current * 0.06
        : 0.07 + intensityRef.current * 0.03;
      g.gain.setValueAtTime(0, actx.currentTime);
      g.gain.linearRampToValueAtTime(peakGain, actx.currentTime + 0.04); // Softer attack
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.35); // Longer tail

      osc.connect(filter);
      filter.connect(g);
      g.connect(rhythmGainRef.current || master);
      osc.start();
      osc.stop(actx.currentTime + 0.4);

      // Every 8 beats, add a subtle tonal note for variation
      if (beatCount % 8 === 0) {
        const topDiscs = Array.from(new Set(conceptsRef.current.map(c => c.discipline))).slice(0, 2);
        const disc = topDiscs[Math.floor(Math.random() * topDiscs.length)] || 'mathematics';
        const freqs = getDisciplineFrequencies(disc);
        const noteFreq = freqs[Math.floor(Math.random() * freqs.length)] * 0.5;

        const noteOsc = actx.createOscillator();
        const noteG = actx.createGain();
        const noteF = actx.createBiquadFilter();
        noteOsc.type = 'sine';
        noteOsc.frequency.setValueAtTime(noteFreq, actx.currentTime);
        noteF.type = 'lowpass';
        noteF.frequency.setValueAtTime(300, actx.currentTime);
        noteG.gain.setValueAtTime(0, actx.currentTime);
        noteG.gain.linearRampToValueAtTime(0.04, actx.currentTime + 0.1);
        noteG.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 1.2);
        noteOsc.connect(noteF);
        noteF.connect(noteG);
        noteG.connect(master);
        noteOsc.start();
        noteOsc.stop(actx.currentTime + 1.3);
      }

      rhythmIntervalRef.current = window.setTimeout(playBeat, tempo);
    };

    rhythmIntervalRef.current = window.setTimeout(playBeat, baseTempo);
  }, []);

  // === INTERACTION SOUNDS (softened) ===

  const playHoverSound = useCallback(() => {
    const actx = getCtx();
    if (!actx || !masterGainRef.current || !isAudioActionAllowed(80)) return;

    // Soft bell - lower frequency, longer decay
    const osc = actx.createOscillator();
    const g = actx.createGain();
    const f = actx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600 + Math.random() * 200, actx.currentTime);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(800, actx.currentTime);
    g.gain.setValueAtTime(0, actx.currentTime);
    g.gain.linearRampToValueAtTime(0.04, actx.currentTime + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.4);
    osc.connect(f);
    f.connect(g);
    g.connect(masterGainRef.current);
    osc.start();
    osc.stop(actx.currentTime + 0.45);
  }, [getCtx, masterGainRef, isAudioActionAllowed]);

  const playGrabSound = useCallback(() => {
    const actx = getCtx();
    if (!actx || !masterGainRef.current || !isAudioActionAllowed(100)) return;

    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, actx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(350, actx.currentTime + 0.2);
    g.gain.setValueAtTime(0, actx.currentTime);
    g.gain.linearRampToValueAtTime(0.06, actx.currentTime + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.35);
    osc.connect(g);
    g.connect(masterGainRef.current);
    osc.start();
    osc.stop(actx.currentTime + 0.4);
  }, [getCtx, masterGainRef, isAudioActionAllowed]);

  const playDropSound = useCallback(() => {
    const actx = getCtx();
    if (!actx || !masterGainRef.current || !isAudioActionAllowed(100)) return;

    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, actx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, actx.currentTime + 0.25);
    g.gain.setValueAtTime(0.08, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.5);
    osc.connect(g);
    g.connect(masterGainRef.current);
    osc.start();
    osc.stop(actx.currentTime + 0.55);
  }, [getCtx, masterGainRef, isAudioActionAllowed]);

  const playRotationSound = useCallback((direction: number) => {
    const actx = getCtx();
    if (!actx || !masterGainRef.current || !isAudioActionAllowed(200)) return;

    // Softer whoosh - lower freq noise
    const bufferSize = actx.sampleRate * 0.2;
    const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() - 0.5) * 2;

    const src = actx.createBufferSource();
    src.buffer = buffer;
    const filter = actx.createBiquadFilter();
    const g = actx.createGain();
    const panner = actx.createStereoPanner();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, actx.currentTime);
    filter.Q.setValueAtTime(1, actx.currentTime);
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, direction)), actx.currentTime);
    g.gain.setValueAtTime(0, actx.currentTime);
    g.gain.linearRampToValueAtTime(0.025, actx.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.2);

    src.connect(filter);
    filter.connect(g);
    g.connect(panner);
    panner.connect(masterGainRef.current);
    src.start();
  }, [getCtx, masterGainRef, isAudioActionAllowed]);

  const playProximityTension = useCallback((proximity: number) => {
    const actx = getCtx();
    if (!actx || !masterGainRef.current || !isAudioActionAllowed(200)) return;

    const baseFreq = 110;
    const detuneAmount = (1 - proximity) * 30 + 1;
    const osc1 = actx.createOscillator();
    const osc2 = actx.createOscillator();
    const g = actx.createGain();
    const f = actx.createBiquadFilter();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, actx.currentTime);
    osc2.frequency.setValueAtTime(baseFreq + detuneAmount, actx.currentTime);
    osc2.frequency.linearRampToValueAtTime(baseFreq + 1, actx.currentTime + 0.5);

    f.type = 'lowpass';
    f.frequency.setValueAtTime(250, actx.currentTime);
    g.gain.setValueAtTime(proximity * 0.04, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.6);

    osc1.connect(f);
    osc2.connect(f);
    f.connect(g);
    g.connect(masterGainRef.current);
    osc1.start();
    osc2.start();
    osc1.stop(actx.currentTime + 0.65);
    osc2.stop(actx.currentTime + 0.65);
  }, [getCtx, masterGainRef, isAudioActionAllowed]);

  const playSynthesisChord = useCallback((discipline1: string, discipline2: string, resonance: number) => {
    const actx = getCtx();
    if (!actx || !masterGainRef.current) return;

    const freqs1 = getDisciplineFrequencies(discipline1);
    const freqs2 = getDisciplineFrequencies(discipline2);
    // Use lower octave for warmth
    const allFreqs = [...freqs1.map(f => f * 0.5), ...freqs2.map(f => f * 0.5)];

    // Warm chord bloom
    allFreqs.forEach((freq, i) => {
      const osc = actx.createOscillator();
      const g = actx.createGain();
      const f = actx.createBiquadFilter();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, actx.currentTime);
      f.type = 'lowpass';
      f.frequency.setValueAtTime(400, actx.currentTime);
      g.gain.setValueAtTime(0, actx.currentTime);
      g.gain.linearRampToValueAtTime(0.05, actx.currentTime + 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 2);
      osc.connect(f);
      f.connect(g);
      g.connect(masterGainRef.current!);
      osc.start();
      osc.stop(actx.currentTime + 2.1);
    });

    // Gentle arpeggio
    allFreqs.slice(0, 4).forEach((freq, i) => {
      setTimeout(() => {
        if (!actx || actx.state !== 'running') return;
        const osc = actx.createOscillator();
        const g = actx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, actx.currentTime);
        g.gain.setValueAtTime(0.03, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.6);
        osc.connect(g);
        g.connect(masterGainRef.current!);
        osc.start();
        osc.stop(actx.currentTime + 0.65);
      }, i * 150);
    });
  }, [getCtx, masterGainRef]);

  const updateSoundtrackIntensity = useCallback((totalResonance: number) => {
    intensityRef.current = Math.min(1, totalResonance / 200);
    // Adjust background volume with intensity
    backgroundNodesRef.current.forEach(n => {
      try {
        const actx = audioContextRef.current;
        if (actx && n.gain.gain.value > 0.001) {
          const target = n.gain.gain.value * (1 + intensityRef.current * 0.3);
          n.gain.gain.linearRampToValueAtTime(Math.min(target, 0.15), actx.currentTime + 2);
        }
      } catch {}
    });
  }, [audioContextRef]);

  const updateDynamicPanning = useCallback((rotationX: number, rotationY: number) => {
    // Minimal panning effect
  }, []);

  const playDisciplineSound = useCallback((disciplineId: string, intensity: number = 0.5, position?: { x: number; y: number; z: number }) => {
    const actx = getCtx();
    if (!actx || !masterGainRef.current || !isAudioActionAllowed()) return;

    const frequencies = getDisciplineFrequencies(disciplineId);
    const baseFreq = frequencies[0] * 0.5; // Lower octave

    const oscillator = actx.createOscillator();
    const gainNode = actx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(baseFreq, actx.currentTime);
    gainNode.gain.setValueAtTime(0, actx.currentTime);
    gainNode.gain.linearRampToValueAtTime(intensity * 0.08, actx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.8);

    oscillator.connect(gainNode);
    gainNode.connect(masterGainRef.current);
    oscillator.start();
    oscillator.stop(actx.currentTime + 0.85);
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

  // Fixed toggle: mute/unmute by adjusting master gain, don't restart
  const toggleAudio = useCallback(() => {
    if (!isInitialized) {
      initializeAudio();
      return;
    }

    if (isAudioEnabled) {
      // Mute: set master gain to 0 but keep oscillators running
      if (masterGainRef.current && audioContextRef.current) {
        masterGainRef.current.gain.linearRampToValueAtTime(0, audioContextRef.current.currentTime + 0.1);
      }
      setIsAudioEnabled(false);
    } else {
      // Unmute: restore master gain
      if (masterGainRef.current && audioContextRef.current) {
        masterGainRef.current.gain.linearRampToValueAtTime(masterVolume, audioContextRef.current.currentTime + 0.1);
      }
      setIsAudioEnabled(true);
    }
  }, [isAudioEnabled, isInitialized, initializeAudio, setIsAudioEnabled, masterGainRef, audioContextRef, masterVolume]);

  const cleanup = useCallback(() => {
    stopSoundscape();
  }, [stopSoundscape]);

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
    playHoverSound,
    playGrabSound,
    playDropSound,
    playRotationSound,
    playProximityTension,
    playSynthesisChord,
    updateSoundtrackIntensity,
  };
};
