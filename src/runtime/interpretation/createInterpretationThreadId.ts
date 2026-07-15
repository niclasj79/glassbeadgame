import { toThreadId, type ThreadId } from "../../domain/ids";
import type { SessionStateV1 } from "../../domain/model";

export type CreateInterpretationThreadId = (
  session: SessionStateV1
) => ThreadId;

function threadIdForSequenceNumber(
  sessionId: SessionStateV1["sessionId"],
  sequenceNumber: number
): ThreadId {
  return toThreadId(
    `thread:${sessionId.length}:${sessionId}:${sequenceNumber}`
  );
}

export const createInterpretationThreadId: CreateInterpretationThreadId = (
  session
) => {
  const sessionId = session.sessionId;
  const threads = session.threads;
  const occupiedThreadIds = new Set(
    threads.map((thread) => thread.id)
  );

  for (
    let sequenceNumber = 1;
    sequenceNumber <= threads.length;
    sequenceNumber += 1
  ) {
    const candidate = threadIdForSequenceNumber(
      sessionId,
      sequenceNumber
    );
    if (!occupiedThreadIds.has(candidate)) return candidate;
  }

  // At most one generated identity can be occupied per existing thread.
  return threadIdForSequenceNumber(sessionId, threads.length + 1);
};
