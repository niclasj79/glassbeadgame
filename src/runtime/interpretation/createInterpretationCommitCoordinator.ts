import type { GestureProfile } from "../../domain/events";
import type { ThreadId } from "../../domain/ids";
import type { SessionStateV1 } from "../../domain/model";
import type { SessionEventLogV1 } from "../../domain/replay";
import type { DomainSessionStore } from "../../state/domainSession";
import type { InterpretationDraftStore } from "../../state/interactionDraft";
import {
  createInterpretationCommitCommand,
  type InterpretationCommitEventsV1,
} from "../commands/interpretationCommit";
import {
  buildGestureProfile,
  type BuildGestureProfileInput,
} from "../gestureProfile";
import type {
  CandidateSelectedInterpretationDraft,
  InactiveInterpretationDraft,
} from "../interactionDraft";

export interface CommitInterpretivelyInput {
  readonly threadId: ThreadId;
  readonly gesture: BuildGestureProfileInput;
}

export interface InterpretiveCommitResult {
  readonly committedDraft: CandidateSelectedInterpretationDraft;
  readonly gesture: GestureProfile;
  readonly events: InterpretationCommitEventsV1;
  readonly eventLog: SessionEventLogV1;
  readonly session: SessionStateV1;
  readonly draft: InactiveInterpretationDraft;
}

export interface InterpretationCommitCoordinatorDependencies {
  readonly domainStore: DomainSessionStore;
  readonly draftStore: InterpretationDraftStore;
  readonly now: () => number;
}

export type CommitInterpretively = (
  input: CommitInterpretivelyInput
) => InterpretiveCommitResult;

export function createInterpretationCommitCoordinator(
  dependencies: InterpretationCommitCoordinatorDependencies
): CommitInterpretively {
  const commitInterpretation = createInterpretationCommitCommand({
    domainStore: dependencies.domainStore,
    now: dependencies.now,
  });

  return (input) => {
    const committedDraft = dependencies.draftStore.getState()
      .draft as CandidateSelectedInterpretationDraft;
    const gesture = buildGestureProfile(input.gesture);
    const committed = commitInterpretation({
      draft: committedDraft,
      threadId: input.threadId,
      gesture,
    });

    dependencies.draftStore.getState().reset();
    const draft = dependencies.draftStore.getState()
      .draft as InactiveInterpretationDraft;

    return Object.freeze({
      committedDraft,
      gesture,
      events: committed.events,
      eventLog: committed.eventLog,
      session: committed.session,
      draft,
    });
  };
}
