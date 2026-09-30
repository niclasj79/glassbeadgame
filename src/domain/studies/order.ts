/**
 * Deterministic enumeration and ordering shared by the solver and the
 * evaluator. Nothing here depends on the order a JavaScript engine happens to
 * iterate a collection in: every choice either Study function makes is decided
 * by an explicit comparison.
 */

/** Every k-element selection, in lexicographic order of the input. */
export function combinations<Item>(
  items: readonly Item[],
  k: number
): readonly (readonly Item[])[] {
  const out: Item[][] = [];
  if (k < 0 || k > items.length) return out;
  const chosen: Item[] = [];
  const pick = (start: number): void => {
    if (chosen.length === k) {
      out.push([...chosen]);
      return;
    }
    for (let index = start; index <= items.length - (k - chosen.length); index += 1) {
      chosen.push(items[index] as Item);
      pick(index + 1);
      chosen.pop();
    }
  };
  pick(0);
  return out;
}

/** One spelling of an unordered pair of ids, whichever way round it was woven. */
export function unorderedPairKey(a: string, b: string): string {
  return a <= b ? `${a}~${b}` : `${b}~${a}`;
}

/** Lexicographic comparison of number lists; a proper prefix sorts first. */
export function compareNumberLists(
  left: readonly number[],
  right: readonly number[]
): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] as number) - (right[index] as number);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}
