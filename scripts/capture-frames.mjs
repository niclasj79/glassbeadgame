/**
 * DIRECTOR CAPTURE HARNESS
 *
 * Plays the golden path in deterministic test mode and writes labelled PNGs to
 * `artifacts/capture/` so art direction is judged from real rendered frames
 * rather than from code descriptions. This is evidence gathering, not a gate —
 * it deliberately lives outside the Playwright suite so a slow software
 * renderer can never fail CI.
 *
 *   npm run dev                              # in one terminal
 *   node scripts/capture-frames.mjs          # in another
 *
 * Options:
 *   --url=http://localhost:8080   dev server to photograph
 *   --variant=desktop             one of desktop | desktop-reduced | mobile | all
 *   --out=artifacts/capture       output directory
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  })
);

const BASE = args.url ?? "http://localhost:8080";
const OUT = path.resolve(process.cwd(), args.out ?? "artifacts/capture");
const PICKS = ["mathematics", "music", "art"];
const SOURCE = "measure.fibonacci-sequence";
const TARGET = "sound.counterpoint";

const VARIANTS = {
  desktop: {
    query: "?testMode=1&seed=castalia-golden-001&quality=high",
    viewport: { width: 1440, height: 810 },
    touch: false,
  },
  "desktop-reduced": {
    query: "?testMode=1&seed=castalia-golden-001&quality=base&reducedMotion=1",
    viewport: { width: 1440, height: 810 },
    touch: false,
  },
  mobile: {
    query: "?testMode=1&seed=castalia-golden-001&quality=potato",
    viewport: { width: 414, height: 896 },
    touch: true,
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll(fn, { timeout = 20000, interval = 120, label = "condition" } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await sleep(interval);
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const which =
    !args.variant || args.variant === "all"
      ? Object.keys(VARIANTS)
      : [args.variant];
  const browser = await chromium.launch();
  const written = [];

  for (const name of which) {
    const v = VARIANTS[name];
    if (!v) throw new Error(`unknown variant ${name}`);
    const context = await browser.newContext({
      viewport: v.viewport,
      hasTouch: v.touch,
      isMobile: v.touch,
      deviceScaleFactor: 1,
      colorScheme: "dark",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 300));
    });

    const shot = async (label, settleMs = 500) => {
      await sleep(settleMs);
      const file = path.join(OUT, `${name}--${label}.png`);
      await page.screenshot({ path: file });
      written.push(file);
      process.stdout.write(`  ${name} ${label}\n`);
    };

    const snap = () => page.evaluate(() => window.__gbgTest.snapshot());

    /**
     * Test mode runs a controlled clock so gesture timing is deterministic,
     * which also means the presentation clock the cue bus reads does not move
     * on its own. Anything staged to resolve *after* a moment — an outcome
     * following its weave — therefore needs time advanced deliberately, the
     * way a player's seconds would advance it.
     */
    const advance = async (ms) => {
      await page.evaluate((v) => window.__gbgTest.advanceClock(v), ms);
      await sleep(220);
    };
    const beadPoint = async (id) =>
      poll(
        async () => {
          const r = await page.evaluate(
            (cid) => window.__gbgTest.beadScreen(cid),
            id
          );
          return r && !r.behind ? r : null;
        },
        { label: `bead ${id} on screen` }
      );
    const waitDraft = (stage) =>
      poll(async () => (await snap()).draftStage === stage, {
        label: `draft stage ${stage}`,
      });

    try {
      process.stdout.write(`${name}\n`);
      await page.goto(`${BASE}/${v.query}`, { waitUntil: "domcontentloaded" });
      await poll(() => page.evaluate(() => Boolean(window.__gbgTest)), {
        label: "test adapter",
      });
      await shot("01-title", 900);

      await page.evaluate((p) => window.__gbgTest.startSession(p), PICKS);
      await shot("02-arena-opening", 1400);

      const src0 = await beadPoint(SOURCE);
      if (v.touch) await page.touchscreen.tap(src0.x, src0.y);
      else await page.mouse.click(src0.x, src0.y);
      await waitDraft("attending");
      await shot("03-attending", 1200);

      // World-anchored sigils orbit a bobbing bead, so they are never
      // "stable" by Playwright's definition. Force the hit.
      const echo = page.getByTestId("intention-echo");
      if (v.touch) await echo.tap({ force: true });
      else await echo.click({ force: true });
      await waitDraft("armed");
      await shot("04-armed-echo", 900);

      const from = await beadPoint(SOURCE);
      const to = await beadPoint(TARGET);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, {
        steps: 6,
      });
      await shot("05-weaving", 300);
      await page.mouse.move(to.x, to.y, { steps: 6 });
      await poll(async () => (await snap()).snappedConceptId === TARGET, {
        label: "latch",
      });
      await shot("06-latched", 250);
      await page.mouse.up();
      await waitDraft("inactive");
      await advance(1500);
      await shot("07-committed", 900);

      // A second thread so the web has structure, not one lonely line.
      const ids = (await snap()).beadIds;
      const P = "measure.prime-numbers";
      const Q = "sound.polyrhythm";
      if (ids.includes(P) && ids.includes(Q)) {
        const p0 = await beadPoint(P);
        await page.mouse.click(p0.x, p0.y);
        await waitDraft("attending");
        await page.getByTestId("intention-echo").click({ force: true });
        await waitDraft("armed");
        const p1 = await beadPoint(P);
        const q1 = await beadPoint(Q);
        await page.mouse.move(p1.x, p1.y);
        await page.mouse.down();
        await page.mouse.move(q1.x, q1.y, { steps: 8 });
        await poll(async () => (await snap()).snappedConceptId === Q, {
          label: "second latch",
        });
        await page.mouse.up();
        await waitDraft("inactive");
        await advance(1500);
        await shot("08-two-threads", 900);
      }

      const conclude = page.getByRole("button", { name: /conclude/i }).first();
      if (await conclude.count()) {
        await conclude.click();
        await shot("09-conclusion", 2600);
      }

      if (errors.length > 0) {
        process.stdout.write(
          `  ! page errors:\n${errors.slice(0, 8).map((e) => `    ${e}`).join("\n")}\n`
        );
      }
    } catch (error) {
      process.stdout.write(`  ! ${name} failed: ${error.message}\n`);
      await page
        .screenshot({ path: path.join(OUT, `${name}--ZZ-failure.png`) })
        .catch(() => {});
    } finally {
      await context.close();
    }
  }

  await browser.close();
  process.stdout.write(`\n${written.length} frames -> ${OUT}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
