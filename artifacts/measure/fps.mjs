import { chromium } from "playwright";
const BASE = "http://localhost:8080";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1, colorScheme: "dark" });
const page = await ctx.newPage();
await page.goto(`${BASE}/?testMode=1&seed=castalia-golden-001&quality=high`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__gbgTest));
await new Promise((r) => setTimeout(r, 2000));
const fps = await page.evaluate(() => new Promise((resolve) => {
  const t = [];
  const tick = () => { t.push(performance.now()); if (t.length < 40) requestAnimationFrame(tick); else resolve(t); };
  requestAnimationFrame(tick);
}));
const gaps = fps.slice(1).map((v, i) => v - fps[i]).sort((a, b) => a - b);
console.log(`title screen: median frame interval ${gaps[Math.floor(gaps.length/2)].toFixed(1)} ms  (${(1000/gaps[Math.floor(gaps.length/2)]).toFixed(1)} fps), worst ${gaps[gaps.length-1].toFixed(0)} ms`);
await page.evaluate((p) => window.__gbgTest.startSession(p), ["mathematics","music","art"]);
await new Promise((r) => setTimeout(r, 2500));
const fps2 = await page.evaluate(() => new Promise((resolve) => {
  const t = [];
  const tick = () => { t.push(performance.now()); if (t.length < 40) requestAnimationFrame(tick); else resolve(t); };
  requestAnimationFrame(tick);
}));
const gaps2 = fps2.slice(1).map((v, i) => v - fps2[i]).sort((a, b) => a - b);
console.log(`arena:        median frame interval ${gaps2[Math.floor(gaps2.length/2)].toFixed(1)} ms  (${(1000/gaps2[Math.floor(gaps2.length/2)]).toFixed(1)} fps), worst ${gaps2[gaps2.length-1].toFixed(0)} ms`);
await browser.close();
