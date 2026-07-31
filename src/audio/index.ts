/**
 * THE AUDIO LAYER, in one place.
 *
 * The split below is the important thing about this module and is worth reading
 * before using any of it:
 *
 *   PURE      mode, comfort, plan, motif, grammar, attention, attunement,
 *             conclusion, describe, intensity — no AudioContext anywhere, all
 *             unit-tested in Node. This is where every musical *decision* is made.
 *   SOUNDING  engine, voices, scheduler — the Web Audio surface. It renders
 *             plans faithfully and decides nothing.
 *   WIRED     director, productionAudio — the seam between cues and sound.
 *
 * A caller that wants to know what the game will sound like should reach for the
 * pure half. A caller that wants it to happen should reach for `audioDirector`.
 */

// ─── Pure: the musical decisions ────────────────────────────────────────────
export {
  COMFORT,
  clampBeatingHz,
  clampLifetimeSeconds,
  tensionCeiling,
  type ComfortTable,
} from "./comfort";
export {
  CASTALIA_MODE,
  REGISTER_ORDER,
  TEMPERAMENTS,
  beatingHzBetween,
  centsBetween,
  centsForBeatingHz,
  degreeFrequency,
  intervalClass,
  isStable,
  isTense,
  nearestStableDegree,
  nearestTenseDegree,
  pitchClass,
  ratioForClass,
  registerAt,
  registerIndex,
  shiftRegister,
  transposeCents,
  type TemperamentId,
  type WorldMode,
} from "./mode";
export {
  AUDIO_OUTCOME_KINDS,
  AUDIO_VOICE_ROLES,
  VOICE_PLAN_KINDS,
  auditComfort,
  capTenseGain,
  makeVoicePlan,
  mergePlans,
  noteEndSeconds,
  noteLifetime,
  notesSoundingAt,
  peakConcurrentNotes,
  peakConcurrentTenseNotes,
  peakSummedGain,
  peakTenseSummedGain,
  planDurationSeconds,
  summedGainAt,
  tenseNotesSoundingAt,
  type AudioOutcomeKind,
  type AudioVoiceRole,
  type ComfortAuditInput,
  type PlannedBeating,
  type PlannedNote,
  type VoiceEnvelope,
  type VoicePlan,
  type VoicePlanKind,
  type VoicePlanMeta,
  type VoicePlanMetaInput,
} from "./plan";
export {
  ARTICULATION_SHAPE,
  NEUTRAL_PHRASING,
  anchorDegree,
  deterministicUnit,
  envelopeFor,
  motifSpanSeconds,
  motifUnits,
  phrasedUnitSeconds,
  renderMotif,
  type AudioPhrasing,
  type MotifSource,
  type RenderMotifOptions,
} from "./motif";
export {
  beatingKeyFor,
  beatingRateFor,
  imitationInterval,
  planEcho,
  planGround,
  planPassage,
  planRelationVoices,
  planTension,
  suspensionInterval,
  type RelationPlanInput,
} from "./grammar";
export {
  ATTENTION_RELEASED,
  ATTENTION_SPACE_MODES,
  planAttentionSpace,
  type AttentionSpaceInput,
  type AttentionSpaceMode,
  type AttentionSpacePlan,
} from "./attention";
export {
  attunementBedGain,
  auditAttunement,
  condenseChannel,
  flattenAttunement,
  planAttunement,
  shimmerDegree,
  type AttunementChannel,
  type AttunementInput,
  type AttunementPlan,
  type AttunementThread,
} from "./attunement";
export {
  CONCLUSION_SECTION_KINDS,
  planConclusionPerformance,
  renderPerformedVoice,
  type ConclusionAudioPlan,
  type ConclusionRenderOptions,
  type ConclusionSection,
  type ConclusionSectionKind,
  type PerformanceScore,
  type PerformedEnsemble,
  type PerformedEntry,
  type PerformedPhrasing,
  type PerformedUnresolved,
  type PerformedVoice,
} from "./conclusion";
export {
  GRAMMAR_PHRASE,
  describeAttentionSpace,
  describeAttunement,
  describeConclusion,
  describeVoicePlan,
  intervalPhrase,
  outcomePhrase,
  type AudioNames,
} from "./describe";
export {
  AUDIO_INTENSITIES,
  INTENSITY_PROFILES,
  applyIntensity,
  type AudioIntensity,
  type IntensityProfile,
} from "./intensity";
export { SCORE, unitSecondsFor } from "./score";

// ─── Sounding: the Web Audio surface ────────────────────────────────────────
export { audio } from "./engine";
export { ambient } from "./ambient";
export {
  LEGACY_TIMBRE,
  createVoiceBudget,
  noiseSource,
  playNote,
  playVoice,
  voiceBudget,
  type SimpleVoiceOptions,
  type VoiceBudget,
  type VoiceRequest,
} from "./voices";
export {
  createLookaheadScheduler,
  createPlanQueue,
  realizeVoicePlan,
  type LookaheadScheduler,
  type LookaheadSchedulerOptions,
  type PlanQueue,
  type PlanQueueOptions,
  type QueuedPlan,
  type RealizeTargets,
} from "./scheduler";

// ─── Wired: cues become sound ───────────────────────────────────────────────
export {
  createAudioDirector,
  isPerformanceScore,
  type AudioCaption,
  type AudioCaptionListener,
  type AudioContentLookup,
  type AudioDirector,
  type AudioDirectorOptions,
  type AudioSink,
} from "./director";
export {
  attachAudioDirector,
  audioDirector,
  lastAudioCaption,
  onAudioCaption,
  productionSink,
  semanticScheduler,
  stopSemanticAudio,
} from "./productionAudio";

// `AudioBridge` is deliberately *not* re-exported here. It is the React contact
// point, and a barrel that drags React and the store in behind a pure planning
// import would quietly undo the split this file exists to describe. Import it
// from "@/audio/useAudio".
