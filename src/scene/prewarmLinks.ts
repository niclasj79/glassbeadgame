/**
 * WAIT FOR A COMPILE'S PROGRAMS TO LINK — AND LET GO OF ANY THAT ARE GONE.
 *
 * three's `compileAsync` polls each compiled material's program until the
 * parallel-compile extension reports it linked, reading the program off the
 * material's renderer properties without asking whether it is still there. A
 * material disposed while that poll runs — a Study left while its beads were
 * still linking, or the warm-up's own glass replaced by a theme change — has
 * had its properties removed, and the next tick throws
 * `Cannot read properties of undefined (reading 'isReady')` from a timer,
 * where no promise can catch it. This is the same poll with the one check
 * three omits: a material whose program is gone has nothing left to wait for.
 */

/** What three keeps for a compiled material, as far as this needs to know. */
interface LinkedProgram {
  isReady(): boolean;
}

export interface LinkingRenderer {
  readonly properties: {
    get(object: unknown): unknown;
  };
}

/** three's own interval between completion checks. */
const POLL_MS = 10;

/** The program a renderer currently holds for a material, if it holds one. */
export function programOf(
  renderer: LinkingRenderer,
  material: object
): LinkedProgram | undefined {
  const held = renderer.properties.get(material);
  if (typeof held !== "object" || held === null) return undefined;
  const program: unknown = (held as { currentProgram?: unknown }).currentProgram;
  if (typeof program !== "object" || program === null) return undefined;
  const isReady: unknown = (program as { isReady?: unknown }).isReady;
  return typeof isReady === "function" ? (program as LinkedProgram) : undefined;
}

/**
 * Resolves once every material's program reports linked. A material whose
 * program is no longer held — disposed since the compile — is dropped, not
 * waited on. Never rejects.
 */
export function awaitLinks(
  renderer: LinkingRenderer,
  materials: Iterable<object>
): Promise<void> {
  const pending = new Set(materials);
  return new Promise((resolve) => {
    const check = (): void => {
      for (const material of pending) {
        const program = programOf(renderer, material);
        if (program === undefined || program.isReady()) pending.delete(material);
      }
      if (pending.size === 0) {
        resolve();
        return;
      }
      setTimeout(check, POLL_MS);
    };
    check();
  });
}
