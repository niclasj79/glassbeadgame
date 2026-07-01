import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
}

export function Button({ variant = "primary", className, ...props }: Props) {
  return (
    <button
      className={clsx(
        "select-none rounded-full font-ui text-xs uppercase tracking-[0.28em] transition-all duration-300",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-glow/60",
        "disabled:pointer-events-none disabled:opacity-35",
        variant === "primary" &&
          "border border-glow/40 bg-glow/10 px-9 py-3.5 text-bright hover:border-glow/70 hover:bg-glow/20 hover:shadow-[0_0_34px_-6px_hsl(259_84%_66%/0.55)]",
        variant === "ghost" &&
          "border border-transparent px-6 py-3 text-dim hover:text-bright hover:border-line/60",
        className
      )}
      {...props}
    />
  );
}
