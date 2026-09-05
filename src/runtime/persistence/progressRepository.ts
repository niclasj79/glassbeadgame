import {
  createIndexedDbRepository,
  createMemoryRepository,
  type ProgressRepository,
} from "../../platform/indexeddb/createIndexedDbRepository";
import { testMode } from "../testMode";

/**
 * The one durable store the application talks to.
 *
 * Deterministic test mode runs on the in-memory implementation on purpose:
 * IndexedDB is shared by origin, so a Game kept by one browser test would be
 * on the shelf of the next, and the suite would stop being reproducible from a
 * fixed seed. Everything a test can observe about keeping — the status line,
 * the shelf, re-opening a Game — behaves identically on either implementation.
 */
export const progressRepository: ProgressRepository = testMode.enabled
  ? createMemoryRepository()
  : createIndexedDbRepository();
