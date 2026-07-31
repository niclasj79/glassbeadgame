/**
 * PWA REGISTRATION
 *
 * One rule shapes all of this: **an update never interrupts a Game.**
 *
 * A contemplative fifteen-minute session that reloads under the player because
 * a new build shipped is a worse failure than being one version behind. So the
 * service worker never calls `skipWaiting()` on its own; a waiting worker is
 * held, and activation happens between sessions when the player is at the
 * title. That is the "update only between sessions" behaviour ARCHITECTURE §14
 * asks for, and it is enforced here rather than merely intended.
 */

export interface ServiceWorkerStatus {
  readonly supported: boolean;
  readonly registered: boolean;
  /** A newer build is downloaded and waiting for a safe moment. */
  readonly updateWaiting: boolean;
}

type StatusListener = (status: ServiceWorkerStatus) => void;

let registration: ServiceWorkerRegistration | null = null;
let updateWaiting = false;
const listeners = new Set<StatusListener>();

function status(): ServiceWorkerStatus {
  return {
    supported: typeof navigator !== "undefined" && "serviceWorker" in navigator,
    registered: registration !== null,
    updateWaiting,
  };
}

function announce(): void {
  const snapshot = status();
  for (const listener of [...listeners]) listener(snapshot);
}

export function onServiceWorkerStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener(status());
  return () => listeners.delete(listener);
}

export function serviceWorkerStatus(): ServiceWorkerStatus {
  return status();
}

/**
 * Registers the worker. Safe to call unconditionally: unsupported browsers,
 * insecure origins, and failed registrations all resolve to "no worker" and the
 * game runs normally from the network.
 */
export async function registerServiceWorker(
  scriptUrl: string,
  scope: string
): Promise<ServiceWorkerStatus> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return status();
  }
  try {
    registration = await navigator.serviceWorker.register(scriptUrl, { scope });

    if (registration.waiting) {
      updateWaiting = true;
      announce();
    }

    registration.addEventListener("updatefound", () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        // `controller` is null on the very first install; a waiting worker only
        // means "update" when something was already controlling the page.
        if (
          installing.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          updateWaiting = true;
          announce();
        }
      });
    });
  } catch {
    // Registration is a progressive enhancement. A refused or unavailable
    // worker must never stop the game from starting.
    registration = null;
  }
  announce();
  return status();
}

/**
 * Applies a waiting update. Call this only at a safe boundary — the title
 * screen between Games — never while a session is in progress.
 */
export async function applyWaitingUpdate(): Promise<boolean> {
  const waiting = registration?.waiting;
  if (!waiting) return false;
  const activated = new Promise<void>((resolve) => {
    const onChange = () => {
      if (waiting.state === "activated") {
        waiting.removeEventListener("statechange", onChange);
        resolve();
      }
    };
    waiting.addEventListener("statechange", onChange);
  });
  waiting.postMessage({ type: "gbg:activate" });
  await activated;
  updateWaiting = false;
  announce();
  return true;
}

/** Test seam: resets module state between cases. */
export function resetServiceWorkerStateForTests(): void {
  registration = null;
  updateWaiting = false;
  listeners.clear();
}
