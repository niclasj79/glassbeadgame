import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
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

/**
 * THE INITIAL CHUNK — what a player downloads before the title appears.
 *
 * This gate used to sum every .js file in `dist/`, which had one fatal
 * property: a lazily-loaded chunk cost exactly as much as an eagerly-loaded
 * one, so code splitting could not move the number, so the only way past the
 * ceiling was to raise the ceiling. It was raised twice. `bundle-budgets.json`
 * records both raises and says plainly what the answer to a third is, and this
 * is it.
 *
 * The entry and its transitive *static* imports are what the browser must have
 * in hand to paint. `dynamicImports` are deliberately not followed: that is the
 * whole point — code that is only reachable after a Game has been concluded is
 * not paid for by someone who never concludes one.
 *
 * The total is still computed and still reported. It is simply no longer the
 * thing that fails the build, because a growing total is worth seeing and a
 * growing *first load* is worth stopping.
 */
function initialChunk(manifest) {
  const entries = Object.values(manifest).filter((chunk) => chunk.isEntry);
  if (entries.length === 0) throw new Error("manifest has no entry chunk");

  const seen = new Set();
  const walk = (file) => {
    if (file === undefined || seen.has(file)) return;
    seen.add(file);
    const chunk = Object.values(manifest).find((candidate) => candidate.file === file);
    if (chunk === undefined) return;
    // Static imports only. `chunk.dynamicImports` is the boundary this gate exists to reward.
    for (const key of chunk.imports ?? []) walk(manifest[key]?.file);
    for (const css of chunk.css ?? []) seen.add(css);
  };
  for (const entry of entries) walk(entry.file);
  return seen;
}

const manifestPath = join(dist, ".vite", "manifest.json");
if (!existsSync(manifestPath)) {
  throw new Error("dist/.vite/manifest.json is missing; the build must set build.manifest");
}
const initial = initialChunk(JSON.parse(readFileSync(manifestPath, "utf8")));
const initialAssets = assets.filter((asset) => initial.has(asset.path));
const initialJavascript = initialAssets.filter((asset) => asset.category === "javascript");
const initialJavascriptRawBytes = initialJavascript.reduce((sum, asset) => sum + asset.rawBytes, 0);
const initialJavascriptGzipBytes = initialJavascript.reduce((sum, asset) => sum + asset.gzipBytes, 0);

const report = {
  schemaVersion: 2,
  context: { base: "/glassbeadgame/", target: "es2020", compression: "gzip-9" },
  totals: { rawBytes: totalRawBytes, gzipBytes: totalGzipBytes, byCategory },
  initial: {
    javascriptRawBytes: initialJavascriptRawBytes,
    javascriptGzipBytes: initialJavascriptGzipBytes,
    files: initialJavascript.map((asset) => asset.stableName).sort(),
    deferred: assets
      .filter((asset) => asset.category === "javascript" && !initial.has(asset.path))
      .map((asset) => asset.stableName)
      .sort(),
  },
  assets,
};
const outputDir = join(root, "artifacts", "performance");
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, "bundle-report.json"), `${JSON.stringify(report, null, 2)}\n`);

/**
 * Gated. Every one of these fails the build when exceeded, so every one of them
 * must be a number somebody is prepared to defend.
 */
const checks = {
  initialJavascriptRawBytes,
  initialJavascriptGzipBytes,
  totalRawBytes,
  totalGzipBytes,
  largestAssetRawBytes: Math.max(...assets.map((asset) => asset.rawBytes)),
};

/**
 * Reported and not gated. Total JavaScript is still worth watching — it is what
 * a player pays across a whole session — but gating on it made deferring work
 * worthless, which is how this project ended up raising a ceiling twice rather
 * than moving code behind a dynamic import.
 */
const observed = {
  javascriptRawBytes: byCategory.javascript.rawBytes,
  javascriptGzipBytes: byCategory.javascript.gzipBytes,
  deferredJavascriptChunks: report.initial.deferred.length,
};

console.log(
  JSON.stringify(
    { ...checks, observed, report: "artifacts/performance/bundle-report.json" },
    null,
    2
  )
);
if (process.argv.includes("--check")) {
  const unbudgeted = Object.keys(checks).filter((key) => budgets[key] === undefined);
  if (unbudgeted.length) {
    // A gated metric with no ceiling silently passes forever. Fail loudly instead.
    for (const key of unbudgeted) console.error(`${key}: no budget declared`);
    process.exitCode = 1;
  }
  const failures = Object.entries(checks).filter(([key, value]) => value > budgets[key]);
  if (failures.length) {
    for (const [key, value] of failures) console.error(`${key}: ${value} exceeds ${budgets[key]}`);
    process.exitCode = 1;
  }
}
