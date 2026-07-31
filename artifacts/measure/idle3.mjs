import { chromium } from "playwright";
const browser = await chromium.launch();
for (const [label, q] of [
  ["motion ", "?testMode=1&seed=castalia-golden-001&quality=high"],
  ["reduced", "?testMode=1&seed=castalia-golden-001&quality=base&reducedMotion=1"],
]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1, colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto("http://localhost:8080/" + q, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__gbgTest));
  await page.evaluate((p) => window.__gbgTest.startSession(p), ["mathematics", "music", "art"]);
  await new Promise((r) => setTimeout(r, 6000));
  const shots = [];
  for (let i = 0; i < 11; i++) { shots.push((await page.screenshot({ type: "png" })).toString("base64")); await new Promise((r) => setTimeout(r, 3000)); }
  const res = await page.evaluate(async (shots) => {
    const load = async (b64) => {
      const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
      const c = document.createElement("canvas"); c.width = 480; c.height = 270;
      const g = c.getContext("2d"); g.drawImage(img, 0, 0, c.width, c.height);
      return g.getImageData(0, 0, c.width, c.height).data;
    };
    const out = [];
    let prev = await load(shots[0]);
    for (let i = 1; i < shots.length; i++) {
      const d = await load(shots[i]);
      let changed = 0, sum = 0;
      for (let k = 0; k < d.length; k += 4) {
        const x = 0.2126*prev[k]+0.7152*prev[k+1]+0.0722*prev[k+2];
        const y = 0.2126*d[k]+0.7152*d[k+1]+0.0722*d[k+2];
        const delta = Math.abs(x-y); sum += delta; if (delta > 12) changed++;
      }
      out.push({ pct: (100*changed)/(d.length/4), mean: sum/(d.length/4) });
      prev = d;
    }
    return out;
  }, shots);
  const pct = res.map(r => r.pct);
  const mean = res.map(r => r.mean);
  console.log(`${label}  3s-apart frames over 30s idle: changed>12luma  min ${Math.min(...pct).toFixed(1)}%  max ${Math.max(...pct).toFixed(1)}%  |  mean delta  min ${Math.min(...mean).toFixed(2)}  max ${Math.max(...mean).toFixed(2)}`);
  console.log("           " + res.map(r => r.pct.toFixed(1)).join("  "));
  await ctx.close();
}
await browser.close();
