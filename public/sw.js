/**
 * THE GLASS BEAD GAME — SERVICE WORKER
 *
 * Hand-written rather than generated, because the caching policy here is a
 * design decision and not a build detail.
 *
 * The core rule: **an update never interrupts a Game.** This worker does not
 * call skipWaiting() on install. A new build downloads, installs, and then
 * waits — silently — until the page tells it a session boundary has been
 * reached. A contemplative fifteen-minute session that reloads under the player
 * is a worse failure than being one version behind.
 *
 * Strategies:
 *   - navigation  → network first, cache fallback, so an offline launch works
 *                   and an online launch is never stale.
 *   - build asset → cache first. Vite fingerprints these, so a hit is always
 *                   correct and a miss is always a genuinely new file.
 *   - everything  → network, with an opportunistic cache write.
 *
 * The content pack is bundled JavaScript, so caching build assets caches the
 * game's content: offline play is complete, not degraded.
 */

const VERSION = "gbg-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, so one missing optional file cannot fail the install and
      // leave the player with no offline support at all.
      await Promise.all(
        SHELL.map((url) => cache.add(url).catch(() => undefined))
      );
      // Deliberately no skipWaiting(): see the header.
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(VERSION))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/** The page asks for activation at a safe boundary; the worker never decides. */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "gbg:activate") {
    self.skipWaiting();
  }
});

const isBuildAsset = (url) =>
  url.pathname.includes("/assets/") ||
  /\.(?:js|css|woff2?|ttf|png|jpg|jpeg|svg|webp|ktx2|hdr)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put("./index.html", response.clone());
          return response;
        } catch {
          const cached =
            (await caches.match("./index.html")) ?? (await caches.match("./"));
          if (cached) return cached;
          return new Response(
            "<!doctype html><meta charset=utf-8><title>Offline</title><body style=\"background:#07090e;color:#e9e4d8;font:16px/1.6 system-ui;display:grid;place-items:center;height:100vh;margin:0\"><p>Castalia is not reachable, and no copy has been kept yet.</p>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        }
      })()
    );
    return;
  }

  if (isBuildAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(ASSET_CACHE);
          cache.put(request, response.clone());
        }
        return response;
      })()
    );
  }
});
