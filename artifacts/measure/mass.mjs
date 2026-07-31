import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const files = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("about:blank");
for (const f of files) {
  const b64 = readFileSync(f).toString("base64");
  const out = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const { data } = g.getImageData(0, 0, c.width, c.height);
    const W = c.width, H = c.height;
    let sx = 0, sy = 0, sw = 0;
    const col = [0,0,0], row = [0,0,0];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y*W+x)*4;
      const l = 0.2126*data[i] + 0.7152*data[i+1] + 0.0722*data[i+2];
      const w = Math.max(0, l - 18);
      if (w <= 0) continue;
      sx += x*w; sy += y*w; sw += w;
      col[Math.min(2, Math.floor(x*3/W))] += w;
      row[Math.min(2, Math.floor(y*3/H))] += w;
    }
    const pc = a => a.map(v => Math.round(v*100/sw)).join("/");
    return { W, H, cx: sx/sw, cy: sy/sw, cols: pc(col), rows: pc(row) };
  }, b64);
  const name = f.split(/[\/]/).pop();
  console.log(`${name}  centroid (${out.cx.toFixed(0)}, ${out.cy.toFixed(0)}) of ${out.W}x${out.H}  off ${(100*(out.cx-out.W/2)/out.W).toFixed(1)}% x / ${(100*(out.cy-out.H/2)/out.H).toFixed(1)}% y   cols ${out.cols}  rows ${out.rows}`);
}
await browser.close();
