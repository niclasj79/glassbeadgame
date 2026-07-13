declare const domainIdBrand: unique symbol;

type DomainId<Name extends string> = string & {
  readonly [domainIdBrand]: Name;
};

export type SessionId = DomainId<"SessionId">;
export type EventId = DomainId<"EventId">;
export type ConceptId = DomainId<"ConceptId">;
export type ThreadId = DomainId<"ThreadId">;
export type DocumentedRelationId = DomainId<"DocumentedRelationId">;
export type OpenThreadId = DomainId<"OpenThreadId">;
export type MotifCompletionId = DomainId<"MotifCompletionId">;
export type MotifKindId = DomainId<"MotifKindId">;
export type WorldId = DomainId<"WorldId">;
export type ContentPackVersion = DomainId<"ContentPackVersion">;

function toDomainId<Name extends string>(value: string, name: Name): DomainId<Name> {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value as DomainId<Name>;
}

export const toSessionId = (value: string): SessionId => toDomainId(value, "SessionId");
export const toEventId = (value: string): EventId => toDomainId(value, "EventId");
export const toConceptId = (value: string): ConceptId => toDomainId(value, "ConceptId");
export const toThreadId = (value: string): ThreadId => toDomainId(value, "ThreadId");
export const toDocumentedRelationId = (value: string): DocumentedRelationId =>
  toDomainId(value, "DocumentedRelationId");
export const toOpenThreadId = (value: string): OpenThreadId =>
  toDomainId(value, "OpenThreadId");
export const toMotifCompletionId = (value: string): MotifCompletionId =>
  toDomainId(value, "MotifCompletionId");
export const toMotifKindId = (value: string): MotifKindId =>
  toDomainId(value, "MotifKindId");
export const toWorldId = (value: string): WorldId => toDomainId(value, "WorldId");
export const toContentPackVersion = (value: string): ContentPackVersion =>
  toDomainId(value, "ContentPackVersion");

export function eventIdFor(sessionId: SessionId, sequence: number): EventId {
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new RangeError("event sequence must be a non-negative safe integer");
  }

  return toEventId(`event:${sessionId.length}:${sessionId}:${sequence}`);
}
