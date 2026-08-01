import { chromium } from "playwright";
const BASE = "http://localhost:8080";
const Q = "?testMode=1&seed=castalia-golden-001&quality=high";
const browser = await chromium.launch();
for (const run of [1, 2, 3]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1, colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${Q}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__gbgTest));
  await new Promise((r) => setTimeout(r, 1800));
  const out = await page.evaluate(async () => {
    const rule = document.querySelector("[data-opening] div[aria-hidden]");
    const button = [...document.querySelectorAll("button")].find((b) => /begin/i.test(b.textContent || ""));
    const t0 = document.timeline.currentTime;
    button.click();
    await new Promise((r) => setTimeout(r, 300));
    const t = rule.getAnimations().find((a) => a.constructor.name === "CSSTransition");
    return { startedAfterMs: t && t.startTime != null ? t.startTime - t0 : null, found: !!t };
  });
  console.log(`run ${run}: rule struck ${out.startedAfterMs === null ? "(not started)" : out.startedAfterMs.toFixed(1) + " ms"} after the press`);
  await ctx.close();
}
await browser.close();
