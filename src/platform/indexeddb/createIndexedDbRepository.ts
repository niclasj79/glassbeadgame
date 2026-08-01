/**
 * THE INDEXEDDB REPOSITORY
 *
 * A thin promise wrapper over the raw API rather than a library, because the
 * surface actually used here is four object stores and six operations, and a
 * dependency would cost more than it saves (ARCHITECTURE §17).
 *
 * The design principle throughout: **storage failure must never cost the player
 * their session.** IndexedDB is unavailable in private-browsing modes on some
 * browsers, can throw QuotaExceededError mid-session, and is disabled outright
 * by some privacy settings. In every one of those cases the game must keep
 * playing — the session lives in memory and in the event log, and persistence
 * is a convenience layered on top. So the repository degrades to a working
 * in-memory implementation instead of propagating errors into gameplay.
 *
 * The one thing it will never do is silently pretend a write succeeded when the
 * caller needs to know it did not. `available()` tells the truth, so the UI can
 * say "this Game will not be saved" honestly rather than losing it quietly.
 */
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  STORE_DISCOVERIES,
  STORE_INDEXES,
  STORE_KEYS,
  STORE_OPEN_THREADS,
  STORE_PREFERENCES,
  STORE_SESSIONS,
  STORES,
  type PersistedDiscoveryRecord,
  type PersistedOpenThreadRecord,
  type PersistedSessionRecord,
  type StoreName,
} from "./schema";

export interface ProgressRepository {
  /** False when durable storage is unavailable; play continues regardless. */
  readonly available: () => boolean;
  readonly saveSession: (record: PersistedSessionRecord) => Promise<void>;
  readonly loadSession: (id: string) => Promise<PersistedSessionRecord | null>;
  /** Most recent first. */
  readonly listSessions: (limit?: number) => Promise<readonly PersistedSessionRecord[]>;
  readonly recordDiscovery: (record: PersistedDiscoveryRecord) => Promise<void>;
  readonly listDiscoveries: () => Promise<readonly PersistedDiscoveryRecord[]>;
  readonly recordOpenThread: (record: PersistedOpenThreadRecord) => Promise<void>;
  readonly listOpenThreads: () => Promise<readonly PersistedOpenThreadRecord[]>;
  readonly getPreference: <Value>(key: string) => Promise<Value | null>;
  readonly setPreference: (key: string, value: unknown) => Promise<void>;
  /** Drops everything. Used by an explicit player-initiated reset only. */
  readonly clear: () => Promise<void>;
  readonly close: () => void;
}

function promisify<Value>(request: IDBRequest<Value>): Promise<Value> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb request failed"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) {
        if (db.objectStoreNames.contains(store)) continue;
        const created = db.createObjectStore(store, {
          keyPath: STORE_KEYS[store],
        });
        for (const index of STORE_INDEXES[store]) {
          created.createIndex(index.name, index.keyPath);
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("indexeddb open failed"));
    request.onblocked = () =>
      reject(new Error("indexeddb upgrade blocked by another tab"));
  });
}

/**
 * The fallback. Not a stub: it implements the full contract in memory, so a
 * player in a private window gets a complete session that simply does not
 * survive a reload. Every code path above stays identical.
 */
function createMemoryRepository(): ProgressRepository {
  const sessions = new Map<string, PersistedSessionRecord>();
  const discoveries = new Map<string, PersistedDiscoveryRecord>();
  const openThreads = new Map<string, PersistedOpenThreadRecord>();
  const preferences = new Map<string, unknown>();

  const repository: ProgressRepository = {
    available: () => false,
    saveSession: async (record) => {
      sessions.set(record.id, record);
    },
    loadSession: async (id) => sessions.get(id) ?? null,
    listSessions: async (limit) => {
      const all = [...sessions.values()].sort((a, b) => b.endedAt - a.endedAt);
      return limit === undefined ? all : all.slice(0, limit);
    },
    recordDiscovery: async (record) => {
      const existing = discoveries.get(record.relationId);
      discoveries.set(
        record.relationId,
        existing
          ? { ...existing, timesMet: existing.timesMet + 1 }
          : record
      );
    },
    listDiscoveries: async () => [...discoveries.values()],
    recordOpenThread: async (record) => {
      openThreads.set(record.openThreadId, record);
    },
    listOpenThreads: async () => [...openThreads.values()],
    getPreference: async <Value,>(key: string) =>
      (preferences.get(key) as Value | undefined) ?? null,
    setPreference: async (key, value) => {
      preferences.set(key, value);
    },
    clear: async () => {
      sessions.clear();
      discoveries.clear();
      openThreads.clear();
      preferences.clear();
    },
    close: () => {},
  };
  return Object.freeze(repository);
}

export function createIndexedDbRepository(): ProgressRepository {
  if (typeof indexedDB === "undefined") return createMemoryRepository();

  let db: IDBDatabase | null = null;
  let opening: Promise<IDBDatabase> | null = null;
  let broken = false;
  const fallback = createMemoryRepository();

  const connection = async (): Promise<IDBDatabase | null> => {
    if (broken) return null;
    if (db) return db;
    if (!opening) {
      opening = openDatabase();
      opening.catch(() => {
        // A failed open is permanent for this page load. Retrying on every
        // write would turn one denied-storage prompt into a stall.
        broken = true;
        opening = null;
      });
    }
    try {
      db = await opening;
      db.onclose = () => {
        db = null;
        opening = null;
      };
      return db;
    } catch {
      return null;
    }
  };

  const write = async (store: StoreName, value: unknown): Promise<boolean> => {
    const database = await connection();
    if (!database) return false;
    try {
      const transaction = database.transaction(store, "readwrite");
      const done = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(transaction.error ?? new Error("write failed"));
        transaction.onabort = () =>
          reject(transaction.error ?? new Error("write aborted"));
      });
      transaction.objectStore(store).put(value);
      await done;
      return true;
    } catch {
      // Quota, a closed connection, or a browser that changed its mind. The
      // session is unaffected; only its durability is.
      return false;
    }
  };

  const readAll = async <Value>(store: StoreName): Promise<Value[]> => {
    const database = await connection();
    if (!database) return [];
    try {
      const transaction = database.transaction(store, "readonly");
      return (await promisify(
        transaction.objectStore(store).getAll()
      )) as Value[];
    } catch {
      return [];
    }
  };

  const repository: ProgressRepository = {
    available: () => !broken,

    saveSession: async (record) => {
      if (!(await write(STORE_SESSIONS, record))) {
        await fallback.saveSession(record);
      }
    },

    loadSession: async (id) => {
      const database = await connection();
      if (!database) return fallback.loadSession(id);
      try {
        const transaction = database.transaction(STORE_SESSIONS, "readonly");
        const result = await promisify(
          transaction.objectStore(STORE_SESSIONS).get(id)
        );
        return (result as PersistedSessionRecord | undefined) ?? null;
      } catch {
        return fallback.loadSession(id);
      }
    },

    listSessions: async (limit) => {
      const all = await readAll<PersistedSessionRecord>(STORE_SESSIONS);
      const sorted = all.sort((a, b) => b.endedAt - a.endedAt);
      return limit === undefined ? sorted : sorted.slice(0, limit);
    },

    recordDiscovery: async (record) => {
      const database = await connection();
      if (!database) return fallback.recordDiscovery(record);
      try {
        const transaction = database.transaction(STORE_DISCOVERIES, "readwrite");
        const store = transaction.objectStore(STORE_DISCOVERIES);
        const existing = (await promisify(store.get(record.relationId))) as
          | PersistedDiscoveryRecord
          | undefined;
        // Meeting a relation again increments rather than overwriting, so the
        // Codex remembers where a player first met an idea.
        store.put(
          existing
            ? { ...existing, timesMet: existing.timesMet + 1 }
            : record
        );
        await new Promise<void>((resolve, reject) => {
          transaction.oncomplete = () => resolve();
          transaction.onerror = () =>
            reject(transaction.error ?? new Error("discovery write failed"));
        });
      } catch {
        await fallback.recordDiscovery(record);
      }
    },

    listDiscoveries: async () =>
      readAll<PersistedDiscoveryRecord>(STORE_DISCOVERIES),

    recordOpenThread: async (record) => {
      if (!(await write(STORE_OPEN_THREADS, record))) {
        await fallback.recordOpenThread(record);
      }
    },

    listOpenThreads: async () =>
      readAll<PersistedOpenThreadRecord>(STORE_OPEN_THREADS),

    getPreference: async <Value,>(key: string) => {
      const database = await connection();
      if (!database) return fallback.getPreference<Value>(key);
      try {
        const transaction = database.transaction(STORE_PREFERENCES, "readonly");
        const result = (await promisify(
          transaction.objectStore(STORE_PREFERENCES).get(key)
        )) as { value: Value } | undefined;
        return result ? result.value : null;
      } catch {
        return fallback.getPreference<Value>(key);
      }
    },

    setPreference: async (key, value) => {
      if (!(await write(STORE_PREFERENCES, { key, value }))) {
        await fallback.setPreference(key, value);
      }
    },

    clear: async () => {
      const database = await connection();
      await fallback.clear();
      if (!database) return;
      try {
        const transaction = database.transaction([...STORES], "readwrite");
        for (const store of STORES) transaction.objectStore(store).clear();
        await new Promise<void>((resolve, reject) => {
          transaction.oncomplete = () => resolve();
          transaction.onerror = () =>
            reject(transaction.error ?? new Error("clear failed"));
        });
      } catch {
        // Nothing further to do: the caller asked to forget, and the in-memory
        // copy is already forgotten.
      }
    },

    close: () => {
      db?.close();
      db = null;
      opening = null;
    },
  };

  return Object.freeze(repository);
}
