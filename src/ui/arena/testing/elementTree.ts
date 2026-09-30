import {
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { AnimatePresence } from "framer-motion";

/**
 * WHAT A CONTROL DOES, WITHOUT A DOM.
 *
 * The suite runs in `node`, and `renderToStaticMarkup` can say what is on the
 * page but never what pressing it does. The arena's surfaces are hook-free on
 * purpose — the subscriptions live in the one connected component above each —
 * so their element trees can be expanded by calling them, and a control's own
 * `onClick` can be invoked and its effect asserted.
 *
 * Only `AnimatePresence` holds hooks among the components these surfaces use,
 * so it is walked rather than called; `motion.*` elements are exotic objects
 * and are walked too. Anything else that throws when called is a component
 * that grew a hook, and the throw is left to fail the test that met it.
 */

type AnyProps = Readonly<Record<string, unknown>> & { readonly children?: ReactNode };

function children(node: ReactNode): readonly ReactNode[] {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => children(child));
  return [node];
}

/** Every element in the tree, with hook-free components expanded in place. */
export function flatten(node: ReactNode): readonly ReactElement<AnyProps>[] {
  const found: ReactElement<AnyProps>[] = [];
  const visit = (current: ReactNode): void => {
    for (const child of children(current)) {
      if (!isValidElement<AnyProps>(child)) continue;
      found.push(child);
      const type: unknown = child.type;
      if (typeof type === "function" && type !== AnimatePresence && type !== Fragment) {
        const component = type as (props: AnyProps) => ReactNode;
        visit(component(child.props));
      } else {
        visit(child.props.children);
      }
    }
  };
  visit(node);
  return found;
}

/** The elements carrying one `data-testid`, in document order. */
export function byTestId(node: ReactNode, testId: string): readonly ReactElement<AnyProps>[] {
  return flatten(node).filter((element) => element.props["data-testid"] === testId);
}

/** Press a control: invoke the `onClick` it was rendered with. */
export function press(element: ReactElement<AnyProps> | undefined): void {
  const onClick = element?.props.onClick;
  if (typeof onClick !== "function") {
    throw new Error("this element has no onClick to press");
  }
  (onClick as (event?: unknown) => void)({
    defaultPrevented: false,
    preventDefault: () => undefined,
  });
}
