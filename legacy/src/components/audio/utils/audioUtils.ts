
export const getDisciplineFrequencies = (disciplineId: string) => {
  const frequencies = {
    mathematics: [261.63, 329.63, 392.00], // C-E-G major triad
    music: [220.00, 277.18, 330.00], // A-C#-E major triad
    philosophy: [196.00, 246.94, 293.66], // G-B-D major triad
    physics: [174.61, 220.00, 261.63], // F-A-C major triad
    art: [146.83, 185.00, 220.00], // D-F#-A major triad
    history: [130.81, 164.81, 196.00] // C-E-G lower octave
  };
  return frequencies[disciplineId as keyof typeof frequencies] || frequencies.mathematics;
};

export const createTone = (
  audioContext: AudioContext,
  masterGain: GainNode,
  frequency: number,
  type: OscillatorType = 'sine',
  duration: number = 1000
) => {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
  
  oscillator.connect(gainNode);
  gainNode.connect(masterGain);
  
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration / 1000);
};

export const getLayerFrequencies = () => {
  return {
    cosmic: 55, // Deep bass
    harmonic: 110, // Low harmonic
    ethereal: 220 // Mid-range tone
  };
};
