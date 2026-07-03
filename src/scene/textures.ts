import * as THREE from "three";

/** Shared procedural textures — one instance each, reused across the scene. */

export function makeRadialTexture(inner: string, outer: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let haloTexture: THREE.CanvasTexture | null = null;

/** Soft white radial glow — tinted per bead via sprite material color. */
export function getHaloTexture(): THREE.CanvasTexture {
  if (!haloTexture) {
    haloTexture = makeRadialTexture("rgba(255,255,255,0.85)", "rgba(255,255,255,0)");
  }
  return haloTexture;
}

const glyphTextures = new Map<string, THREE.CanvasTexture>();

/**
 * A discipline glyph rendered white on transparent via 2D canvas — the system
 * font stack covers ♪ ⚖ Φ Ψ ∑ ◊ where the bundled Inter subset does not.
 * Tinted per discipline via sprite material color.
 */
export function getGlyphTexture(glyph: string): THREE.CanvasTexture {
  const cached = glyphTextures.get(glyph);
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.font = "86px 'Segoe UI Symbol', 'Apple Symbols', system-ui, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(255,255,255,0.55)";
  ctx.shadowBlur = 10;
  ctx.fillText(glyph, size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  glyphTextures.set(glyph, tex);
  return tex;
}
