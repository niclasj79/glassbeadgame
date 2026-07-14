export const INTERPRETATION_COMMIT_COMMAND_ERROR_CODES = Object.freeze([
  "no-active-session",
  "draft-not-ready",
] as const);

export type InterpretationCommitCommandErrorCode =
  (typeof INTERPRETATION_COMMIT_COMMAND_ERROR_CODES)[number];

export class InterpretationCommitCommandError extends Error {
  readonly code: InterpretationCommitCommandErrorCode;

  constructor(code: InterpretationCommitCommandErrorCode, message: string) {
    super(message);
    this.name = "InterpretationCommitCommandError";
    this.code = code;
  }
}
