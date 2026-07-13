export const ATTEND_CONCEPT_COMMAND_ERROR_CODES = ["no-active-session"] as const;

export type AttendConceptCommandErrorCode =
  (typeof ATTEND_CONCEPT_COMMAND_ERROR_CODES)[number];

export class AttendConceptCommandError extends Error {
  readonly code: AttendConceptCommandErrorCode;

  constructor(code: AttendConceptCommandErrorCode, message: string) {
    super(message);
    this.name = "AttendConceptCommandError";
    this.code = code;
  }
}
