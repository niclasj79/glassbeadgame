import {
  createSessionEvent,
  type GestureProfile,
  type SessionEventV1,
} from "../../../domain/events";
import type { ThreadId } from "../../../domain/ids";
import type { SessionStateV1 } from "../../../domain/model";
import type { SessionEventLogV1 } from "../../../domain/replay";
import type { DomainSessionStore } from "../../../state/domainSession";
import type { CandidateSelectedInterpretationDraft } from "../../interactionDraft";
import { InterpretationCommitCommandError } from "./InterpretationCommitCommandError";

export type PairSelectedEventV1 = Extract<
  SessionEventV1,
  { readonly type: "pair.selected" }
>;

export type RelationHypothesizedEventV1 = Extract<
  SessionEventV1,
  { readonly type: "relation.hypothesized" }
>;

export type ThreadCommittedEventV1 = Extract<
  SessionEventV1,
  { readonly type: "thread.committed" }
>;

export type InterpretationCommitEventsV1 = readonly [
  PairSelectedEventV1,
  RelationHypothesizedEventV1,
  ThreadCommittedEventV1,
];

export interface CommitInterpretationInput {
  readonly draft: CandidateSelectedInterpretationDraft;
  readonly threadId: ThreadId;
  readonly gesture: GestureProfile;
}

export interface InterpretationCommitCommandDependencies {
  readonly domainStore: DomainSessionStore;
  readonly now: () => number;
}

export interface CommitInterpretationResult {
  readonly events: InterpretationCommitEventsV1;
  readonly eventLog: SessionEventLogV1;
  readonly session: SessionStateV1;
}

export type CommitInterpretation = (
  input: CommitInterpretationInput
) => CommitInterpretationResult;

function isCandidateSelectedDraft(
  value: unknown
): value is CandidateSelectedInterpretationDraft {
  return (
    value !== null &&
    typeof value === "object" &&
    "stage" in value &&
    value.stage === "candidate-selected"
  );
}

export function createInterpretationCommitCommand(
  dependencies: InterpretationCommitCommandDependencies
): CommitInterpretation {
  return (input) => {
    const active = dependencies.domainStore.getState();
    if (active.eventLog === null || active.session === null) {
      throw new InterpretationCommitCommandError(
        "no-active-session",
        "cannot commit an interpretation without an active canonical session"
      );
    }
    if (!isCandidateSelectedDraft(input?.draft)) {
      throw new InterpretationCommitCommandError(
        "draft-not-ready",
        "interpretation commit requires a candidate-selected draft"
      );
    }

    const { draft, gesture, threadId } = input;
    const at = dependencies.now();
    const firstSequence = active.session.lastSequence + 1;
    const pairSelected = createSessionEvent({
      sessionId: active.session.sessionId,
      sequence: firstSequence,
      at,
      type: "pair.selected",
      payload: { pair: draft.pair },
    });
    const relationHypothesized = createSessionEvent({
      sessionId: active.session.sessionId,
      sequence: firstSequence + 1,
      at,
      type: "relation.hypothesized",
      payload: { pair: draft.pair, intention: draft.intention },
    });
    const threadCommitted = createSessionEvent({
      sessionId: active.session.sessionId,
      sequence: firstSequence + 2,
      at,
      type: "thread.committed",
      payload: {
        threadId,
        pair: draft.pair,
        intention: draft.intention,
        gesture,
      },
    });
    const events: InterpretationCommitEventsV1 = Object.freeze([
      pairSelected,
      relationHypothesized,
      threadCommitted,
    ]);

    active.appendEvents(events);

    const published = dependencies.domainStore.getState();
    if (published.eventLog === null || published.session === null) {
      throw new Error("Interpretation commit did not produce a matching state");
    }

    return Object.freeze({
      events,
      eventLog: published.eventLog,
      session: published.session,
    });
  };
}
