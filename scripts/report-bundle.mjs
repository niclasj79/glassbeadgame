import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import budgets from "./bundle-budgets.json" with { type: "json" };

const root = process.cwd();
const dist = join(root, "dist");
if (!existsSync(dist)) throw new Error("dist is missing; run npm run build first");

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

function stableName(path) {
  return basename(path).replace(/-[A-Za-z0-9_-]{8}(?=\.[^.]+$)/u, "-[hash]");
}

function category(path) {
  const ext = extname(path).toLowerCase();
  if (ext === ".js") return "javascript";
  if (ext === ".css") return "css";
  if ([".woff", ".woff2", ".ttf", ".otf"].includes(ext)) return "font";
  if ([".png", ".jpg", ".jpeg", ".webp", ".svg", ".avif", ".ico"].includes(ext)) return "image";
  return "other";
}

async function gzipSize(path) {
  let size = 0;
  const sink = new Writable({ write(chunk, _encoding, callback) { size += chunk.length; callback(); } });
  await pipeline(createReadStream(path), createGzip({ level: 9 }), sink);
  return size;
}

const assets = [];
for (const path of files(dist).sort()) {
  const rawBytes = statSync(path).size;
  assets.push({
    path: relative(dist, path).replaceAll("\\", "/"),
    stableName: stableName(path),
    category: category(path),
    rawBytes,
    gzipBytes: await gzipSize(path),
  });
}

const categoryNames = ["javascript", "css", "font", "image", "other"];
const byCategory = Object.fromEntries(categoryNames.map((key) => [key, { rawBytes: 0, gzipBytes: 0 }]));
for (const asset of assets) {
  byCategory[asset.category].rawBytes += asset.rawBytes;
  byCategory[asset.category].gzipBytes += asset.gzipBytes;
}
const totalRawBytes = assets.reduce((sum, asset) => sum + asset.rawBytes, 0);
const totalGzipBytes = assets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
const report = {
  schemaVersion: 1,
  context: { base: "/glassbeadgame/", target: "es2020", compression: "gzip-9" },
  totals: { rawBytes: totalRawBytes, gzipBytes: totalGzipBytes, byCategory },
  assets,
};
const outputDir = join(root, "artifacts", "performance");
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, "bundle-report.json"), `${JSON.stringify(report, null, 2)}\n`);

const checks = {
  totalRawBytes,
  totalGzipBytes,
  javascriptRawBytes: byCategory.javascript.rawBytes,
  javascriptGzipBytes: byCategory.javascript.gzipBytes,
  largestAssetRawBytes: Math.max(...assets.map((asset) => asset.rawBytes)),
};
console.log(JSON.stringify({ ...checks, report: "artifacts/performance/bundle-report.json" }, null, 2));
if (process.argv.includes("--check")) {
  const failures = Object.entries(checks).filter(([key, value]) => value > budgets[key]);
  if (failures.length) {
    for (const [key, value] of failures) console.error(`${key}: ${value} exceeds ${budgets[key]}`);
    process.exitCode = 1;
  }
}
