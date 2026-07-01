import clsx from "clsx";
import type { HTMLAttributes } from "react";

/** The one frosted-surface primitive every floating panel is built from. */
export function GlassPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-line/50 bg-surface/70 backdrop-blur-xl",
        "shadow-[0_12px_50px_-16px_rgba(0,0,0,0.85)]",
        className
      )}
      {...props}
    />
  );
}
