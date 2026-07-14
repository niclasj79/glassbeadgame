export const INTERPRETATION_DRAFT_ERROR_CODES = Object.freeze([
  "invalid-session-concepts",
  "unknown-concept",
  "identical-concepts",
  "unsupported-intention",
  "invalid-transition-order",
] as const);

export type InterpretationDraftErrorCode =
  (typeof INTERPRETATION_DRAFT_ERROR_CODES)[number];

export class InterpretationDraftError extends Error {
  readonly code: InterpretationDraftErrorCode;

  constructor(code: InterpretationDraftErrorCode, message: string) {
    super(message);
    this.name = "InterpretationDraftError";
    this.code = code;
  }
}
