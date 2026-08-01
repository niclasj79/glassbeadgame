/**
 * The two DOM globals framer-motion feature-detects with while it builds a
 * projection node, and the two listener methods it registers on `window`.
 *
 * The suite's environment is `node` because the rest of this codebase is pure,
 * and these are the smallest stubs that let a React component be rendered to a
 * static string at all. None of them changes what is rendered: `renderToStaticMarkup`
 * runs no effects, so nothing here is ever called back into.
 */
export function installMotionDomStubs(): void {
  const scope = globalThis as unknown as Record<string, unknown>;
  scope.SVGElement ??= class SVGElementStub {};
  scope.HTMLElement ??= class HTMLElementStub {};
  const win = scope.window as Record<string, unknown> | undefined;
  if (win) {
    win.addEventListener ??= () => undefined;
    win.removeEventListener ??= () => undefined;
  }
}
